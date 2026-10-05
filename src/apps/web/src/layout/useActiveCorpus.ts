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
 * Which corpus is selected, without the power to change it.
 *
 * `useCorpus` carries the setter, and switching corpus starts a new thread —
 * so it calls `useNavigate` and cannot be used outside a Router. That made it
 * unusable for the two places that only want to read the choice: the sources
 * panel, and the `preview/` entry points that mount a view on its own without
 * routes. #4 read the store directly with `useSyncExternalStore` in #129 to
 * get around it, which is this hook written out by hand in a view that should
 * not have to know the store exists.
 *
 * The same subscription either way — `useCorpus` is now this hook plus the
 * half that navigates — so a reader who switches corpus sees both update in
 * the same paint, and there is one place that knows how the store is read.
 */
export function useActiveCorpus(): ActiveCorpus {
  // The snapshot and not the key: in bff mode the corpus's name arrives from
  // the BFF after the first paint, often under the key the build already had
  // (src/api/corpus.ts, `adoptServerCorpus`).
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
