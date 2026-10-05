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
 * reader is standing on.
 *
 * Counted from the DOM rather than from the markdown, and that is the whole
 * idea. `Markdown` renders an answer through react-markdown, so the text the
 * reader sees is not the string that went in: headings lose their `#`, bold
 * loses its stars, a `[3]` becomes a link. Counting matches in the markdown
 * source would give a number that does not match the highlights on screen —
 * and the counter's only job is to describe those highlights.
 *
 * So `Markdown` marks every match, purely and in document order, and this
 * reads them back with `querySelectorAll`, which returns them in exactly that
 * order. Reading order is a question about the rendered document, and the
 * rendered document is what answers it.
 *
 * The current hit is marked with a `data-current` attribute set here rather
 * than rendered, because which mark is current is a fact about the rendered
 * order and not about any one block of markdown.
 *
 * Which is why it is re-applied after EVERY render and not only when the
 * index changes. Measured in the browser 2026-09-15: stepping to hit 2 set
 * the attribute, and it was gone a moment later. The chat view re-renders on
 * scroll — `useFollowAnswer` watches the main column — and the smooth scroll to
 * the hit is itself scrolling, so the render that followed took the attribute
 * with it while the effect that sets it sat still on unchanged dependencies.
 * Scrolling is the one thing that stays behind a dependency list: an effect
 * that scrolled on every render would take the page away from a reader who
 * had just scrolled it themselves.
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

  // No dependency list on purpose: see the note above. Both `setState` calls
  // are no-ops when the value has not changed, so a render that changed
  // nothing settles here rather than looping.
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
    // `stepHit` stops at the ends rather than wrapping (brukerblikk
    // 2026-09-15, funn 11), and it is the sources panel's own: one search
    // mechanism, not two.
    step: (step) => setCurrentIndex((current) => stepHit(hitCount, current, step)),
  };
}
