import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FLAGS_STORAGE_KEY } from '../flags';
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
 * The panel buttons as a row at the top on a phone (digdir/kunnskapsassistenten#120).
 *
 * Below 774 the two buttons stand in a row above the answer column, and the column gets the
 * whole width. From 774 the rails are at the sides, as before. No flag: it was the trial
 * `mobile-top-row`, and a browser that still has it stored gets the same page as one that never
 * had it.
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

/** What a browser that tried the flag still has stored. */
function storeRetiredFlag() {
  localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(['mobile-top-row']));
  resetFlags();
}

describe('compactMaxViewport', () => {
  it('is two rails and the answer column floor: 67 + 640 + 67', () => {
    expect(compactMaxViewport).toBe(774);
    expect(compactMaxViewport).toBeLessThan(drawerMaxViewport);
  });
});

describe('useCompactMode', () => {
  it('is on below 774, with no flag', () => {
    setViewportWidth(393);
    const { result } = renderHook(() => useCompactMode());

    expect(result.current).toBe(true);
  });

  it('is off at 774 and wider', () => {
    setViewportWidth(774);
    const { result } = renderHook(() => useCompactMode());

    expect(result.current).toBe(false);
  });

  it('follows the window without a reload', () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useCompactMode());
    expect(result.current).toBe(false);

    act(() => setViewportWidth(393));
    expect(result.current).toBe(true);

    act(() => setViewportWidth(1024));
    expect(result.current).toBe(false);
  });

  it('is the same with the retired flag stored', () => {
    storeRetiredFlag();
    setViewportWidth(393);
    const { result } = renderHook(() => useCompactMode());
    expect(result.current).toBe(true);

    act(() => setViewportWidth(1440));
    expect(result.current).toBe(false);
  });
});

describe('the shell with the row at the top', () => {
  it('gives the answer column the whole width on a phone', () => {
    const shell = openShell(393);

    expect(shell.hasAttribute('data-compact')).toBe(true);
    expect(shell.style.getPropertyValue('--ka-main-min-width')).toBe('393px');
  });

  it('keeps both buttons, which open the same drawers', () => {
    openShell(393);

    const threads = screen.getByRole('button', { name: 'Vis tråder og filter' });
    expect(screen.getByRole('button', { name: 'Vis kilder' })).toBeTruthy();
    expect(threads.getAttribute('aria-expanded')).toBe('false');

    act(() => threads.click());

    expect(screen.getByRole('dialog', { name: 'Tråder og filter' })).toBeTruthy();
  });

  it('has no row at 774 and wider', () => {
    for (const width of [774, 1440]) {
      const shell = openShell(width);

      expect(shell.hasAttribute('data-compact'), `${width} px`).toBe(false);
      cleanup();
    }
  });

  it('draws the same with the retired flag stored', () => {
    storeRetiredFlag();
    const shell = openShell(393);

    expect(shell.hasAttribute('data-compact')).toBe(true);
    expect(shell.style.getPropertyValue('--ka-main-min-width')).toBe('393px');
  });
});

describe('the row and the window with the row at the top, from 280 to 773 px', () => {
  it('gives the answer column a minimum width never above the window', () => {
    // The floor is min(640, window), and nothing else is on the row: the rails
    // are in the bar, keep their rail state in the model, and are sized to
    // their buttons there by CSS. The grid's `1fr` gives the column the rest,
    // and the button insets, which the end-to-end test measures
    // (tests/e2e/viewport-fit.spec.ts).
    const found: string[] = [];
    for (let viewport = 280; viewport < compactMaxViewport; viewport += 1) {
      const style = layoutStyle(defaultLayout, viewport, true, true);
      const main = Number.parseFloat(style['--ka-main-min-width']);
      if (main !== Math.min(640, viewport)) {
        found.push(`${viewport} px: the minimum width is ${main}`);
      }
      for (const slot of sidebarSlots) {
        const width = Number.parseFloat(style[`--ka-${slot}-width`]);
        if (width !== 67) found.push(`${viewport} px: ${slot} is ${width} in the row`);
      }
    }

    expect(found.slice(0, 10), `${found.length} cases`).toEqual([]);
  });
});
