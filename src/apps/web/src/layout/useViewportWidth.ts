import { useSyncExternalStore } from 'react';

/**
 * How wide the window is, in CSS pixels.
 *
 * The layout needs an actual number and not only the breakpoint
 * `useNarrowViewport` answers: a panel the reader has dragged wider has to be
 * drawn at what fits, and «what fits» is arithmetic on the window's width.
 * See `fittedWidths` in viewModel.ts.
 *
 * `innerWidth` rather than measuring the shell: the shell IS the window here
 * — `.shell` fills the page and tests/e2e/layout.spec.ts asserts that the
 * document never grows its own scrollbar — and a ResizeObserver on an element
 * whose width this very number decides is a loop waiting to happen.
 *
 * `useSyncExternalStore` for the same reason as the media query: the window
 * is external state, and reading it during render means the first paint after
 * a resize is already right. No server snapshot; this app renders in the
 * browser only.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function getSnapshot(): number {
  return window.innerWidth;
}

export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
