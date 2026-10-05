import { useSyncExternalStore } from 'react';
import { drawerViewportQuery } from './viewModel';

/**
 * True while an open sidebar has to be drawn OVER the answer column rather
 * than beside it.
 *
 * The same shape as `useNarrowViewport`, and for the same reasons —
 * `matchMedia` read through `useSyncExternalStore`, so the first paint in a
 * narrow window is already the drawer and nothing is shown beside the answer
 * for a frame and then moved.
 *
 * But it answers a different question, and the difference is worth keeping
 * straight. `useNarrowViewport` is about COLLAPSED STATE: below 1440 only one
 * sidebar may be open, and the provider closes one. This is about WHERE the
 * open one is drawn, and it changes no state at all — `collapsed` still means
 * what it meant, `aria-expanded` still reports it, and the rails stay put.
 *
 * Because 1139 is below 1440, the one-sidebar rule is already in force
 * wherever this is true. That is why «én skuff om gangen» needs no rule of
 * its own: two drawers cannot be open at once because two sidebars cannot.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(drawerViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(drawerViewportQuery).matches;
}

export function useDrawerMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
