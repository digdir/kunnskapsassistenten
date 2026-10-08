import { useSyncExternalStore } from 'react';

/**
 * How wide the window is, in CSS pixels.
 *
 * The layout needs an actual number and not only the breakpoint
 * `useNarrowViewport` answers: a panel the reader has dragged wider has to be
 * drawn at what fits, and «what fits» is arithmetic on the window's width.
 * See `fittedWidths` in viewModel.ts.
 *
 * The layout viewport's width, `document.documentElement.clientWidth`, and
 * not `innerWidth`. On a phone `innerWidth` is the VISUAL viewport, and the
 * browser zooms that out when the page is wider than the screen. The row was
 * summed from it, so a row that was too wide made the window report itself
 * wider, which kept the row too wide: switching from 1440 to a 393 px phone
 * in the same session left the page at 774 × 1678 CSS px and a zoom of 0.51,
 * with the shell 852 px tall at the top of it and the rest empty — the dark
 * field under the panels. A rotated phone did the same (measured 06.10 with
 * Chrome's device emulation). `clientWidth` is the width the media queries
 * answer against, and pinch zoom and zoom-out leave it alone.
 *
 * Read off the document rather than measuring the shell: the shell IS the
 * window here — `.shell` fills the page and tests/e2e/layout.spec.ts asserts
 * that the document never grows its own scrollbar — and a ResizeObserver on
 * an element whose width this very number decides is a loop waiting to
 * happen.
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
  return document.documentElement.clientWidth;
}

export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
