import { useEffect, useState } from 'react';

/**
 * Whether a scrolling region needs its own tab stop: it scrolls and holds nothing focusable (WCAG
 * 2.1.1, axe `scrollable-region-focusable`). Re-measured on resize and content change; a callback
 * ref, because the region remounts across the drawer breakpoint.
 */
export function useScrollTabStop(): [boolean, (element: HTMLElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  const [reachable, setReachable] = useState(false);

  useEffect(() => {
    if (element === null) return;

    const measure = () => {
      setScrolls(element.scrollHeight > element.clientHeight);
      setReachable(hasTabbable(element));
    };

    // jsdom has no ResizeObserver. Content is still watched, so a test can hand the sizes to an
    // observer it installs itself.
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
}

// What Tab can land on, by attribute rather than layout, so browsers and tests agree. This app
// hides things with `[hidden]` and `[inert]`.
const TABBABLE = [
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

function hasTabbable(region: HTMLElement): boolean {
  for (const candidate of region.querySelectorAll(TABBABLE)) {
    if (candidate.getAttribute('tabindex') === '-1') continue;
    if (candidate.closest('[hidden], [inert]')) continue;
    return true;
  }
  return false;
}
