/**
 * Feature flags: experiments that can be tried side by side and taken out
 * again once a choice is made.
 *
 * Not settings. A setting (`#innstillinger`) is a choice that stays, like how
 * much of the answer's making to show. A flag is a trial of something that is
 * not decided yet, such as the panels as a row at the top on a phone (#120),
 * and every flag here is meant to be removed: either the trial becomes the
 * way the app works, or it goes.
 *
 * Every flag is off unless this browser has turned it on, in the hidden menu
 * (`#feature-flags`) or with a link (`?flagg=<id>`, see `flagLink.ts`).
 *
 * Shaped like `src/layout/footerMode.ts`: a module store read through
 * `useSyncExternalStore`, the same storage guard, and a value read once and
 * kept so the snapshot is stable. One stored object for all flags rather than
 * one key each, so «Logg ut» has one key to remove and a flag taken out of
 * the list leaves nothing behind that anything reads.
 */

import { useSyncExternalStore } from 'react';

export type Flag = {
  /** Stable, and what a link names. Never reused for another trial. */
  id: string;
  /** What the menu calls it. */
  title: string;
  /** One line on what changes when it is on. */
  description: string;
  /** The issue the trial answers. */
  issue: string;
};

/**
 * The flags there are. A flag no longer here is ignored where it is stored,
 * and dropped the next time anything is written.
 */
export const FLAGS = [
  {
    id: 'mobile-top-row',
    title: 'Panelene som en rad øverst på mobil',
    description:
      'På telefon ligger tråder, filter og kilder i en rad øverst i stedet for som skinner på sidene.',
    issue: 'https://github.com/digdir/kunnskapsassistenten/issues/120',
  },
] as const satisfies readonly Flag[];

export type FlagId = (typeof FLAGS)[number]['id'];

export const FLAGS_STORAGE_KEY = 'ka.flags.v1';

/** The flags that are on. Only those are stored; off is the absence. */
type FlagState = Readonly<Partial<Record<FlagId, true>>>;

const NONE: FlagState = Object.freeze({});

export function isFlagId(value: unknown): value is FlagId {
  return FLAGS.some((flag) => flag.id === value);
}

/**
 * Storage can throw rather than return null — Safari in private mode, and any
 * browser with site data blocked — and an experiment is never worth a blank
 * page. Anything that is not a list of known ids reads as «all off».
 */
function readStored(): FlagState {
  try {
    const raw = localStorage.getItem(FLAGS_STORAGE_KEY);
    if (raw === null) return NONE;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NONE;
    const state: Partial<Record<FlagId, true>> = {};
    for (const id of parsed) if (isFlagId(id)) state[id] = true;
    return Object.freeze(state);
  } catch {
    return NONE;
  }
}

function writeStored(state: FlagState): void {
  try {
    const on = FLAGS.map((flag) => flag.id).filter((id) => state[id]);
    if (on.length === 0) localStorage.removeItem(FLAGS_STORAGE_KEY);
    else localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(on));
  } catch {
    // Ignored on purpose: the flag still applies for this page load.
  }
}

/*
 * Read once and kept, so `getSnapshot` can hand React the same value twice.
 * Reading storage on every call is what makes `useSyncExternalStore` loop.
 */
let current: FlagState | undefined;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function getState(): FlagState {
  current ??= readStored();
  return current;
}

export function isFlagOn(id: FlagId): boolean {
  return getState()[id] === true;
}

export function setFlag(id: FlagId, on: boolean): void {
  if (!isFlagId(id)) {
    throw new Error(`Ukjent flagg: ${String(id)}.`);
  }
  if (isFlagOn(id) === on) return;
  const next: Partial<Record<FlagId, true>> = { ...getState() };
  if (on) next[id] = true;
  else delete next[id];
  current = Object.freeze(next);
  writeStored(current);
  notify();
}

export function subscribeToFlags(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * For «Logg ut» (`beforeLogout` in session.ts): the flags are kept per
 * browser and not per user, like the answers and the agent choice, so the
 * next reader in this browser starts with every experiment off.
 */
export function forgetFlags(): void {
  try {
    localStorage.removeItem(FLAGS_STORAGE_KEY);
  } catch {
    // Not writable. The page is about to leave anyway.
  }
  current = NONE;
  notify();
}

/** For tests, which share one module across cases. Reads storage again. */
export function resetFlags(): void {
  current = undefined;
}

/** Whether a flag is on, and it re-renders whoever reads it when that changes. */
export function useFlag(id: FlagId): boolean {
  return useSyncExternalStore(
    subscribeToFlags,
    () => isFlagOn(id),
    () => false,
  );
}
