/**
 * A `matchMedia` jsdom can live with.
 *
 * jsdom implements none at all — `typeof window.matchMedia` is `undefined` —
 * and the layout needs one: the rule that only one sidebar may be open below
 * `bothSidebarsMinViewport` asks a media query rather than the DOM, because
 * jsdom does no layout and would answer every width question with 0.
 *
 * A stub that always answered `false` would be worse than none. Every test
 * would then run in the wide layout, the rule would never fire, and the suite
 * would report that a rule it never reached still works.
 *
 * Only the width features this app asks for are evaluated, against a width
 * the test sets. Anything else — `prefers-reduced-motion`, `prefers-contrast`
 * — answers false, which is the right answer for a query nobody has taught it
 * and matches what a browser with no such preference set reports.
 */

/** What the design frames are drawn at, and what Playwright opens. */
export const defaultViewportWidth = 1440;

let viewportWidth = defaultViewportWidth;

type Stub = {
  media: string;
  matches: boolean;
  listeners: Set<(event: MediaQueryListEvent) => void>;
  onchange: ((event: MediaQueryListEvent) => void) | null;
};

const stubs = new Set<Stub>();

/**
 * `(width < 1440px)`, `(min-width: 900px)` and the rest of the width family.
 * Returns undefined for a query about something other than width, which the
 * caller reads as «no».
 */
function evaluateWidth(media: string, width: number): boolean | undefined {
  const range = /^\(\s*width\s*(<=?|>=?)\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(media);
  if (range) {
    const limit = Number(range[2]);
    switch (range[1]) {
      case '<':
        return width < limit;
      case '<=':
        return width <= limit;
      case '>':
        return width > limit;
      default:
        return width >= limit;
    }
  }

  const bound = /^\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(media);
  if (bound) {
    const limit = Number(bound[2]);
    return bound[1] === 'min' ? width >= limit : width <= limit;
  }

  return undefined;
}

function install(): void {
  window.matchMedia = ((media: string) => {
    const stub: Stub = {
      media,
      matches: evaluateWidth(media, viewportWidth) ?? false,
      listeners: new Set(),
      onchange: null,
    };
    stubs.add(stub);

    return {
      get media() {
        return stub.media;
      },
      get matches() {
        return stub.matches;
      },
      get onchange() {
        return stub.onchange;
      },
      set onchange(handler: ((event: MediaQueryListEvent) => void) | null) {
        stub.onchange = handler;
      },
      addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') stub.listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') stub.listeners.delete(listener);
      },
      // The two deprecated names, because Safari only grew the modern pair in
      // 14 and libraries still reach for these.
      addListener: (listener: (event: MediaQueryListEvent) => void) => stub.listeners.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) =>
        stub.listeners.delete(listener),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/**
 * Resize the window the queries are answered against, and tell everyone who
 * asked to be told. That second half is the point: a component subscribes to
 * the query and only re-renders when the change event arrives.
 */
export function setViewportWidth(width: number): void {
  viewportWidth = width;
  // The layout asks the window itself as well as the media query: a panel the
  // reader has dragged wider is drawn at what fits, and that is arithmetic on
  // `innerWidth`. See src/layout/useViewportWidth.ts. Setting one without the
  // other would leave a test in a 1440 px window that answers 1024 to half
  // the questions.
  window.innerWidth = width;
  window.dispatchEvent(new Event('resize'));

  for (const stub of stubs) {
    const matches = evaluateWidth(stub.media, width) ?? false;
    if (matches === stub.matches) continue;
    stub.matches = matches;

    const event = { matches, media: stub.media } as MediaQueryListEvent;
    stub.onchange?.(event);
    for (const listener of [...stub.listeners]) listener(event);
  }
}

/** Back to the default width, and forget the queries the last test made. */
export function resetViewport(): void {
  setViewportWidth(defaultViewportWidth);
  stubs.clear();
}

install();
// jsdom opens at 1024 and the design's window is 1440. The queries answered
// 1440 from the first line of this module; `innerWidth` has to say the same.
window.innerWidth = viewportWidth;
