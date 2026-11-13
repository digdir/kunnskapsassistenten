import { useLayoutEffect, useState, type RefObject } from 'react';

/** The element's height in whole pixels while `active`, kept up to date; undefined unmeasured. */
export function useBlockSize(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): number | undefined {
  const [size, setSize] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || element === null) {
      setSize(undefined);
      return;
    }
    const measure = () => setSize(Math.ceil(element.getBoundingClientRect().height) || undefined);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, active]);

  return size;
}
