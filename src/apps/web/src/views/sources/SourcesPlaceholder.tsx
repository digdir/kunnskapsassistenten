import { Skeleton } from '@digdir/designsystemet-react';

/** One block per document card the answer is likely to have. */
const DOCUMENT_PLACEHOLDERS = ['a', 'b', 'c', 'd'];

/**
 * `excerpts-placeholder` from Figma: the loading state for the panel.
 *
 * It mirrors the shape of the real content, one block per document card, so
 * the layout does not jump when the sources arrive. The shortcut list it drew
 * first went with the list itself: the documents are named under each answer
 * now, in «Kilder brukt i svaret» (Simens issue 113).
 *
 * `Skeleton` sets `aria-hidden` on itself, always and in code. That means a
 * screen reader is told nothing at all unless we say it ourselves, and in
 * forced-colours mode the skeletons are invisible too. Hence `aria-busy` on
 * the region and a real sentence in a live region. The Designsystemet
 * documentation does not mention this; `skeleton.md` does.
 */
export function SourcesPlaceholder() {
  return (
    <div className="sources-placeholder" aria-busy="true">
      {/* `<output>` is the status live region; Skeleton is aria-hidden, so
          without this sentence a screen reader user is told nothing at all. */}
      <output className="ds-sr-only">Henter kilder …</output>

      <div className="sources-placeholder__documents">
        {DOCUMENT_PLACEHOLDERS.map((key) => (
          <Skeleton key={key} variant="rectangle" height="var(--ds-size-18)" />
        ))}
      </div>
    </div>
  );
}
