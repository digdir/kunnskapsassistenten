import { render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * The shell below 1139, where an open sidebar is drawn over the answer column.
 *
 * What is measured here is the STATE and the MARKUP: which panel is a rail,
 * where the panel is drawn, what the toggle reports, and that crossing the
 * breakpoint does not hand the reader a modal they never asked for.
 *
 * What is NOT measured here is what makes a modal a modal — the focus trap,
 * the inert background, Escape, and the absence of horizontal scrolling. jsdom
 * has no top layer and does no layout, so the `<dialog>` shim in
 * src/test/setup.ts can only give the `open` attribute. Those four are the
 * browser's work and are measured in a browser, in tests/e2e/drawers.spec.ts.
 */
/*
 * jsdom has no ResizeObserver, and the chat view in the answer column watches
 * its own height with one. A no-op is the right answer in a document that
 * never paints, and it has nothing to do with what is under test here.
 *
 * Local to this file rather than in src/test/setup.ts, for the reason
 * App.test.tsx gives: a global stub would quietly hide a real missing guard
 * from the tests that mount one view at a time.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function open({ width }: { width: number }) {
  setViewportWidth(width);
  render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Shell />} />
        </Routes>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const drawerFor = (name: string) => screen.queryByRole('dialog', { name });
const show = (panel: string) => screen.getByRole('button', { name: `Vis ${panel}` });

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('over brytepunktet', () => {
  it('tegner ingen skuff i det hele tatt', () => {
    open({ width: 1440 });
    expect(screen.queryByRole('dialog')).toBeNull();
    // Og navigasjonspanelet står åpent ved siden av svaret, som før.
    expect(screen.getByRole('button', { name: 'Skjul tråder og filter' })).toBeDefined();
  });
});

describe('under brytepunktet', () => {
  it('lander med begge sidekolonner foldet bort', () => {
    // En skuff er modal. En som ble båret over brytepunktet åpen ville vært en
    // dialog over svaret, med tastaturet fanget, som leseren aldri ba om.
    open({ width: 1024 });

    expect(show('tråder og filter')).toBeDefined();
    expect(show('kilder')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('åpner skuffa fra railknappen, og lukker den igjen', () => {
    open({ width: 1024 });

    act(() => show('tråder og filter').click());
    const drawer = drawerFor('Tråder og filter');
    expect(drawer).not.toBeNull();
    // Innholdet ligger i skuffa, ikke igjen på rada.
    expect(within(drawer!).getByRole('button', { name: /Lukk tråder og filter/ })).toBeDefined();

    act(() => screen.getByRole('button', { name: 'Lukk tråder og filter' }).click());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(show('tråder og filter')).toBeDefined();
  });

  it('lar railknappen fortsette å melde om panelet er åpent', () => {
    // `data-collapsed` på landemerket handler om hva som står PÅ RADA;
    // `aria-expanded` handler fortsatt om panelet er åpent, og under
    // brytepunktet slutter de to å være det samme spørsmålet.
    open({ width: 1024 });
    expect(show('tråder og filter').getAttribute('aria-expanded')).toBe('false');

    act(() => show('tråder og filter').click());
    expect(
      screen.getByRole('button', { name: 'Skjul tråder og filter' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('lar railknappen stå som rail-knapp mens skuffa er åpen', () => {
    // Målt i nettleseren 17.09: knappen tegnet seg med hele teksten sin mens
    // skuffa sto åpen, ble 100 px bred i en rail på 67, og dyttet sida 46 px
    // forbi vindusranda — en vannrett rullelist fra nettopp den regelen som
    // skulle fjerne en.
    //
    // «Står det en rail her» og «er panelet åpent» var det samme spørsmålet
    // fram til skuff-modus. Presentasjonen følger det første, `aria-expanded`
    // og Vis/Skjul-ordet det andre.
    open({ width: 1024 });
    act(() => show('tråder og filter').click());

    const rail = screen.getByRole('button', { name: 'Skjul tråder og filter' });
    expect(rail.textContent).toBe('');
    expect(rail.getAttribute('aria-label')).toBe('Skjul tråder og filter');
  });

  it('har verken skille eller breddeknapper: en skuff har ingen kant å dele', () => {
    open({ width: 1024 });
    act(() => show('tråder og filter').click());

    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByRole('button', { name: /Gjør .* bredere/ })).toBeNull();
  });

  it('holder bare én skuff åpen om gangen', () => {
    // Ikke en egen regel: regel B gjelder allerede under 1440, og 1139 er
    // under 1440. To skuffer kan ikke være åpne fordi to sidekolonner ikke kan.
    open({ width: 1024 });

    act(() => show('tråder og filter').click());
    expect(drawerFor('Tråder og filter')).not.toBeNull();

    act(() => show('kilder').click());
    expect(drawerFor('Kilder')).not.toBeNull();
    expect(drawerFor('Tråder og filter')).toBeNull();
  });
});

describe('over brytepunktet og tilbake', () => {
  it('folder et åpent panel bort når vinduet krymper forbi 1139', () => {
    open({ width: 1440 });
    expect(screen.getByRole('button', { name: 'Skjul tråder og filter' })).toBeDefined();

    act(() => setViewportWidth(1024));

    expect(show('tråder og filter')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('åpner ingenting av seg selv når vinduet vokser tilbake', () => {
    // Samme grunn som regelen om én sidekolonne: et panel som åpner seg selv
    // gjør om på et valg brukeren tok.
    open({ width: 1024 });
    act(() => setViewportWidth(1440));

    expect(show('tråder og filter')).toBeDefined();
    expect(show('kilder')).toBeDefined();
  });

  it('tar skuffa tilbake til rada når vinduet vokser mens den står åpen', () => {
    open({ width: 1024 });
    act(() => show('tråder og filter').click());
    expect(drawerFor('Tråder og filter')).not.toBeNull();

    act(() => setViewportWidth(1440));

    // Ikke lenger en dialog, men fortsatt åpent: panelet flyttet seg fra over
    // svaret til ved siden av det, og leseren mistet ingenting.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Skjul tråder og filter' })).toBeDefined();
  });
});
