import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { OpenThreadContext, type OpenThreadContextValue } from './openThreadContext';

/**
 * The conversation on screen. Undefined on a page that has none.
 *
 * Read by whatever has to point at it — today the thread list, which marks
 * its row with `aria-current="page"`.
 */
export function useOpenThread(): string | undefined {
  return use(OpenThreadContext).openThreadId;
}

/**
 * Report the conversation on screen for as long as this view holds it.
 *
 * Shaped like `useNoAnswers` and `useComposerPresence`: a value rather than a
 * hook the caller may or may not call, because the caller renders in both
 * states and a hook cannot be called conditionally.
 *
 * The cleanup is what makes leaving honest. A route with no conversation —
 * «Siden finnes ikke» — must not leave the last thread marked as open in a
 * list the reader is still looking at.
 */
export function useReportOpenThread(threadId: string | undefined): void {
  const { setOpenThreadId } = use(OpenThreadContext);

  useEffect(() => {
    setOpenThreadId(threadId);
    return () => setOpenThreadId(undefined);
  }, [threadId, setOpenThreadId]);
}

/** The other end: hold the id, and hand out the value to provide. */
export function useOpenThreadRegistry(): OpenThreadContextValue {
  const [openThreadId, setId] = useState<string | undefined>(undefined);
  const setOpenThreadId = useCallback((threadId: string | undefined) => setId(threadId), []);

  return useMemo(() => ({ openThreadId, setOpenThreadId }), [openThreadId, setOpenThreadId]);
}
