import { use, useCallback, type RefObject } from 'react';
import { MainScrollContext } from './scrollContext';

export type MainScroll = {
  /**
   * The scrolling element in the main slot. Read `ref.current` in an effect
   * or a handler, never during render: it is null until the shell is mounted,
   * and reading it while rendering will not re-render when it changes.
   */
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
