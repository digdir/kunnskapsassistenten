import { render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { ViewHead } from './ViewHead';
import { ViewHeadContext } from './viewHeadContext';

/**
 * The shell's end of the place, in miniature: a box, and the context pointing
 * at it. The real one is in Shell.tsx; this is the same two lines without a
 * layout around them.
 */
function Region({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  return (
    <div className="region">
      <div className="view-head" data-testid="box" ref={setElement} />
      <ViewHeadContext value={{ element }}>{children}</ViewHeadContext>
    </div>
  );
}

describe('ViewHead', () => {
  it('draws the head where it stands when there is no shell', () => {
    // The preview pages and most unit tests mount a view on its own. A head
    // that vanished there would make every preview lie about the panel.
    render(
      <ViewHead>
        <p>Dokumenter fra Kudos</p>
      </ViewHead>,
    );

    const head = document.querySelector('.view-head');
    expect(head).toBeTruthy();
    expect(head?.textContent).toBe('Dokumenter fra Kudos');
  });

  it('puts the head in the shell’s box, and draws no second one', () => {
    render(
      <Region>
        <div className="view">
          <ViewHead>
            <p>Dokumenter fra Kudos</p>
          </ViewHead>
          <p>Fasetter</p>
        </div>
      </Region>,
    );

    expect(screen.getByTestId('box').textContent).toBe('Dokumenter fra Kudos');
    expect(document.querySelectorAll('.view-head')).toHaveLength(1);
    // And it left the view, so nothing is drawn twice.
    expect(document.querySelector('.view')?.textContent).toBe('Fasetter');
  });

  it('leaves the box empty when no view fills it, so it draws no line', () => {
    // `.view-head:empty` is what hides it, and `:empty` means no child nodes
    // at all. The box is mounted either way — it has to exist before a view
    // can render into it.
    render(
      <Region>
        <p>Ingen ting å feste</p>
      </Region>,
    );

    expect(screen.getByTestId('box').childNodes).toHaveLength(0);
  });

  it('keeps the tab order the view wrote', () => {
    /*
     * The reason the head may hold controls at all. React sends events
     * through a portal along the React tree; the browser tabs the DOM. A head
     * written FIRST in the view is drawn first in the region, so the two
     * agree — and the button in it is reachable rather than pinned on top of.
     */
    render(
      <Region>
        <div className="view">
          <ViewHead>
            <button type="button">Tråder</button>
          </ViewHead>
          <button type="button">Dokumenttyper</button>
        </div>
      </Region>,
    );

    const order = [...document.querySelectorAll('button')].map((button) => button.textContent);
    expect(order).toEqual(['Tråder', 'Dokumenttyper']);
  });
});

/*
 * Two things jsdom does not have, and mounting the whole app needs both. Same
 * stubs and the same reason as src/App.test.tsx.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

describe('view-hodet i skallet', () => {
  function openFrontPage() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
  }

  it('gir hver plass en boks først i den rullende regionen', () => {
    openFrontPage();

    for (const scroller of document.querySelectorAll('.sidebar-content')) {
      // First, and that is the whole point: a pinned head covers whatever is
      // above it in the same scrolling box, the tab order included. See
      // viewHeadContext.ts for the measurement from #55.
      expect(scroller.firstElementChild?.className).toBe('view-head');
    }

    /*
     * Ett hopp til i hovedkolonnen: `main` er rulleregionen og fyller hele
     * feltet mellom panelene, mens `.main-column` inni er lesebredden. Hodet
     * er fortsatt det første som står foran innholdet — garantien er den
     * samme, boksen mellom er bare det som gjør at hjulet virker i margen òg.
     */
    const main = document.querySelector('main');
    expect(main?.firstElementChild?.className).toBe('main-column');
    expect(main?.querySelector('.main-column')?.firstElementChild?.className).toBe('view-head');
  });

  it('holder overskriften og korpuslinja i navigasjonspanelets hode', () => {
    openFrontPage();

    const sidebar = document.querySelector('nav.primary-sidebar');
    const head = sidebar?.querySelector('.view-head') as HTMLElement;

    expect(head).toBeTruthy();
    expect(head.contains(screen.getByRole('heading', { name: 'Filtrering' }))).toBe(true);
    expect(head.textContent).toContain('Kudos');

    /*
     * «Tråder» sto her til #119. Den hører til PANELET og ikke til det som er
     * i det — den sier hvilken av de to visningene panelet viser, slik
     * «Skjul tråder og filter» ved siden av sier om panelet er åpent — så den
     * flyttet til panelraden, og tok 48 px ut av et hode som tok 137 av
     * rullevinduet. Se PanelHead.test.tsx for hva som måles der.
     */
    const threads = screen.getByRole('button', { name: 'Tråder' });
    expect(head.contains(threads)).toBe(false);
    expect(threads.closest('.panel-head-slot')).not.toBeNull();
  });

  it('har bare overskriften i hodet i kildepanelet før det finnes et svar', () => {
    openFrontPage();

    // Nothing has been asked, so there is no answer selector and no search to
    // pin. «Kilder» is there from the first render, visible, as Figma has it
    // and as the navigation panel has «Filtrering» (30.09, answer S1).
    const head = document.querySelector('aside.secondary-sidebar .view-head');
    expect(head?.querySelector('h2')?.textContent).toBe('Kilder');
    expect(head?.querySelector('input')).toBeNull();
  });
});
