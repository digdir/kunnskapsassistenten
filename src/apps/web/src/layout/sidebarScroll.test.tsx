import { act, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetViewport } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * What the shell does with the answer from `useScrollTabStop`: the sidebars'
 * scrolling region becomes a named tab stop when it needs one, and stays one
 * while it holds the focus.
 *
 * The answer itself — when a region needs its own stop — is the hook's, and
 * is tested there with sizes and content that change (useScrollTabStop.test).
 * Here it is handed in, so this file is about the wiring alone and does not
 * depend on what the views happen to put in the panel.
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
          <Route path="/" element={<Shell />} />
        </Routes>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const region = () => screen.queryByRole('group', { name: 'Tråder og filter' });
const content = () => document.querySelector('.primary-sidebar .sidebar-content');

beforeEach(() => {
  localStorage.clear();
  resetViewport();
  answer.set(false);
});

describe('the navigation panel’s scrolling region', () => {
  it('is no tab stop when it does not need one', () => {
    open();

    expect(region()).toBeNull();
    expect(content()?.hasAttribute('tabindex')).toBe(false);
  });

  it('is a tab stop, named after the panel, when it needs one', () => {
    open();

    act(() => answer.set(true));

    expect(region()?.getAttribute('tabindex')).toBe('0');
    expect(region()?.classList.contains('ds-focus--inset')).toBe(true);
  });

  it('keeps the focus it has when it stops needing a stop, and lets go on blur', () => {
    open();
    act(() => answer.set(true));
    act(() => region()?.focus());

    act(() => answer.set(false));

    // Still focusable while it holds the focus: taking that away would hand
    // the focus to <body>.
    expect(document.activeElement).toBe(region());

    act(() => (document.activeElement as HTMLElement).blur());

    expect(region()).toBeNull();
  });
});
