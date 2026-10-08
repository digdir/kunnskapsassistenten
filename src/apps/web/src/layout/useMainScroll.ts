import { use, useCallback, type RefObject } from 'react';
import { MainScrollContext } from './scrollContext';

export type MainScroll = {
  /** The main slot's scrolling element. Read `current` in effects or handlers, never in render. */
  ref: RefObject<HTMLElement | null>;
  /** Scrolls the main slot to the bottom. Does nothing if it is not mounted. */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
};

/**
 * The scroll container of the main slot, for a view that has to follow a
 * growing answer or offer «bla til nederst». See scrollContext.ts.
 */
export function useMainScroll(): MainScroll {
  const ref = use(MainScrollContext);
  if (!ref) {
    throw new Error('useMainScroll må brukes inne i skallet.');
  }

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const element = ref.current;
      if (element) element.scrollTo({ top: element.scrollHeight, behavior });
    },
    [ref],
  );

  return { ref, scrollToBottom };
}
