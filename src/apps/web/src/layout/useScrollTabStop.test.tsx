import { act, render, screen } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { useScrollTabStop } from './useScrollTabStop';

/**
 * When a scrolling region needs a tab stop of its own: it scrolls, and has
 * nothing in it the keyboard can land on (KA CC on #211).
 *
 * jsdom lays nothing out, so the sizes are handed in: each element says how
 * tall its content is and how tall it is drawn, and the resize observer is a
 * fake that fires for the element it is told has changed — and only for an
 * element that is actually observed. That last part is the point of the
 * tests about growing content: a hook that watched only the region's own box
 * would miss them, and did, with every other test green.
 *
 * What is in the region is jsdom's own MutationObserver, which works.
 */
const observed = new Map<Element, Set<() => void>>();

class FakeResizeObserver {
  #callback: () => void;
  #targets = new Set<Element>();
  constructor(callback: () => void) {
    this.#callback = callback;
  }
  observe(target: Element) {
    this.#targets.add(target);
    const callbacks = observed.get(target) ?? new Set();
    callbacks.add(this.#callback);
    observed.set(target, callbacks);
  }
  unobserve() {}
  disconnect() {
    for (const target of this.#targets) observed.get(target)?.delete(this.#callback);
    this.#targets.clear();
  }
}

const original = globalThis.ResizeObserver;
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

/** Content height against drawn height, per element, for the next measurement. */
const sizes = new WeakMap<Element, { content: number; drawn: number }>();
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return sizes.get(this)?.content ?? 0;
  },
});
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return sizes.get(this)?.drawn ?? 0;
  },
});

afterAll(() => {
  globalThis.ResizeObserver = original;
  // Own properties on the prototype, so deleting them brings jsdom's back.
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

/** Fire the observers watching `element`, as the browser does when it resizes. */
function resized(element: Element) {
  act(() => {
    for (const callback of observed.get(element) ?? []) callback();
  });
}

let setChildren: (children: ReactNode) => void = () => {};

function Region({ initial }: { initial: ReactNode }) {
  const [children, set] = useState<ReactNode>(initial);
  const [needsTabStop, ref] = useScrollTabStop();
  useEffect(() => {
    setChildren = set;
  }, []);
  return (
    <div ref={ref} data-testid="region" data-needs-tab-stop={needsTabStop}>
      {children}
    </div>
  );
}

const region = () => screen.getByTestId('region');
const needsTabStop = () => region().dataset.needsTabStop === 'true';

/** The region's content grows or shrinks; only the child's box changes. */
function contentHeight(height: number) {
  sizes.set(region(), { content: height, drawn: 600 });
  resized(screen.getByTestId('content'));
}

beforeEach(() => observed.clear());

describe('a scrolling region’s own tab stop', () => {
  it('is not there while the content fits', () => {
    render(<Region initial={<div data-testid="content">Skjelett</div>} />);
    contentHeight(400);

    expect(needsTabStop()).toBe(false);
  });

  it('comes when the content grows past the region, and goes when it shrinks back', () => {
    render(<Region initial={<div data-testid="content">Skjelett</div>} />);
    contentHeight(400);

    contentHeight(1100);
    expect(needsTabStop()).toBe(true);

    contentHeight(500);
    expect(needsTabStop()).toBe(false);
  });

  it('goes when a control appears in it, and comes back when the control goes', async () => {
    render(<Region initial={<div data-testid="content">Skjelett</div>} />);
    contentHeight(1100);
    expect(needsTabStop()).toBe(true);

    // A MutationObserver answers in a microtask, so the act has to wait for it.
    await act(async () =>
      setChildren(
        <div data-testid="content">
          <button type="button">Velg alle</button>
        </div>,
      ),
    );
    expect(needsTabStop()).toBe(false);

    await act(async () => setChildren(<div data-testid="content">Skjelett</div>));
    expect(needsTabStop()).toBe(true);
  });

  /*
   * The next two change an attribute and nothing else: the same elements,
   * in the same place, so no child is added or removed and only the
   * attribute observation can see it (KA CC on #211).
   */
  it('comes when the only control is hidden, and goes when it shows again', async () => {
    const content = (hidden: boolean) => (
      <div data-testid="content">
        <button type="button" hidden={hidden}>
          Velg alle
        </button>
      </div>
    );
    render(<Region initial={content(false)} />);
    contentHeight(1100);
    expect(needsTabStop()).toBe(false);

    await act(async () => setChildren(content(true)));
    expect(needsTabStop()).toBe(true);

    await act(async () => setChildren(content(false)));
    expect(needsTabStop()).toBe(false);
  });

  it('goes when a control taken out of the order is given tabindex 0', async () => {
    const content = (inOrder: boolean) => (
      <div data-testid="content">
        <button type="button" tabIndex={inOrder ? 0 : -1}>
          Velg alle
        </button>
      </div>
    );
    render(<Region initial={content(false)} />);
    contentHeight(1100);
    expect(needsTabStop()).toBe(true);

    await act(async () => setChildren(content(true)));
    expect(needsTabStop()).toBe(false);
  });

  it('does not count a control the keyboard cannot land on', () => {
    render(
      <Region
        initial={
          <div data-testid="content">
            <div hidden>
              <button type="button">Skjult</button>
            </div>
            <button type="button" disabled>
              Av
            </button>
            <ul tabIndex={-1}>
              <li>Fokus hit ved kode, ikke ved Tab</li>
            </ul>
          </div>
        }
      />,
    );

    contentHeight(1100);

    expect(needsTabStop()).toBe(true);
  });
});
