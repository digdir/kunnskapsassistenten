import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { OpenThreadContext, type OpenThreadContextValue } from './openThreadContext';

/** The conversation on screen, or undefined on a page that has none. */
export function useOpenThread(): string | undefined {
  return use(OpenThreadContext).openThreadId;
}

/**
 * Report the conversation on screen for as long as this view holds it. The cleanup matters: a
 * route with no conversation («Siden finnes ikke») must not leave the last thread marked open.
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
