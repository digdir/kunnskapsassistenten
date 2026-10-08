import { SourcesView } from '../../views/sources';
import { useAnswerSources } from '../useAnswerSources';
import { useCitation } from '../useCitation';
import type { SlotViewProps } from '../viewModel';

/**
 * Mounts the sources view with what the shell holds, since chat and sources may
 * not import each other: the newest answer's `documents`, every answer's sources
 * (`undefined` until known), and the message the activated `[n]` sits in, so
 * `[2]` in the first answer is not taken for `[2]` in the third.
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
