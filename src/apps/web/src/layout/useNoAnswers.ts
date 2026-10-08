import { useEffect } from 'react';
import { useAnswerSources } from './useAnswerSources';

/**
 * Say to the sources panel that this page has no conversation at all.
 *
 * The panel tells «nothing is known yet» from «nothing has been asked» by
 * `undefined` against `[]`, and it is right to: the first draws the skeletons
 * Figma has for sources on their way, the second says «Ingen kilder ennå» in
 * words. Nobody had said the second on a page with no chat view, because the
 * chat view is what reports sources and those pages do not have one. Measured
 * by KA CC on `/tull`: «Henter kilder …» with twelve skeletons, forever,
 * promising content that was never coming.
 *
 * Both halves are needed and neither is enough:
 *
 *   `clearAnswerSources()` alone leaves `answers` undefined, which IS the
 *   loading state — the same screen with a different route through the code.
 *   `setDocuments([])` alone leaves any `answers` from the conversation the
 *   reader came from standing, and the panel derives `documents` from those
 *   first. Nothing writes `answers` yet, so that half is for the day
 *   something does.
 *
 * Together they say the honest thing: nothing is known about any answer, and
 * the flat list is empty.
 *
 * `active` rather than two hooks, because both callers render in both states
 * and a hook cannot be called conditionally.
 */
export function useNoAnswers(active: boolean): void {
  const { setDocuments, clearAnswerSources } = useAnswerSources();

  useEffect(() => {
    if (!active) return;
    clearAnswerSources();
    setDocuments([]);
  }, [active, clearAnswerSources, setDocuments]);
}
