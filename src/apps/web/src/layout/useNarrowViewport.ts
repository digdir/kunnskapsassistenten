import { useSyncExternalStore } from 'react';
import { narrowViewportQuery } from './viewModel';

/**
 * True while the window is too narrow for both sidebars to be open at once.
 *
 * `matchMedia` rather than a CSS media query, and that is the decision of
 * 2026-09-14 rather than a preference: what the breakpoint changes is
 * COLLAPSED STATE, and collapsed state is something the provider owns and the
 * toggle buttons report with `aria-expanded`. A CSS rule that hid a panel at a
 * width would leave its button saying the panel is open, and a screen reader
 * user would be told to collapse something that is not there. Width can be
 * left to CSS; state cannot.
 *
 * `useSyncExternalStore` rather than a `useState` and an effect, because the
 * media query IS external state and this form reads it during render. With an
 * effect the first paint on a narrow window would be the wide layout, and the
 * sources panel would visibly close itself a frame later.
 *
 * No server snapshot: this app renders in the browser only. See src/main.tsx.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(narrowViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(narrowViewportQuery).matches;
}

export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
