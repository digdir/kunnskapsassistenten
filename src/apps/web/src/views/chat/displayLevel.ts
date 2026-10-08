/**
 * How much of the assistant's own work the answer shows.
 *
 * Meldt 30.09: the technical side of an answer is useful to developers who
 * want verbose or debug-like feedback on what is happening right now. Issue
 * 88 asks for the opposite: a procedure over the answer with the steps in
 * plain language and none of the machinery. Both are right for their reader, so it is a setting.
 *
 * Two levels and no more. `standard` is what everyone gets: what the agent
 * tried to do, and what the answer was built from. `detaljert` is what the
 * thinking panel has always shown — the search strings, the hit counts, the
 * times.
 *
 * A module store rather than a context, for the reason `src/api/corpus.ts`
 * gives: the value is read from several places that are not all components,
 * and a store is subscribed to the same way `useViewportWidth` subscribes to
 * the window. It is also one line to move into the shell later, when the
 * hidden menu becomes a real one.
 */

import { useSyncExternalStore } from 'react';

export type DisplayLevel = 'standard' | 'detaljert';

export const DISPLAY_LEVEL_STORAGE_KEY = 'ka.display-level';

/**
 * What opens the menu. Written down once, because the README names it and the
 * chat view matches on it, and a menu nobody can find is worse than no menu.
 */
export const SETTINGS_HASH = '#innstillinger';

const DEFAULT_LEVEL: DisplayLevel = 'standard';

function isDisplayLevel(value: unknown): value is DisplayLevel {
  return value === 'standard' || value === 'detaljert';
}

/**
 * Storage can throw rather than return null — Safari in private mode, and any
 * browser with site data blocked — and a display level is never worth a blank
 * page. Same guard as `colorScheme.ts`.
 */
function readStored(): DisplayLevel | undefined {
  try {
    const stored = localStorage.getItem(DISPLAY_LEVEL_STORAGE_KEY);
    return isDisplayLevel(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/*
 * Read once and kept, so `getSnapshot` can hand React the same value twice.
 * Reading storage on every call is what makes `useSyncExternalStore` loop:
 * the value is equal but the read is a side effect on every render.
 */
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
