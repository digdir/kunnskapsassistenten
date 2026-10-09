import { useEffect } from 'react';
import { useAnswerSources } from './useAnswerSources';

/**
 * Tell the sources panel that this page has no conversation, so it says «Ingen kilder ennå»
 * instead of showing loading skeletons forever. Both calls are needed: either one alone leaves
 * the panel in the loading state or showing the previous thread's sources.
 */
export function useNoAnswers(active: boolean): void {
  const { setDocuments, clearAnswerSources } = useAnswerSources();

  useEffect(() => {
    if (!active) return;
    clearAnswerSources();
    setDocuments([]);
  }, [active, clearAnswerSources, setDocuments]);
}
