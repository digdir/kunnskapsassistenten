import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * How close to the end counts as at the end: a line of the answer and half a wheel step, so a
 * reader who stops just short still has the last line under the edge and the column follows.
 */
export const FOLLOW_SLACK = 80;

const scrolls = (element: Element) =>
  /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY);

/** The nearest ancestor that scrolls, or the page's own scroller. */
export const scrollingAncestor = (from: Element | null): HTMLElement | null => {
  for (let element = from?.parentElement ?? null; element; element = element.parentElement)
    if (scrolls(element)) return element;
  return (document.scrollingElement as HTMLElement | null) ?? null;
};

const distanceToEnd = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight;

const toEnd = (element: HTMLElement) => {
  element.scrollTop = element.scrollHeight;
};

/**
 * Keeps the column at its end while an answer comes, if the reader was there, and says whether
 * the reader is at the end: one hook, because two cannot agree. Only scrolling up lets go, since
 * the hook's own jump reports a frame late. It follows only while an answer is on its way, since
 * growth at any other time is a thread opening, and once more as the answer ends, or it stops one
 * row short of the answer's actions.
 */
export const useFollowAnswer = (
  content: RefObject<HTMLElement | null>,
  answering: boolean,
  enabled: boolean,
  container?: RefObject<HTMLElement | null>,
): boolean => {
  const [atEnd, setAtEnd] = useState(true);
  const stuck = useRef(true);
  const following = useRef(answering);
  const column = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const element = container?.current ?? scrollingAncestor(content.current);
    column.current = element;
    if (!element) return;
    // The page's own scroller reports its scrolls on the window.
    const target: HTMLElement | Window = element === document.scrollingElement ? window : element;

    const near = () => distanceToEnd(element) <= FOLLOW_SLACK;
    // Held at the end counts as at the end: see above.
    const report = () => setAtEnd(near() || (following.current && stuck.current));

    let lastTop = element.scrollTop;
    const scrolled = () => {
      const top = element.scrollTop;
      if (near()) stuck.current = true;
      else if (top < lastTop) stuck.current = false;
      lastTop = top;
      report();
    };

    // Set up while an answer is on its way, the column has just been given the question that
    // starts the thread: the reader asked it, so the column follows it, however far the question
    // and the answer's outline already reach below the edge, as on a phone.
    stuck.current = near() || following.current;
    if (following.current && !near()) toEnd(element);
    report();
    target.addEventListener('scroll', scrolled, { passive: true });

    // Without ResizeObserver, as in jsdom, there is no layout to follow.
    if (typeof ResizeObserver === 'undefined')
      return () => target.removeEventListener('scroll', scrolled);

    const observer = new ResizeObserver(() => {
      if (following.current && stuck.current) toEnd(element);
      else stuck.current = near();
      report();
    });
    observer.observe(content.current ?? element);
    return () => {
      target.removeEventListener('scroll', scrolled);
      observer.disconnect();
    };
  }, [content, container, enabled]);

  // Before paint, so the new question's own growth is not read as the reader leaving the end.
  useLayoutEffect(() => {
    const was = following.current;
    following.current = answering;
    const element = column.current;
    if (enabled && was && !answering && stuck.current && element) toEnd(element);
  }, [answering, enabled]);

  return atEnd;
};
