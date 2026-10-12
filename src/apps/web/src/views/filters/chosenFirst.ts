// A list shows what is chosen first. When it opens, the values chosen then come first and the
// rest follow, each part in the order given. Nothing moves while it is open, so a value chosen or
// taken off there stays under the pointer; the order is taken again the next time it opens.
// Changes made with the list shut, as with «Velg alle» and «Tøm», show at the next opening.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';

/**
 * The values the list puts first: those chosen when it opened, or, while it is shut, those
 * chosen now. u-datalist opens and shuts the list with `hidden`. It also keeps where the list
 * was scrolled, which would open the new order part way down, so an opening starts at the top.
 */
export function useChosenFirst(
  selected: readonly string[],
  list: RefObject<HTMLElement | null>,
): ReadonlySet<string> {
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
}

/** The items that go first, then the rest, each part in the order given. */
export function chosenFirst<T>(items: readonly T[], first: (item: T) => boolean): T[] {
  return [...items.filter(first), ...items.filter((item) => !first(item))];
}
