import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

// A list shows what was chosen when it opened first, and nothing moves while it is open.

/** The values the list puts first; an opening starts at the top. */
export const useChosenFirst = (
  selected: readonly string[],
  list: RefObject<HTMLElement | null>,
): ReadonlySet<string> => {
  const [atOpen, setAtOpen] = useState<readonly string[]>();
  const latest = useRef(selected);
  useLayoutEffect(() => {
    latest.current = selected;
  });

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let open = !element.hidden;
    const observer = new MutationObserver(() => {
      if (open === !element.hidden) return;
      open = !element.hidden;
      if (open) element.scrollTop = 0;
      setAtOpen(open ? latest.current : undefined);
    });
    observer.observe(element, { attributes: true, attributeFilter: ['hidden'] });
    return () => observer.disconnect();
  }, [list]);

  return useMemo(() => new Set(atOpen ?? selected), [atOpen, selected]);
};

/** The items that go first, then the rest, each part in the order given. */
export const chosenFirst = <T>(items: readonly T[], first: (item: T) => boolean): T[] => [
  ...items.filter(first),
  ...items.filter((item) => !first(item)),
];

// After a change with the list open, it is placed again from the height that fits there.

/** Designsystemet's own: the room less 20 px, never under 50 px (`size` in its popover.ts). */
const MARGIN = 20;
const LEAST = 50;

export const useListFollowsField = (
  selected: readonly string[],
  list: RefObject<HTMLElement | null>,
  field: RefObject<HTMLInputElement | null>,
) => {
  useLayoutEffect(() => {
    const element = list.current;
    const input = field.current;
    if (!element || !input || element.hidden) return;
    // After u-combobox has moved the chips, before the observers that move the list.
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
};
