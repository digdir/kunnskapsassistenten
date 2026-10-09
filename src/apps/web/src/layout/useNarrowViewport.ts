import { useSyncExternalStore } from 'react';
import { narrowViewportQuery } from './viewModel';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(narrowViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(narrowViewportQuery).matches;
}

/**
 * True while the window is too narrow for both sidebars to be open at once. `matchMedia`, not
 * CSS, because it changes collapsed state, which the buttons report with `aria-expanded`. Read
 * with `useSyncExternalStore` so the first paint is already right.
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
