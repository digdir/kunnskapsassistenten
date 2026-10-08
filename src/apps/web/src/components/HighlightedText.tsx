import { splitByHits, type SearchHit } from './textSearch';

export type HighlightedTextProps = {
  text: string;
  /** Hits inside this text, in position order. Empty renders plain text. */
  hits: SearchHit[];
  /** The hit the user is currently standing on, if it is in this text. */
  currentHit?: SearchHit;
  /** Class on each `<mark>`; without it the browser's default yellow stands in. */
  markClassName?: string;
};

/**
 * The text with search matches in `<mark>`. Most screen readers do not announce it, which is why
 * the «n av m treff» counter is a live region. The current hit carries `data-current` for CSS.
 */
export function HighlightedText({ text, hits, currentHit, markClassName }: HighlightedTextProps) {
  const runs = splitByHits(text, hits);

  return (
    <>
      {runs.map((run, index) =>
        run.hit ? (
          <mark
            // Runs have no identity of their own, and the list is rebuilt
            // whenever the query changes.
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
