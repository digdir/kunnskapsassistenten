import { use, useCallback, useEffect, useRef } from 'react';
import type { ChatClient } from '../api';
import { isEmptySelection, type FilterSelection, type ThreadDetail } from '../model';
import { FilterContext } from './filterContext';

/**
 * The lock a thread carries, or none. An empty filter locks nothing: neither
 * the BFF nor live keeps one that had no values in it.
 */
export function lockOf(detail: ThreadDetail | null | undefined): FilterSelection | undefined {
  const filter = detail?.filter;
  return filter && !isEmptySelection(filter) ? filter : undefined;
}

/**
 * Tells the shell what the thread on the page is locked to (filterContext.ts,
 * `locked`), for the page that holds the thread.
 *
 * Its own hook so the page carries one call and one line, and not the
 * bookkeeping: `ChatSlotView` is where several owners write.
 *
 *   - A thread read from its address carries its lock, and a page with none
 *     read has none.
 *   - Leaving the page lets it go. Not every page the reader can go to holds
 *     a thread: the shell is around every route, and «Siden finnes ikke» has
 *     no page like this one to say anything, so a lock left standing there
 *     spoke of a thread that was not open (KA CC, kan 2 on #183). Going to
 *     another thread says the same thing twice, which costs nothing.
 *   - A corpus switch lets it go. The page stays mounted through one (the
 *     navigation to `/` does nothing there), so nothing else would. The
 *     corpus is kept, because an effect runs on mount as well, and a mount is
 *     not a switch.
 *
 * The context and not `useFilterSelection()`, which throws outside a
 * LayoutProvider: the page is mounted on its own in tests, and with no shell
 * there is no filter panel to tell.
 *
 * Returns what the page calls for a thread it started: the BFF locks a
 * conversation from its first question — it remembers the filter when it
 * makes it, which is before it says the id — so the thread is read back once
 * it has one, and what the backend says is the lock. Live does the same since
 * Issue 90: it stores the filter with the conversation it makes
 * (`filter-value`) and reads it back. Nothing is guessed from which client
 * this is; the mock keeps no filter on a thread and says none. `stillOpen` is
 * asked when the answer comes, so a reader who has moved on is not given a
 * lock for a thread that is no longer on screen.
 */
export function useThreadFilterLock(
  client: ChatClient,
  read: ThreadDetail | null | undefined,
  corpusKey: string | undefined,
): (threadId: string, stillOpen: () => boolean) => void {
  const setLocked = use(FilterContext)?.setLocked;

  useEffect(() => {
    setLocked?.(lockOf(read));
  }, [read, setLocked]);

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
