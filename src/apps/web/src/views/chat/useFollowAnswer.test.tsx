import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFollowAnswer } from './useFollowAnswer';

/**
 * Following an answer down the column (Simens runde 3, ekstra 4).
 *
 * jsdom lays nothing out, so the column's three numbers are set by hand and
 * the observer is a stand-in that the test fires when the content «grows».
 * What is asserted is the rule: follow only while an answer is on its way,
 * and only if the reader was at the bottom when it grew.
 */

let grow: (() => void) | undefined;

class FakeResizeObserver {
  constructor(callback: () => void) {
    grow = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
  grow = undefined;
});

/**
 * A column 500 high with `height` of content, scrolled to `top`. The scroll
 * position is held between 0 and the bottom, as a browser holds it.
 */
function column(height: number, top: number) {
  const element = document.createElement('div');
  let scrollHeight = height;
  let scrollTop = top;
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 500 });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, Math.min(value, scrollHeight - 500));
    },
  });
  return {
    element,
    /** The answer grew by `by`; the observer is told, as the browser would. */
    growBy(by: number) {
      scrollHeight += by;
      act(() => grow?.());
    },
    /** The answer grew by `by`, and nothing has been told yet. */
    growQuietly(by: number) {
      scrollHeight += by;
    },
    /** The scroll event for where the column already is. */
    scrolled() {
      act(() => {
        element.dispatchEvent(new Event('scroll'));
      });
    },
    /** The reader scrolled. */
    scrollTo(value: number) {
      element.scrollTop = value;
      act(() => {
        element.dispatchEvent(new Event('scroll'));
      });
    },
  };
}

function Follow({ element, answering }: { element: HTMLElement; answering: boolean }) {
  const container = useRef<HTMLElement | null>(element);
  const content = useRef<HTMLElement | null>(element);
  const atBottom = useFollowAnswer(container, content, answering);
  return <output data-testid="at-bottom">{String(atBottom)}</output>;
}

describe('useFollowAnswer', () => {
  it('follows an answer down when the reader is at the bottom', () => {
    // 1000 of content in 500: the bottom is at 500.
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.growBy(120);

    expect(col.element.scrollTop).toBe(620);
  });

  it('leaves the column where it is when the reader is further up', () => {
    const col = column(1000, 200);
    render(<Follow element={col.element} answering />);

    col.growBy(120);

    expect(col.element.scrollTop).toBe(200);
  });

  it('lets go when the reader scrolls up, and takes hold again at the bottom', () => {
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.scrollTo(300);
    col.growBy(100);
    expect(col.element.scrollTop).toBe(300);

    // The bottom is now at 600.
    col.scrollTo(600);
    col.growBy(100);
    expect(col.element.scrollTop).toBe(700);
  });

  /*
   * The scroll event for the hook's own jump comes a frame later, and the
   * answer may have grown again by then: the event finds the column short of
   * a bottom that has moved. That is not the reader leaving. Measured in the
   * browser: from the front page at 1920 × 1080, the second answer was left
   * at 364 of 1268.
   */
  it('keeps following when the answer grew again before its own jump was reported', () => {
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.growBy(120);
    expect(col.element.scrollTop).toBe(620);

    col.growQuietly(40);
    col.scrolled();
    col.growBy(10);

    expect(col.element.scrollTop).toBe(670);
  });

  it('does not follow growth when no answer is on its way', () => {
    // A thread opening: the page was empty, and then it was long.
    const col = column(500, 0);
    const { rerender } = render(<Follow element={col.element} answering={false} />);

    col.growBy(1500);
    expect(col.element.scrollTop).toBe(0);

    // And that growth counts as leaving the bottom, so a question asked from
    // the top of the thread does not pull the column down.
    rerender(<Follow element={col.element} answering />);
    col.growBy(200);
    expect(col.element.scrollTop).toBe(0);
  });

  it('follows the last render of an answer, which lands with the status that ends it', () => {
    const col = column(1000, 500);
    const { rerender } = render(<Follow element={col.element} answering />);

    // The action row and the follow-ups arrive in the same render as «idle».
    col.growQuietly(80);
    rerender(<Follow element={col.element} answering={false} />);

    expect(col.element.scrollTop).toBe(580);
  });
  /*
   * «Bla til nederst» is drawn from what this returns. While the column is
   * held, a paragraph that has arrived and not yet been followed is not the
   * reader leaving the bottom: the button came and went 90 times in three
   * answers at 1440 × 900 when it had its own measurement.
   */
  it('counts a column it is holding as at the bottom, between a paragraph and the jump', () => {
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.growQuietly(40);
    col.scrolled();

    expect(screen.getByTestId('at-bottom').textContent).toBe('true');
  });

  it('says so when the reader has scrolled up', () => {
    const col = column(1000, 500);
    render(<Follow element={col.element} answering />);

    col.scrollTo(200);

    expect(screen.getByTestId('at-bottom').textContent).toBe('false');
  });
});
