import { useEffect, useState, useSyncExternalStore } from 'react';

const onResize = (change: () => void) => {
  window.addEventListener('resize', change);
  return () => window.removeEventListener('resize', change);
};

/** The layout viewport's width, `clientWidth`, since `innerWidth` zooms out on a phone. */
export const useViewportWidth = () =>
  useSyncExternalStore(
    onResize,
    () => document.documentElement.clientWidth,
    () => Number.POSITIVE_INFINITY,
  );

/** Whether a media query matches, read during render so the first paint is right. */
export const useMedia = (query: string) =>
  useSyncExternalStore(
    (change) => {
      const list = mediaList(query);
      list?.addEventListener('change', change);
      return () => list?.removeEventListener('change', change);
    },
    () => mediaList(query)?.matches ?? false,
    () => false,
  );

// Where there is no `matchMedia`, as in a host's test DOM, no query matches.
const mediaList = (query: string) =>
  typeof window.matchMedia === 'function' ? window.matchMedia(query) : undefined;

// What Tab can land on, by attribute rather than layout, so browsers and tests agree.
const tabbable = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

const hasTabbable = (region: HTMLElement) => {
  for (const candidate of region.querySelectorAll(tabbable)) {
    if (candidate.getAttribute('tabindex') === '-1') continue;
    if (candidate.closest('[hidden], [inert]')) continue;
    return true;
  }
  return false;
};

/** Whether a region scrolls with nothing the keyboard can reach (WCAG 2.1.1), kept measured. */
export const useScrollTabStop = (): [boolean, (element: HTMLElement | null) => void] => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  const [reachable, setReachable] = useState(false);

  useEffect(() => {
    if (element === null) return;
    const measure = () => {
      setScrolls(element.scrollHeight > element.clientHeight);
      setReachable(hasTabbable(element));
    };
    const sizes = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    const watchSizes = () => {
      if (!sizes) return;
      sizes.disconnect();
      sizes.observe(element);
      for (const child of element.children) sizes.observe(child);
    };
    const content = new MutationObserver(() => {
      watchSizes();
      measure();
    });
    watchSizes();
    content.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'hidden',
        'href',
        'inert',
        'tabindex',
        'contenteditable',
        'type',
      ],
    });
    measure();
    return () => {
      sizes?.disconnect();
      content.disconnect();
    };
  }, [element]);

  return [element !== null && scrolls && !reachable, setElement];
};

/** The pinned head's height, set on the region under it, for a block that pins its own head below. */
const pinnedSizeProperty = '--uib-shell-pinned-block-size';

/** Scroll padding as tall as a pinned head, so focus never lands under it (WCAG 2.4.11). */
export const useScrollPadding = (
  region: HTMLElement | null,
  head: HTMLElement | null,
  shown = true,
) => {
  useEffect(() => {
    if (region === null || head === null) return;
    const pad = () => {
      const size = `${Math.round(head.offsetHeight)}px`;
      region.style.scrollPaddingBlockStart = size;
      region.style.setProperty(pinnedSizeProperty, size);
    };
    pad();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(pad);
    observer?.observe(head);
    return () => {
      observer?.disconnect();
      region.style.scrollPaddingBlockStart = '';
      region.style.removeProperty(pinnedSizeProperty);
    };
  }, [region, head, shown]);
};
