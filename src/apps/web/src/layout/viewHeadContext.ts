import { createContext } from 'react';

/**
 * The pinned head of a scrolling region, placed first in it by the shell: with `position: sticky`
 * anything above it in the same box hides under it, focus ring included (WCAG 2.4.11).
 * `element` is null until mounted; the context is absent outside a shell.
 */
export type ViewHeadContextValue = {
  /** The shell's box for this slot, or null before it has been mounted. */
  element: HTMLElement | null;
};

export const ViewHeadContext = createContext<ViewHeadContextValue | undefined>(undefined);
