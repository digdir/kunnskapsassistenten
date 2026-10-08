import type { SlotViewProps } from '../../layout/viewModel';
import type { AnswerSources, SourceDocument } from '../../model';

/**
 * What the sources view needs from whoever mounts it.
 *
 * It is `SlotViewProps` plus the sources. The slot props are partial so the
 * view also renders on its own, outside the shell, which is what the preview
 * harness does; a component with partial props is still assignable to
 * `ComponentType<SlotViewProps>`, so the shell can mount it unchanged.
 *
 * The shell owns the collapse button and hides the whole view with `hidden`
 * when the slot is collapsed, so nothing here has to draw a «Vis kilder»
 * button. `collapsed` is still read: a collapsed panel should not scroll
 * itself to a citation it cannot show.
 *
 * `activeCitationNumber` and `activeCitationNonce` come from `useCitation()`
 * through the shell. The nonce is what makes a second click on the same `[n]`
 * count as a new request (answer 19).
 */
export type SourcesViewProps = Partial<SlotViewProps> & {
  /**
   * Every answer in the thread that has sources, oldest first.
   *
   * `undefined` means the mounter does not know yet, which is the loading
   * state. `[]` means the thread has no answers.
   *
   * `SourcesSlotView` passes this from `answerSourcesContext` (PR #39), and
   * the chat view records one entry per answer (PR #42).
   */
  answers?: readonly AnswerSources[];
  /**
   * The flat list: the newest answer's sources.
   *
   * Read only when `answers` is absent, and normalised to a one-entry
   * `answers` list at the top of the view, so there is one code path below
   * that point. It goes away the day every caller records answers per message
   * id, and nothing but the normaliser has to change.
   *
   * `undefined` means «still loading», `[]` means «no sources yet».
   */
  documents?: SourceDocument[];
  /**
   * Which answer the activated `[n]` marker sits in.
   *
   * Without it the panel cannot tell a marker in the first answer from one in
   * the third, and switching sets is guesswork. `SourcesSlotView` reads it
   * from `useCitation()`; it is undefined until the chat view passes a message
   * id to `showCitation`, and the marker is then resolved against the answer
   * already on screen, which is what the panel did before.
   */
  activeCitationMessageId?: string;
};
