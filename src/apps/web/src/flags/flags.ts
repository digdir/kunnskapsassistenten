// Feature flags: trials meant to be removed once decided, unlike settings, which
// stay. Off unless this browser turned them on. One stored list, not a key per
// flag, so «Logg ut» has one key to remove.

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

/** A flag removed from here is ignored in storage and dropped on the next write. */
export const FLAGS = [
  {
    id: 'mobile-top-row',
    title: 'Panelene som en rad øverst på mobil',
    description:
      'På telefon ligger tråder, filter og kilder i en rad øverst i stedet for som skinner på sidene.',
    issue: 'https://github.com/digdir/kunnskapsassistenten/issues/120',
  },
  {
    id: 'year-ranges',
    title: 'Årsfilter med perioder',
    description:
      'Skriv et år eller en periode, som 2021 eller 2023–2028. År på rad står som én merkelapp.',
    issue: 'https://github.com/digdir/kunnskapsassistenten/issues/115',
  },
  {
    id: 'compact-filter-chips',
    title: 'Samlede merkelapper i filteret',
    description:
      'Når alle eller mange verdier er valgt, står én merkelapp, som «Alle dokumenttyper» eller «12 virksomheter».',
    issue: 'https://github.com/digdir/kunnskapsassistenten/issues/116',
  },
  {
    id: 'filters-right-panel',
    title: 'Filtreringen i høyre panel',
    description:
      'Filtreringen står over kildene i høyre panel, så begge synes samtidig. Navigasjonspanelet har bare trådene.',
    issue: 'https://github.com/digdir/kunnskapsassistenten/issues/84',
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

// Storage can throw (Safari private mode, blocked site data), and a trial is
// never worth a blank page. Anything but a list of known ids reads as all off.
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
    // The flag still applies for this page load.
  }
}

// Read once: a fresh read per `getSnapshot` makes `useSyncExternalStore` loop.
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

/** For «Logg ut»: flags are per browser, so the next reader starts with all off. */
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
