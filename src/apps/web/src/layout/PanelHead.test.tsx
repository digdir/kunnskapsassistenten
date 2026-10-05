import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { PanelHead } from './PanelHead';
import { Shell } from './Shell';
import { viewComponents } from './viewComponents';
import type { SlotViewProps } from './viewModel';

/**
 * The place a view may put a control of the PANEL's on the panel's own row.
 *
 * What is measured is where it lands and when it exists: beside the collapse
 * button rather than in the scrolling region, nothing at all when no view
 * fills it, and nothing on a rail — a rail is one button wide.
 *
 * `shortcutModifier` is not exercised here. It reads `navigator.userAgent`,
 * which the test environment answers for, and what it decides is one word;
 * the skip link's own text is measured in src/App.test.tsx.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

/**
 * A view that puts nothing on the panel row, the way `ThreadsView` does.
 *
 * The two cases below used to measure the empty place with the real
 * `FiltersView`, because that one kept its «Tråder» button in the pinned view
 * head. It moved to this row in #119, so the empty case needs a view that
 * really fills nothing — which the thread list is, in the running app.
 */
function QuietView(_props: SlotViewProps) {
  return <p>Innholdet i visningen</p>;
}

/** A view that puts one button on the panel row, the way FiltersView does. */
function FillingView(_props: SlotViewProps) {
  return (
    <>
      <PanelHead>
        <button type="button">Tråder</button>
      </PanelHead>
      <p>Innholdet i visningen</p>
    </>
  );
}

function openShell({ filled = true, width = 1440 } = {}) {
  const original = viewComponents.filters;
  viewComponents.filters = filled ? FillingView : QuietView;

  setViewportWidth(width);
  render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Shell routeOwnsMain />
      </LayoutProvider>
    </MemoryRouter>,
  );

  return () => {
    viewComponents.filters = original;
  };
}

const slot = () => document.querySelector('.panel-head-slot');
const railToggle = () => screen.getByRole('button', { name: 'Skjul tråder og filter' });

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('plassen i panelhodet', () => {
  it('tegner det viewet fyller den med, på panelets egen rad', () => {
    const restore = openShell();
    try {
      const button = screen.getByRole('button', { name: 'Tråder' });

      // I panelhodet, ved siden av «Skjul …» — ikke i den rullende regionen.
      expect(slot()?.contains(button)).toBe(true);
      expect(button.closest('.sidebar-header')).not.toBeNull();
      expect(button.closest('.sidebar-content')).toBeNull();
    } finally {
      restore();
    }
  });

  it('står ved siden av knappen som legger sammen panelet', () => {
    const restore = openShell();
    try {
      const header = railToggle().closest('.sidebar-header')!;
      expect(header.contains(screen.getByRole('button', { name: 'Tråder' }))).toBe(true);
    } finally {
      restore();
    }
  });

  it('er tom når ingen view fyller den, og en tom plass tegner ingenting', () => {
    // `:empty` i CSS-en gjør den usynlig; her måles at React ikke legger noe
    // i den i det hele tatt, som er det `:empty` hviler på.
    //
    // Med et view som ikke fyller plassen, og det er ikke et kunstig
    // tilfelle: filtervisningen flyttet knappen sin hit i #119, trådlista
    // setter ingenting der, og da skal raden være tom på ordentlig.
    const restore = openShell({ filled: false });
    try {
      expect(slot()).not.toBeNull();
      // `hasChildNodes()` og ikke `childElementCount`: `:empty` i CSS-en er om
      // BARNENODER, tekst medregnet, og det er den påstanden som skal måles.
      expect(slot()?.hasChildNodes()).toBe(false);
    } finally {
      restore();
    }
  });

  it('finnes ikke på en rail, for der er det ingen plass til en knapp til', () => {
    const restore = openShell();
    try {
      act(() => railToggle().click());

      expect(slot()).toBeNull();
      expect(screen.queryByRole('button', { name: 'Tråder' })).toBeNull();
    } finally {
      restore();
    }
  });

  it('kommer tilbake når panelet åpnes igjen', () => {
    const restore = openShell();
    try {
      act(() => railToggle().click());
      act(() => screen.getByRole('button', { name: 'Vis tråder og filter' }).click());

      expect(screen.getByRole('button', { name: 'Tråder' })).toBeDefined();
    } finally {
      restore();
    }
  });
});

