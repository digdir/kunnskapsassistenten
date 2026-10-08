import { useEffect, useState, type RefObject } from 'react';
import { stepHit } from '../../components';

/** The class every `<mark>` in an answer carries, so they can be found again. */
export const ANSWER_MARK_CLASS = 'ka-answer-mark';

function markElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) return [];
  return [...container.querySelectorAll<HTMLElement>(`mark.${ANSWER_MARK_CLASS}`)];
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type AnswerHits = {
  /** How many matches the answer ended up with. */
  hitCount: number;
  /** Zero-based, in reading order. */
  currentIndex: number;
  step: (step: 1 | -1) => void;
};

/**
 * The search hits inside one rendered answer: how many, and which one the
 * reader stands on. Counted from the DOM and not the markdown, because the
 * counter's job is to describe the highlights actually on screen.
 */
export function useAnswerHits(
  containerRef: RefObject<HTMLElement | null>,
  query: string,
): AnswerHits {
  const [hitCount, setHitCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // A new query starts at the first hit. Adjusting state while rendering the
  // change rather than in an effect, so the counter never shows one query's
  // position against another's hits for a frame.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setCurrentIndex(0);
  }

  // No dependency list on purpose; see above. Both `setState` calls are
  // no-ops when the value has not changed, so it settles rather than loops.
  // oxlint-disable-next-line exhaustive-deps
  useEffect(() => {
    const marks = markElements(containerRef.current);

    setHitCount(marks.length);
    // An answer that shrinks under a standing query — a shorter one replacing
    // it — must not leave the reader pointing past the end.
    setCurrentIndex((current) => (marks.length === 0 ? 0 : Math.min(current, marks.length - 1)));

    for (const mark of marks) delete mark.dataset.current;
    const active = marks[currentIndex];
    if (active !== undefined) active.dataset.current = 'true';
  });

  // Moving to a hit is what scrolls, and only that. A new query lands on its
  // first hit, which is why the count is in here too: it is what changes when
  // the marks do.
  useEffect(() => {
    const active = markElements(containerRef.current)[currentIndex];
    active?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }, [containerRef, currentIndex, hitCount]);

  return {
    hitCount,
    currentIndex,
    // `stepHit` stops at the ends rather than wrapping, and it is the
    // sources panel's own: one search mechanism, not two.
    step: (step) => setCurrentIndex((current) => stepHit(hitCount, current, step)),
  };
}
