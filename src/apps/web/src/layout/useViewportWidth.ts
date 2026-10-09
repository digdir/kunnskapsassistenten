import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function getSnapshot(): number {
  return document.documentElement.clientWidth;
}

/**
 * The layout viewport's width (`clientWidth`), for fitting dragged panels. Not `innerWidth`: on a
 * phone that is the visual viewport, which zooms out when the page is too wide and keeps it so.
 * Not a ResizeObserver on the shell: its width depends on this number, so it would loop.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}
