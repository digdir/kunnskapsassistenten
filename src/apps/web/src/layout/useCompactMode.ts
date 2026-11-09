import { useSyncExternalStore } from 'react';
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
 * True while the rails stand in a bar above the answer column, below `compactMaxViewport`
 * (digdir/kunnskapsassistenten#120). Read during render so the first paint on a phone is already
 * the bar; it changes where things are drawn, never collapsed state.
 */
export function useCompactMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
