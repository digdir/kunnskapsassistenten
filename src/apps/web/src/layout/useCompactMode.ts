import { useSyncExternalStore } from 'react';
import { useFlag } from '../flags';
import { compactViewportQuery } from './viewModel';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(compactViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(compactViewportQuery).matches;
}

/**
 * True while the rails stand in a bar above the answer column (flag `mobile-top-row`,
 * digdir/kunnskapsassistenten#120, below `compactMaxViewport`). Read during render so the first
 * paint on a phone is already the bar; it changes where things are drawn, never collapsed state.
 */
export function useCompactMode(): boolean {
  const narrow = useSyncExternalStore(subscribe, getSnapshot);
  const on = useFlag('mobile-top-row');
  return on && narrow;
}
