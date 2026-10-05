import { splitByHits, type SearchHit } from './textSearch';

export type HighlightedTextProps = {
  text: string;
  /** Hits inside this text, in position order. Empty renders plain text. */
  hits: SearchHit[];
  /** The hit the user is currently standing on, if it is in this text. */
  currentHit?: SearchHit;
  /**
   * Class on each `<mark>`. The caller's, because the highlight has to sit on
   * the caller's own surface: `.sources-mark` is defined beside the excerpt
   * cards it marks, and an answer or a document view will want its own.
   *
   * Optional, and leaving it out gives the browser's default yellow. That is
   * a legible fallback rather than a design, so a view that draws this for
   * real passes a class.
   */
  markClassName?: string;
};

/**
 * The text with search matches wrapped in `<mark>`.
 *
 * `<mark>` rather than a styled span: it is the element that means «marked
 * because it is relevant to the user at this moment», which is exactly what a
 * search hit is. Screen readers do not announce it by default in most
 * browsers, which is why the counter «n av m treff» is a live region — the
 * counter is what tells a screen reader user that the search did anything.
 *
 * The current hit carries `data-current`, so the CSS can give it a stronger
 * surface than the rest without a second element.
 *
 * Shared rather than the sources view's own, 2026-09-15 at #3's request: the
 * answer is next to get a search (punkt 13 in
 * design/brukerreiser-2026-09-15.md), and two `<mark>` renderers would drift.
 */
export function HighlightedText({ text, hits, currentHit, markClassName }: HighlightedTextProps) {
  const runs = splitByHits(text, hits);

  return (
    <>
      {runs.map((run, index) =>
        run.hit ? (
          <mark
            // Runs have no identity of their own; position is the identity, and
            // the whole list is rebuilt whenever the query changes.
            key={index}
            className={markClassName}
            data-current={run.hit === currentHit ? 'true' : undefined}
          >
            {run.text}
          </mark>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
