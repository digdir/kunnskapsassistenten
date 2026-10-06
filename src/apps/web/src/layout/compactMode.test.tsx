import { act, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFlag } from '../flags';
import { resetFlags } from '../flags/flags';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';
import { useCompactMode } from './useCompactMode';
import {
  compactMaxViewport,
  defaultLayout,
  drawerMaxViewport,
  layoutStyle,
  sidebarSlots,
} from './viewModel';

/**
 * Panelene som en rad øverst på telefon, bak flagget `mobile-top-row`
 * (digdir/kunnskapsassistenten#120).
 *
 * Av som standard: uten flagget er skallet det samme som før, med skinner på
 * sidene. Med flagget og et vindu under 774 står de to knappene i en rad
 * øverst, og hovedkolonnen får hele bredden.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  localStorage.clear();
  resetFlags();
});

afterEach(() => {
  resetViewport();
  resetFlags();
});

function openShell(width: number) {
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
  return document.querySelector<HTMLElement>('.shell')!;
}

describe('compactMaxViewport', () => {
  it('er to skinner og hovedkolonnens gulv: 67 + 640 + 67', () => {
    expect(compactMaxViewport).toBe(774);
    expect(compactMaxViewport).toBeLessThan(drawerMaxViewport);
  });
});

describe('useCompactMode', () => {
  it('er av uten flagget, også på telefon', () => {
    setViewportWidth(393);
    const { result } = renderHook(() => useCompactMode());

    expect(result.current).toBe(false);
  });

  it('er på med flagget og et vindu under 774', () => {
    setFlag('mobile-top-row', true);
    setViewportWidth(393);
    const { result } = renderHook(() => useCompactMode());

    expect(result.current).toBe(true);
  });

  it('er av med flagget når vinduet er 774 eller bredere', () => {
    setFlag('mobile-top-row', true);
    setViewportWidth(774);
    const { result } = renderHook(() => useCompactMode());

    expect(result.current).toBe(false);
  });

  it('følger flagget og vinduet uten at siden lastes på nytt', () => {
    setViewportWidth(393);
    const { result } = renderHook(() => useCompactMode());
    expect(result.current).toBe(false);

    act(() => setFlag('mobile-top-row', true));
    expect(result.current).toBe(true);

    act(() => setViewportWidth(1024));
    expect(result.current).toBe(false);

    act(() => setViewportWidth(393));
    expect(result.current).toBe(true);
  });
});

describe('skallet med raden øverst', () => {
  it('er som før uten flagget', () => {
    const shell = openShell(393);

    expect(shell.hasAttribute('data-compact')).toBe(false);
    expect(shell.style.getPropertyValue('--ka-main-min-width')).toBe('259px');
  });

  it('gir hovedkolonnen hele bredden med flagget på', () => {
    setFlag('mobile-top-row', true);
    const shell = openShell(393);

    expect(shell.hasAttribute('data-compact')).toBe(true);
    expect(shell.style.getPropertyValue('--ka-main-min-width')).toBe('393px');
  });

  it('beholder begge knappene, som åpner de samme skuffene', () => {
    setFlag('mobile-top-row', true);
    openShell(393);

    const threads = screen.getByRole('button', { name: 'Vis tråder og filter' });
    expect(screen.getByRole('button', { name: 'Vis kilder' })).toBeTruthy();
    expect(threads.getAttribute('aria-expanded')).toBe('false');

    act(() => threads.click());

    expect(screen.getByRole('dialog', { name: 'Tråder og filter' })).toBeTruthy();
  });

  it('har ingen rad på desktop, selv med flagget på', () => {
    setFlag('mobile-top-row', true);
    const shell = openShell(1440);

    expect(shell.hasAttribute('data-compact')).toBe(false);
  });
});

describe('raden og vinduet med raden øverst, fra 280 til 773 px', () => {
  it('gir hovedkolonnen en minstebredde som aldri er over vinduet', () => {
    // The floor is min(640, window), and nothing else is on the row: the rails
    // are in the bar. The grid's `1fr` gives the column the rest, which the
    // end-to-end test measures (tests/e2e/viewport-fit.spec.ts).
    const found: string[] = [];
    for (let viewport = 280; viewport < compactMaxViewport; viewport += 1) {
      const style = layoutStyle(defaultLayout, viewport, true, true);
      const main = Number.parseFloat(style['--ka-main-min-width']);
      if (main !== Math.min(640, viewport)) {
        found.push(`${viewport} px: minstebredden er ${main}`);
      }
      for (const slot of sidebarSlots) {
        const width = Number.parseFloat(style[`--ka-${slot}-width`]);
        if (width !== 67) found.push(`${viewport} px: ${slot} er ${width} i raden`);
      }
    }

    expect(found.slice(0, 10), `${found.length} tilfeller`).toEqual([]);
  });
});
