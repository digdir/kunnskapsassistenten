import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';
import { resetFooterMode, setFooterMode } from './footerMode';

/**
 * Foten sist i rullefeltet og rullende med lista, som er standard, eller
 * festet under rullefeltet når det er valgt i #innstillinger
 * (digdir/kunnskapsassistenten#123). Her måles hvor den havner, ikke hvordan
 * den ser ut; tallene for begge står i PR-en.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function open(width = 1440) {
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

const foot = () => document.querySelector('.sidebar-footer');
const scroller = () => document.querySelector('.primary-sidebar .sidebar-content');

beforeEach(() => {
  localStorage.clear();
  resetFooterMode();
  resetViewport();
});

describe('hvor foten står', () => {
  it('står sist inne i rullefeltet som standard', () => {
    open();

    const region = scroller();
    expect(foot()).not.toBeNull();
    // Sist, ikke hvor som helst: den skal følge etter den siste tråden.
    expect(region?.lastElementChild).toBe(foot());
  });

  it('står utenfor rullefeltet når valget er «festet»', () => {
    setFooterMode('pinned');
    open();

    expect(foot()).not.toBeNull();
    expect(scroller()?.contains(foot()!)).toBe(false);
  });

  it('flytter seg når menyen endrer valget, uten at siden lastes på nytt', () => {
    open();
    expect(scroller()?.contains(foot()!)).toBe(true);

    act(() => {
      setFooterMode('pinned');
    });

    expect(scroller()?.contains(foot()!)).toBe(false);
  });

  it('har de samme lenkene i begge, og bare ett sett', () => {
    setFooterMode('scrolls');
    open();

    const links = screen.getByRole('list', { name: 'Om Kunnskapsassistenten' });
    expect(within(links).getAllByRole('link')).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);
  });

  it('står ikke på skinnen, uansett valg', () => {
    setFooterMode('scrolls');
    open();

    act(() => {
      screen.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    });

    // Skjult panel: innholdet er `hidden`, og da står ingenting å tabbe til.
    expect(scroller()?.hasAttribute('hidden')).toBe(true);
  });
});

/**
 * Skuffen, som er panelet under 1139. Raden hadde en slik test fra før; denne
 * lukker hullet KA CC fant på #231: med foten tegnet begge steder i skuffen
 * var alle 22 testene grønne.
 */
describe('foten i skuffen', () => {
  function openDrawer(mode?: 'pinned' | 'scrolls') {
    if (mode) setFooterMode(mode);
    open(440);
    act(() => {
      screen.getByRole('button', { name: 'Vis tråder og filter' }).click();
    });
    return screen.getByRole('dialog', { name: 'Tråder og filter' });
  }

  it('står i skuffen, og bare én gang, i begge modusene', () => {
    for (const mode of ['pinned', 'scrolls'] as const) {
      const drawer = openDrawer(mode);

      // Én fot, én lenkeliste, én fargemodus. To av noe her er feilen:
      // foten tegnet både i rullefeltet og under det.
      expect(drawer.querySelectorAll('.sidebar-footer')).toHaveLength(1);
      expect(within(drawer).getAllByRole('list', { name: 'Om Kunnskapsassistenten' })).toHaveLength(
        1,
      );
      expect(within(drawer).getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);

      cleanup();
      resetFooterMode();
    }
  });

  it('ligger i rullefeltet i skuffen som standard', () => {
    const drawer = openDrawer();

    const region = drawer.querySelector('.sidebar-content');
    const inDrawer = drawer.querySelector('.sidebar-footer');
    expect(region?.contains(inDrawer!)).toBe(true);
    expect(region?.lastElementChild).toBe(inDrawer);
  });

  it('ligger utenfor rullefeltet i skuffen når valget er «festet»', () => {
    const drawer = openDrawer('pinned');

    const region = drawer.querySelector('.sidebar-content');
    const inDrawer = drawer.querySelector('.sidebar-footer');
    expect(inDrawer).not.toBeNull();
    expect(region?.contains(inDrawer!)).toBe(false);
  });
});
