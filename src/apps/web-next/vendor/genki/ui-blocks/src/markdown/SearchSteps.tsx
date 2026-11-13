import { Button } from '@digdir/designsystemet-react';
import { MIN_QUERY_LENGTH } from './textSearch.js';

/** What a search in drawn text says, in the words of the block that holds it. */
export interface SearchTexts {
  /** Too few characters typed: «Skriv minst 2 tegn». */
  min: (n: number) => string;
  /** No match. */
  none: string;
  /** «3 av 12 treff», one-based. */
  count: (n: number, total: number) => string;
}

/** The status under a search field, for a live region, since a `<mark>` is not announced. */
export const searchStatus = (
  texts: SearchTexts,
  query: string,
  hitCount: number,
  currentHitIndex: number,
) => {
  const typed = query.trim().length;
  if (typed === 0) return '';
  if (typed < MIN_QUERY_LENGTH) return texts.min(MIN_QUERY_LENGTH);
  return hitCount === 0 ? texts.none : texts.count(currentHitIndex + 1, hitCount);
};

export interface SearchStepsProps {
  hitCount: number;
  /** Zero-based. */
  currentHitIndex: number;
  onStep: (step: 1 | -1) => void;
  /** The buttons' words, «Forrige» and «Neste», and their names, «Forrige treff». */
  previous: string;
  next: string;
  previousName: string;
  nextName: string;
  className?: string | undefined;
}

/** «Forrige» and «Neste», once there is a match; `aria-disabled` at the ends keeps focus. */
export const SearchSteps = ({
  hitCount,
  currentHitIndex,
  onStep,
  previous,
  next,
  previousName,
  nextName,
  className,
}: SearchStepsProps) => {
  if (hitCount === 0) return null;
  const atFirst = currentHitIndex === 0;
  const atLast = currentHitIndex >= hitCount - 1;
  return (
    <div className={className}>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        aria-label={previousName}
        aria-disabled={atFirst || undefined}
        onClick={() => !atFirst && onStep(-1)}
      >
        {previous}
      </Button>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        aria-label={nextName}
        aria-disabled={atLast || undefined}
        onClick={() => !atLast && onStep(1)}
      >
        {next}
      </Button>
    </div>
  );
};
