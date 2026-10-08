import { act, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetViewport } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * What the shell does with the answer from `useScrollTabStop` for the answer
 * column, the same way sidebarScroll.test.tsx covers the panels.
 *
 * It matters from issue 85d on: `/om-prosjektet` is the first page in
 * here made of prose alone, and a region that scrolls with nothing to tab to
 * cannot be scrolled from the keyboard at all (WCAG 2.1.1).
 *
 * When a region needs a stop is the hook's answer and is tested there. Here
 * it is handed in, so this file is about the wiring alone.
 */
const answer = vi.hoisted(() => {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: boolean) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('./useScrollTabStop', () => ({
  useScrollTabStop: (): [boolean, (element: HTMLElement | null) => void] => [
    useSyncExternalStore(answer.subscribe, answer.get),
    () => {},
  ],
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function open() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Shell routeOwnsMain />} />
        </Routes>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const main = () => screen.getByRole('main');

beforeEach(() => {
  localStorage.clear();
  resetViewport();
  answer.set(false);
});

describe('the answer column’s scrolling region', () => {
  it('is no tab stop when it does not need one', () => {
    open();

    expect(main().hasAttribute('tabindex')).toBe(false);
  });

  it('is a tab stop when it needs one, and stays the main landmark', () => {
    open();

    act(() => answer.set(true));

    expect(main().getAttribute('tabindex')).toBe('0');
    expect(main().classList.contains('ds-focus--inset')).toBe(true);
    // No role and no name of its own: `main` is already a landmark, and a
    // second name here would be the page announced twice.
    expect(main().hasAttribute('role')).toBe(false);
    expect(main().hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the focus it has when it stops needing a stop, and lets go on blur', () => {
    open();
    act(() => answer.set(true));
    act(() => main().focus());

    act(() => answer.set(false));

    // Still focusable while it holds the focus: taking that away would hand
    // the focus to <body>, above the skip link.
    expect(document.activeElement).toBe(main());

    act(() => (document.activeElement as HTMLElement).blur());

    expect(main().hasAttribute('tabindex')).toBe(false);
  });

  it('is still what the skip link points at', () => {
    open();

    expect(screen.getByRole('link', { name: 'Hopp til hovedinnhold' }).getAttribute('href')).toBe(
      '#main-content',
    );
    expect(main().id).toBe('main-content');
  });
});
