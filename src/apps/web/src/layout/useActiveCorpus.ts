import { useMemo, useSyncExternalStore } from 'react';
import { activeCorpus, corpusDisplayName, subscribeToCorpus, type CorpusOption } from '../api';

/** The corpus the chooser stands on, for anything that only reads it. */
export type ActiveCorpus = {
  /** The key on the wire. Undefined only when nothing is configured at all. */
  key: string | undefined;
  /** The whole entry — label and description — when the list holds one. */
  option: CorpusOption | undefined;
  /** What to call it on screen. Never empty; see `corpusDisplayName`. */
  displayName: string;
};

/**
 * Which corpus is selected, without the power to change it. For readers outside a Router (the
 * sources panel, `preview/` entry points): `useCorpus` navigates on a switch and needs one.
 */
export function useActiveCorpus(): ActiveCorpus {
  // The snapshot, not the key: in bff mode the corpus name arrives from the BFF after the first
  // paint, often under the key the build already had (`adoptServerCorpus` in src/api/corpus.ts).
  const current = useSyncExternalStore(subscribeToCorpus, activeCorpus, activeCorpus);

  return useMemo(
    () => ({
      key: current.key,
      option: current.option,
      displayName: corpusDisplayName(current.option),
    }),
    [current],
  );
}
