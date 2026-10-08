// Whether the navigation panel's foot stays put (`pinned`) or scrolls with the list (`scrolls`,
// the default), so both can be compared (digdir/kunnskapsassistenten#123). Its own store, like
// src/views/chat/displayLevel.ts, so neither region imports the other.

import { useSyncExternalStore } from 'react';

export type FooterMode = 'pinned' | 'scrolls';

export const FOOTER_MODE_STORAGE_KEY = 'ka.footer-mode';

const DEFAULT_MODE: FooterMode = 'scrolls';

function isFooterMode(value: unknown): value is FooterMode {
  return value === 'pinned' || value === 'scrolls';
}

/**
 * Storage can throw (Safari in private mode, blocked site data); no setting is worth a crash.
 */
function readStored(): FooterMode | undefined {
  try {
    const stored = localStorage.getItem(FOOTER_MODE_STORAGE_KEY);
    return isFooterMode(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

// Read once and cached, so `getSnapshot` does not read storage on every render.
let current: FooterMode | undefined;

const listeners = new Set<() => void>();

export function getFooterMode(): FooterMode {
  current ??= readStored() ?? DEFAULT_MODE;
  return current;
}

export function setFooterMode(mode: FooterMode): FooterMode {
  if (!isFooterMode(mode)) {
    throw new Error(`Ukjent fotmodus: ${String(mode)}. Bruk 'pinned' eller 'scrolls'.`);
  }
  current = mode;
  try {
    localStorage.setItem(FOOTER_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignored on purpose: the mode still applies for this page load.
  }
  for (const listener of [...listeners]) listener();
  return mode;
}

export function subscribeToFooterMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For tests, which share one module across cases. */
export function resetFooterMode(): void {
  current = undefined;
}

/** The mode, and it re-renders whoever reads it when the menu changes it. */
export function useFooterMode(): FooterMode {
  return useSyncExternalStore(subscribeToFooterMode, getFooterMode, () => DEFAULT_MODE);
}
