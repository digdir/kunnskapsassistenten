import { useSyncExternalStore } from 'react';
import { useFlag } from '../flags';
import { compactViewportQuery } from './viewModel';

/**
 * True while the rails stand in a bar above the answer column instead of
 * beside it: the flag `mobile-top-row` is on (digdir/kunnskapsassistenten#120)
 * and the window is narrower than `compactMaxViewport`.
 *
 * The window half has the same shape as `useDrawerMode`, and for the same
 * reasons: `matchMedia` read through `useSyncExternalStore`, so the first paint
 * on a phone is already the bar and the rails are not drawn for a frame and
 * then moved.
 *
 * Like drawer mode it changes no state, only where things are drawn. The
 * panels are still collapsed or open, the buttons still say so with
 * `aria-expanded`, and the drawers are the same drawers. 774 is below 1139,
 * so wherever this is true, drawer mode is true as well.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(compactViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(compactViewportQuery).matches;
}

export function useCompactMode(): boolean {
  const narrow = useSyncExternalStore(subscribe, getSnapshot);
  const on = useFlag('mobile-top-row');
  return on && narrow;
}
