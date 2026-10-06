/**
 * Whether the navigation panel's foot stays put or scrolls with the list.
 *
 * digdir/kunnskapsassistenten#123 asks whether the foot has to be pinned at
 * all, or whether the whole panel could be one container with nothing fixed.
 * It is a setting rather than a rewrite, so both can stand on the same page
 * and be looked at side by side.
 *
 * `scrolls` is the default (chosen 06.10): the foot is at the end of the
 * scrolling region, so the panel is one column and nothing is fixed.
 * `pinned` keeps the foot below the scrolling region, outside it, so the links
 * and the colour scheme are where they were however far the thread list has
 * been scrolled. It was the default before, and a browser that has it stored
 * keeps it.
 *
 * Shaped exactly like `src/views/chat/displayLevel.ts`, down to the storage
 * guard and the `useSyncExternalStore` subscription, because it is the same
 * kind of thing: a choice made in the hidden settings menu, remembered in
 * this browser, read from more than one place. Two stores and not one shared
 * one, because the two settings belong to different regions and neither
 * should have to be imported to change the other.
 *
 * In `src/layout/` rather than beside the display level: the foot is the
 * shell's, and the shell is what reads this. The settings dialog imports it
 * the same way the views already import `useCorpus` and `useFilterSelection`.
 */

import { useSyncExternalStore } from 'react';

export type FooterMode = 'pinned' | 'scrolls';

export const FOOTER_MODE_STORAGE_KEY = 'ka.footer-mode';

const DEFAULT_MODE: FooterMode = 'scrolls';

function isFooterMode(value: unknown): value is FooterMode {
  return value === 'pinned' || value === 'scrolls';
}

/**
 * Storage can throw rather than return null — Safari in private mode, and any
 * browser with site data blocked — and where the foot sits is never worth a
 * blank page. Same guard as `displayLevel.ts` and `colorScheme.ts`.
 */
function readStored(): FooterMode | undefined {
  try {
    const stored = localStorage.getItem(FOOTER_MODE_STORAGE_KEY);
    return isFooterMode(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/*
 * Read once and kept, so `getSnapshot` can hand React the same value twice.
 * Reading storage on every call is what makes `useSyncExternalStore` loop:
 * the value is equal but the read is a side effect on every render.
 */
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
