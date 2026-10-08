import { use, useCallback, useEffect, useRef } from 'react';
import type { ChatClient } from '../api';
import { isEmptySelection, type FilterSelection, type ThreadDetail } from '../model';
import { FilterContext } from './filterContext';

/**
 * The lock a thread carries, or none. Neither the BFF nor live keeps an empty filter.
 */
export function lockOf(detail: ThreadDetail | null | undefined): FilterSelection | undefined {
  const filter = detail?.filter;
  return filter && !isEmptySelection(filter) ? filter : undefined;
}

/**
 * Tells the shell what the thread on the page is locked to, and lets go on unmount or a corpus
 * switch. Returns what the page calls for a thread it started: the backend stores the filter with
 * a new conversation, so the thread is read back, unless `stillOpen()` says the reader moved on.
 */
export function useThreadFilterLock(
  client: ChatClient,
  read: ThreadDetail | null | undefined,
  corpusKey: string | undefined,
): (threadId: string, stillOpen: () => boolean) => void {
  // The context, not `useFilterSelection()`, which throws without a shell (tests mount the page).
  const setLocked = use(FilterContext)?.setLocked;

  useEffect(() => {
    setLocked?.(lockOf(read));
  }, [read, setLocked]);

  // The page stays mounted through a corpus switch; the ref keeps the mount itself from counting.
  const lockCorpus = useRef(corpusKey);
  useEffect(() => {
    if (lockCorpus.current === corpusKey) return;
    lockCorpus.current = corpusKey;
    setLocked?.(undefined);
  }, [corpusKey, setLocked]);

  useEffect(() => () => setLocked?.(undefined), [setLocked]);

  return useCallback(
    (threadId: string, stillOpen: () => boolean) => {
      void client
        .getThread(threadId)
        .then((detail) => {
          if (stillOpen()) setLocked?.(lockOf(detail));
        })
        .catch(() => {});
    },
    [client, setLocked],
  );
}
