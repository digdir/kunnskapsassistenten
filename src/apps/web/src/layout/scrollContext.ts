import { createContext, type RefObject } from 'react';

/**
 * The element that scrolls in the main slot.
 *
 * The slot owns the scroll, not the view in it, so a view that wants to
 * follow the bottom of a growing answer has to be handed the element. Walking
 * up the DOM to find it works until the day a view is mounted somewhere else,
 * and then it finds the wrong thing or nothing.
 *
 * The ref's current is null before the first paint and after unmount, so read
 * it inside an effect or a handler, never during render.
 */
export const MainScrollContext = createContext<RefObject<HTMLElement | null> | undefined>(
  undefined,
);
