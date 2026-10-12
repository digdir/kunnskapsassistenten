// Designsystemet places the list when it opens: below the field, or above it when there is more
// room there (`flip`), and as high as the room allows (`size`). The height is set once. A choice
// can add a row of chips and move the field, and the list then follows it at its first height,
// out of the window or, flipped, over its top edge. So after a change with the list open, it is
// placed again, starting from the height that fits where it stands: it stays there, and does
// not jump over the field while the pointer is in it, until less than Designsystemet's least
// height is left.

import { useLayoutEffect, type RefObject } from 'react';

/** Designsystemet's own: the room less 20 px, never under 50 px (`size` in its popover.ts). */
const MARGIN = 20;
const LEAST = 50;

export function useListFollowsField(
  selected: readonly string[],
  list: RefObject<HTMLElement | null>,
  field: RefObject<HTMLInputElement | null>,
) {
  useLayoutEffect(() => {
    const element = list.current;
    const input = field.current;
    if (!element || !input || element.hidden) return;
    // After u-combobox has put the new chips in their row, in its MutationObserver: until then
    // they stand elsewhere, and the field 16 px higher (measured). Before the observers that
    // move the list, so it never shows at the old height.
    queueMicrotask(() => {
      if (!element.isConnected || element.hidden) return;
      const gap = Number.parseFloat(getComputedStyle(element).scrollMarginBottom) || 0;
      const box = input.getBoundingClientRect();
      const room = element.getAttribute('data-floating')?.startsWith('top')
        ? box.top - gap
        : document.documentElement.clientHeight - box.bottom - gap;
      element.style.maxHeight = `${Math.max(LEAST, room - MARGIN)}px`;
      // The event ds-suggestion sends when the list opens, which places it from the start.
      element.dispatchEvent(
        new CustomEvent('ds-toggle-source', { bubbles: true, composed: true, detail: input }),
      );
    });
  }, [selected, list, field]);
}
