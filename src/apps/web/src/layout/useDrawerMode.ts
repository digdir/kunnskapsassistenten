import { useSyncExternalStore } from 'react';
import { drawerViewportQuery } from './viewModel';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(drawerViewportQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(drawerViewportQuery).matches;
}

/**
 * True while an open sidebar is drawn OVER the answer column rather than beside it. It changes
 * where the open sidebar is drawn, never collapsed state (that is `useNarrowViewport`). Its
 * breakpoint is below the narrow one, so two drawers can never be open at once.
 */
export function useDrawerMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