describe('under brytepunktet, der panelet er en skuff', () => {
  it('har plassen inne i skuffa, ikke på railen', () => {
    /*
     * En skuff er hele panelet, ikke en rail: viewet tegnes inne i den, så
     * plassen det skriver til må være der inne også. Uten dette forsvant
     * «Tråder» helt under 1139 — der leseren trenger den mest, for trådlista
     * er veien ut av et filter. Funnet av KA CC på #116.
     */
    const restore = openShell({ width: 1024 });
    try {
      act(() => screen.getByRole('button', { name: /^Vis tråder og filter/ }).click());

      const button = screen.getByRole('button', { name: 'Tråder' });
      expect(button.closest('dialog')).not.toBeNull();
      expect(button.closest('.panel-head-slot')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it('har ingen plass på railen bak skuffa', () => {
    // Railen står igjen på rada mens skuffa er åpen, og den er én knapp bred.
    const restore = openShell({ width: 1024 });
    try {
      act(() => screen.getByRole('button', { name: /^Vis tråder og filter/ }).click());

      const outside = [...document.querySelectorAll('.panel-head-slot')].filter(
        (element) => element.closest('dialog') === null,
      );
      expect(outside).toEqual([]);
    } finally {
      restore();
    }
  });

  it('lar hoderaden i skuffa holde plassen alene, så en tom rad kan skjules', () => {
    /*
     * Det CSS-en henger på: `.drawer .sidebar-header:has(> .panel-head-slot:empty)`.
     * jsdom kjører ikke stilarket vårt, så det som måles her er forutsetningen
     * selektoren trenger — at raden har plassen som sitt eneste barn, og at
     * plassen er tom til et view fyller den.
     *
     * Hvorfor det er verdt en regel: raden er et flex-element i `.panel`, som
     * har `gap: 16px`. En boks på null høyde får gapet sitt likevel, så en
     * ufylt plass tok 16 px av rullevinduet i et panel som ruller på alle
     * bredder. Målt til 16 av KA CC på 1100, og til 0 etterpå.
     */
    const restore = openShell({ filled: false, width: 1024 });
    try {
      const header = document.querySelector('dialog .sidebar-header')!;

      expect(header.children).toHaveLength(1);
      expect(header.firstElementChild?.className).toBe('panel-head-slot');
      expect(header.firstElementChild?.hasChildNodes()).toBe(false);
    } finally {
      restore();
    }
  });

  it('lar raden fylles når et view bruker plassen', () => {
    const restore = openShell({ width: 1024 });
    try {
      const header = document.querySelector('dialog .sidebar-header')!;
      expect(header.firstElementChild?.hasChildNodes()).toBe(true);
    } finally {
      restore();
    }
  });

  it('beholder plassen når skuffa er lukket, så viewet ikke mister den', () => {
    // En lukket `<dialog>` er `display: none`, så innholdet er skjult uansett
    // — men boksen står, slik at viewet ikke må montere seg på nytt.
    const restore = openShell({ width: 1024 });
    try {
      expect(document.querySelector('dialog .panel-head-slot')).not.toBeNull();
    } finally {
      restore();
    }
  });
});

describe('sammenleggingsknappen på panelraden', () => {
  /*
   * Ikonknapp med navnet i `aria-label`, i alle tilstander.
   *
   * Den tegnet ordene ved siden av ikonet mens panelet var åpent, på det
   * argumentet at en etikett på skjermen slår en bak en hover. Det holdt så
   * lenge raden hadde én kontroll. Med tre ble «Skjul tråder og filter»
   * (209 px) pluss «Tråder» (123) pluss breddeknappene (88) til 420 px i et
   * panel på 400, og det som falt av enden var breddeknappene — en kontroll
   * pekeren ikke lenger nådde. Målt av KA CC på #119.
   *
   * Etter: 42 + 123 + 88 = 253 i en rad på 399. Målt her uten layout, så
   * tallene står i kommentaren; det testen måler er navnet og at teksten er
   * borte.
   */
  it('har navnet sitt selv om ordene ikke står på skjermen', () => {
    const restore = openShell();
    try {
      const toggle = railToggle();

      expect(toggle.getAttribute('aria-label')).toBe('Skjul tråder og filter');
      expect(toggle.textContent).toBe('');
    } finally {
      restore();
    }
  });

  it('sier fortsatt om panelet er åpent, og hva den styrer', () => {
    // Ikonet endrer ingenting for en skjermleser: navnet er den samme
    // strengen som før, og `aria-expanded` og `aria-controls` står.
    const restore = openShell();
    try {
      const toggle = railToggle();

      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(toggle.getAttribute('aria-controls')).toBeTruthy();
    } finally {
      restore();
    }
  });

  it('har en tooltip med den samme strengen', () => {
    // @digdir/designsystemet-web skriver `data-tooltip` inn i `aria-label` på
    // et element uten egen tekst, så de to må si det samme — ellers ville
    // navnet blitt byttet ut et øyeblikk etter render.
    const restore = openShell();
    try {
      const toggle = railToggle();
      expect(toggle.getAttribute('data-tooltip')).toBe(toggle.getAttribute('aria-label'));
    } finally {
      restore();
    }
  });

  it('er ikonknapp i begge sidepanelene, ikke bare det som rant over', () => {
    // Samme rad, samme design. Et panelhode som leste ulikt i de to ville
    // vært to design for én ting.
    const restore = openShell();
    try {
      act(() => screen.getByRole('button', { name: /^Vis kilder/ }).click());

      const sources = screen.getByRole('button', { name: 'Skjul kilder' });
      expect(sources.getAttribute('aria-label')).toBe('Skjul kilder');
      expect(sources.textContent).toBe('');
    } finally {
      restore();
    }
  });
});

describe('utenfor et skall', () => {
  it('tegner ingenting, i stedet for å legge knappen midt i en forhåndsvisning', () => {
    // Motsatt av `ViewHead`, som tegner seg der den står når det ikke finnes
    // noe skall. Det er riktig for et klebrig hode — en forhåndsvisning uten
    // det ville løyet om panelet — og galt her: dette er skallets krom, og en
    // «Tråder»-knapp løs i en forhåndsvisning står et sted appen aldri setter
    // den.
    render(
      <PanelHead>
        <button type="button">Tråder</button>
      </PanelHead>,
    );

    expect(screen.queryByRole('button', { name: 'Tråder' })).toBeNull();
  });
});
