import { Skeleton } from '@digdir/designsystemet-react';

/** One block per document card the answer is likely to have. */
const DOCUMENT_PLACEHOLDERS = ['a', 'b', 'c', 'd'];

/**
 * The loading state, Figma's `excerpts-placeholder`. `Skeleton` is
 * `aria-hidden`, so `aria-busy` and a sentence in a live region say it.
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
