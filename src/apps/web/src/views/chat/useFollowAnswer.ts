import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * How close to the end still counts as «at the bottom», in CSS pixels: a line
 * of the answer and half a wheel step.
 *
 * Near enough that a reader would take it for the bottom (chosen 06.10, for
 * digdir/kunnskapsassistenten#126), and then the column follows what the
 * reader sends as it follows what arrives. Measured in the column at 1440 ×
 * 900 and 390 × 844, the same on both: a line of the answer is 30.6 px, a
 * wheel step 100 px in Chromium and an arrow key 40 px. A reader who stops
 * half a step short has the last line under the edge and sees the end of the
 * text above it. It was 24, and 30 short of the bottom a question went 372 px
 * below the edge with «Bla til nederst» showing.
 */
const SLACK = 80;

/**
 * Keeps the main column at its bottom while an answer arrives, if that is
 * where the reader already was — and leaves it alone otherwise (runde 3,
 * ekstra 4). Returns whether the column is at its bottom, which is
 * what «Bla til nederst» is drawn from (answer 17): a control that does
 * nothing is worse than no control.
 *
 * One hook for both, and that is measured. The button had a hook of its own
 * that watched the same growth, and it saw each new paragraph a moment before
 * this one took the column down to it: the button came and went 90 times in
 * three answers at 1440 × 900, and 226 times at 390 × 844, while the column
 * never left the bottom. Here the column is moved first and measured after,
 * and a column that is being held counts as at the bottom.
 *
 * «Where the reader was» is decided by the reader's own scrolling, and by
 * nothing else. Measured in the scroll events, before the answer grows, and
 * kept while it grows: a column that grew by a paragraph is no longer at its
 * bottom, but the reader who was there is still following. Scrolling up
 * lets go, and reaching the bottom again takes hold.
 *
 * Only UP lets go, and that is measured rather than tidy. The scroll event
 * for a jump this hook makes arrives a frame later, and an answer can grow
 * by a paragraph in between: the event then finds the column 31 px short of
 * a bottom that has moved, and a rule that only asked «is it at the bottom»
 * let go there. From the front page at 1920 × 1080 the second answer was
 * left behind at 364 of 1268. A reader who means to leave scrolls up; a
 * column that moved down and fell short was following.
 *
 * Only while an answer is on its way. Growth at any other time is somebody
 * opening a thread, or a panel in it, and a column that went to the bottom
 * then would take the reader away from the top of what they came to read.
 * That growth is measured instead, so a long thread that has just loaded
 * does not count as «at the bottom» because the page was empty a moment ago.
 *
 * The last render of an answer lands together with the status that ends it:
 * the action row under the answer and the follow-up suggestions under the
 * field. That growth is followed once more, on the transition, or the column
 * would stop one row short of the bottom on every answer.
 *
 * Instant rather than smooth. It runs once a frame while the answer streams,
 * and a smooth scroll restarted every frame never arrives.
 */
export function useFollowAnswer(
  container: RefObject<HTMLElement | null>,
  content: RefObject<HTMLElement | null>,
  answering: boolean,
): boolean {
  const [atBottom, setAtBottom] = useState(true);
  const stuck = useRef(true);
  const following = useRef(answering);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const near = () => distanceToBottom(element) <= SLACK;
    // Held at the bottom counts as at the bottom: see above.
    const report = () => setAtBottom(near() || (following.current && stuck.current));

    // Where the column stood at the last scroll event, to tell up from down.
    let lastTop = element.scrollTop;
    const scrolled = () => {
      const top = element.scrollTop;
      if (near()) stuck.current = true;
      else if (top < lastTop) stuck.current = false;
      lastTop = top;
      report();
    };

    stuck.current = near();
    report();
    element.addEventListener('scroll', scrolled, { passive: true });

    // jsdom has no ResizeObserver, and there is no layout there to follow.
    if (typeof ResizeObserver === 'undefined') {
      return () => element.removeEventListener('scroll', scrolled);
    }

    const observer = new ResizeObserver(() => {
      if (following.current && stuck.current) toEnd(element);
      else stuck.current = near();
      report();
    });
    observer.observe(content.current ?? element);

    return () => {
      element.removeEventListener('scroll', scrolled);
      observer.disconnect();
    };
  }, [container, content]);

  /*
   * A layout effect, so the flag is set before the browser lays the new
   * question out and the observer above sees it grow. A plain effect runs
   * after paint, and the first growth of every turn — the question itself —
   * was measured as the reader leaving the bottom.
   */
  useLayoutEffect(() => {
    const was = following.current;
    following.current = answering;

    const element = container.current;
    if (was && !answering && stuck.current && element) toEnd(element);
  }, [answering, container]);

  return atBottom;
}

/** To the end of the column, at once. */
function toEnd(element: HTMLElement): void {
  element.scrollTop = element.scrollHeight;
}

function distanceToBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}
