import type { SlotViewProps } from '../../layout/viewModel';
import type { AnswerSources, SourceDocument } from '../../model';

/**
 * `SlotViewProps`, partial so the view also renders outside the shell, plus the
 * sources. The nonce makes a second click on the same `[n]` count.
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /** Answers with sources, oldest first. `undefined` is loading; `[]` is none. */
  answers?: readonly AnswerSources[];
  /** The newest answer's sources, without `answers`. `undefined` is loading. */
  documents?: SourceDocument[];
  /** The answer the activated marker is in; without it, the one on screen. */
  activeCitationMessageId?: string;
};
