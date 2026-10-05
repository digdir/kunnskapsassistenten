import { SourcesView } from '../../views/sources';
import { useAnswerSources } from '../useAnswerSources';
import { useCitation } from '../useCitation';
import type { SlotViewProps } from '../viewModel';

/**
 * Mounts the sources view in whichever slot holds it.
 *
 * The view draws documents it is handed; the shell is what holds them, since
 * they are produced by the chat view and the two may not import each other.
 * See answerSourcesContext.ts.
 *
 * Three things are handed over, and the last two are what make a marker in an
 * older answer mean what it says (punkt 5 in
 * design/brukerreiser-2026-09-15.md):
 *
 *   documents                the flat list, the newest answer's. Kept because
 *                            the view normalises it to a one-entry `answers`
 *                            and because the filter view reads the same
 *                            value.
 *   answers                  every answer in the thread, oldest first.
 *                            `undefined` until something is recorded, which
 *                            the view reads as «nothing is known».
 *   activeCitationMessageId  which answer the activated `[n]` sits in. Without
 *                            it the panel cannot tell `[2]` in the first
 *                            answer from `[2]` in the third.
 *
 * `activeCitationNumber` and `activeCitationNonce` come the other way, through
 * `SlotViewProps`, because every view gets those. The message id does not: it
 * is only the sources view that has a use for it.
 */
export function SourcesSlotView(props: SlotViewProps) {
  const { documents, answers } = useAnswerSources();
  const { activeCitation } = useCitation();

  return (
    <SourcesView
      {...props}
      answers={answers}
      documents={documents}
      activeCitationMessageId={activeCitation?.messageId}
    />
  );
}
