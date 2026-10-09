import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  activeCorpusKey,
  corpusIsChoosable,
  corpusOptions,
  setActiveCorpusKey,
  type CorpusOption,
} from '../api';
import { useActiveCorpus } from './useActiveCorpus';

export type Corpus = {
  /** Every corpus this deployment can reach, in the order it named them. */
  options: CorpusOption[];
  /** The key on the wire. Undefined only when nothing is configured at all. */
  active: string | undefined;
  /** The active corpus's full entry; the filter panel's corpus line must change with it. */
  option: CorpusOption | undefined;
  /** True with more than one corpus. A single one still travels on every call. */
  choosable: boolean;
  /** Switch corpus. Starts a new thread; see below. */
  set: (key: string) => void;
};

/**
 * Which corpus the assistant searches, plus the setter; the state lives in src/api/corpus.ts
 * because the chat client reads it outside React. **Switching starts a new thread**: continuing
 * would mix citations from two document sets with nothing saying which is which.
 */
export function useCorpus(): Corpus {
  const navigate = useNavigate();
  // Through the shared hook, so the panel that changes the corpus and the panels that only read
  // it settle in the same paint.
  const { key: active, option } = useActiveCorpus();

  const set = useCallback(
    (key: string) => {
      if (key === activeCorpusKey()) return;
      setActiveCorpusKey(key);
      // `/`, not a new thread id: the first question mints the thread (see `threadFromQuestion`).
      // A push, not a replace, so Back returns to the thread they were reading.
      navigate('/');
    },
    [navigate],
  );

  return useMemo(
    () => ({
      options: corpusOptions,
      active,
      option,
      choosable: corpusIsChoosable,
      set,
    }),
    [active, option, set],
  );
}
