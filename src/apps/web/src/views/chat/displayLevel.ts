// How much of the assistant's own work the answer shows (issue 88):
// `detaljert` adds search strings, hit counts and times. A module store and
// not a context, because it is read from places that are not components.

import { useSyncExternalStore } from 'react';

export type DisplayLevel = 'standard' | 'detaljert';

export const DISPLAY_LEVEL_STORAGE_KEY = 'ka.display-level';

/** What opens the menu. Written down once, because the README names it and
    the chat view matches on it. */
export const SETTINGS_HASH = '#innstillinger';

const DEFAULT_LEVEL: DisplayLevel = 'standard';

function isDisplayLevel(value: unknown): value is DisplayLevel {
  return value === 'standard' || value === 'detaljert';
}

/** Storage can THROW rather than return null — Safari in private mode, any
    browser with site data blocked — and a display level is never worth a
    blank page. Same guard as `colorScheme.ts`. */
function readStored(): DisplayLevel | undefined {
  try {
    const stored = localStorage.getItem(DISPLAY_LEVEL_STORAGE_KEY);
    return isDisplayLevel(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

// Read once and kept, so `getSnapshot` hands React the same value twice:
// reading storage per call makes `useSyncExternalStore` loop, because the
// value is equal but the read is a side effect on every render.
let current: DisplayLevel | undefined;

const listeners = new Set<() => void>();

export function getDisplayLevel(): DisplayLevel {
  current ??= readStored() ?? DEFAULT_LEVEL;
  return current;
}

export function setDisplayLevel(level: DisplayLevel): DisplayLevel {
  if (!isDisplayLevel(level)) {
    throw new Error(`Ukjent visningsnivå: ${String(level)}. Bruk 'standard' eller 'detaljert'.`);
  }
  current = level;
  try {
    localStorage.setItem(DISPLAY_LEVEL_STORAGE_KEY, level);
  } catch {
    // Ignored on purpose: the level still applies for this page load.
  }
  for (const listener of [...listeners]) listener();
  return level;
}

export function subscribeToDisplayLevel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests, which share one module across cases. */
export function resetDisplayLevel(): void {
  current = undefined;
}

/** The level, and it re-renders whoever reads it when the menu changes it. */
export function useDisplayLevel(): DisplayLevel {
  return useSyncExternalStore(subscribeToDisplayLevel, getDisplayLevel, () => DEFAULT_LEVEL);
}
