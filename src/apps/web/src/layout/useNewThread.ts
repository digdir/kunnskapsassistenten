import { use, useCallback, type MouseEvent } from 'react';
import { emptyFilterSelection } from '../model';
import { FilterContext } from './filterContext';
import { LayoutContext } from './layoutContext';
import { useDrawerMode } from './useDrawerMode';
import type { Slot } from './viewModel';

/**
 * «Ny tråd» as the whole action (digdir/kunnskapsassistenten#114). The link still navigates, so
 * middle-click and «open in new tab» work. A plain click also empties the filter, closes an open
 * drawer (it would cover the new thread) and asks for focus in the compose field.
 */
export function useNewThread(): (event: MouseEvent<HTMLAnchorElement>) => void {
  const filter = use(FilterContext);
  const layout = use(LayoutContext);
  const drawer = useDrawerMode();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      filter?.setSelection(emptyFilterSelection);

      if (drawer && layout) {
        for (const slot of sidebars) {
          if (!layout.layout.slots[slot].collapsed) layout.setCollapsed(slot, true);
        }
      }

      composerFocusRequested = true;
      askedForNewThread();
    },
    [drawer, filter, layout],
  );
}

const sidebars: Slot[] = ['primary-sidebar', 'secondary-sidebar'];

// Whether «Ny tråd» asked for the compose field, answered once: only the conversation the link
// opened may take focus. A module variable, not `history.state`, which survives a reload and
// would steal focus from the skip link.
let composerFocusRequested = false;

export function takeComposerFocusRequest(): boolean {
  const requested = composerFocusRequested;
  composerFocusRequested = false;
  return requested;
}

// How often «Ny tråd» was clicked or the open thread deleted; the chat slot keys `/` on it. Not
// `location.key`: closing a dialog navigates too, and would wipe a half-written question.
// Subscribable, because the click has to re-render the slot.
let newThreads = 0;
const listeners = new Set<() => void>();

/**
 * A new conversation in the chat slot, for deleting the thread on screen: a thread started on `/`
 * still has `/` in the router, so navigating there changes nothing.
 */
export function askedForNewThread(): void {
  newThreads += 1;
  for (const listener of [...listeners]) listener();
}

export function newThreadCount(): number {
  return newThreads;
}

export function subscribeToNewThread(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
