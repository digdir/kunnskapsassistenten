import { createContext, type RefObject } from 'react';

/**
 * The element that scrolls in the main slot. The slot owns the scroll, so a view that follows a
 * growing answer is handed the element rather than walking up the DOM. `current` is null before
 * the first paint and after unmount: read it in an effect or a handler, never during render.
 */
export const MainScrollContext = createContext<RefObject<HTMLElement | null> | undefined>(
  undefined,
);
