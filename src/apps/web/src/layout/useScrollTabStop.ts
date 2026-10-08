import { useEffect, useState } from 'react';

/**
 * Whether a scrolling region needs a tab stop of its own: it scrolls, and
 * nothing inside it can take the keyboard.
 *
 * For the sidebars' scrolling region (WCAG 2.1.1; axe's
 * `scrollable-region-focusable`). Found by KA CC in bff mode with no BFF
 * behind it: the filter panel waits for the BFF with only skeletons in it,
 * and at 1280 × 720 it scrolls 786 px of content in a 592 px window with not
 * one control to tab to — the «Tråder» button is on the panel's own row,
 * outside the region.
 *
 * Only then, and that is the rule Chromium has used since 130 and the one axe
 * checks. A region with a control in it can already be scrolled from the
 * keyboard: the browser scrolls the control into view, and the arrow keys
 * scroll the region around it. The filter panel always scrolls at 1440 and
 * 1280 — 1137 px in 713 — and a stop there for every keyboard user, between
 * «Tråder» and the corpus chooser, was the price of the first version (KA CC
 * on #211). The stop is for the region nobody could otherwise reach.
 *
 * Returns a callback ref and not a ref object, because the region is not one
 * element for life: the shell draws the same content in the panel on the row
 * or inside the drawer, and crossing the breakpoint mounts it in the other.
 *
 * Measured, not worked out, and on three kinds of change:
 *
 *   - the region's own box, which changes with the window;
 *   - its children's boxes, which is how content grows or shrinks — a view
 *     that loads, a list that expands — without the region's box moving;
 *   - what is in it, which is how a control appears or goes away: skeletons
 *     that become fields, fields that give way to a lock.
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

    // jsdom has no ResizeObserver. What is in the region is still watched,
    // so a test can hand the sizes to the observer it installs itself.
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

/**
 * What the Tab key can land on, by the attributes that decide it.
 *
 * By selector and not by asking the layout, so it gives the same answer in a
 * browser and in a test. `[hidden]` and `[inert]` are what this app hides
 * with, including the suggestion lists and a collapsed slot; `tabindex="-1"`
 * takes an element out of the order whatever it is.
 */
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
