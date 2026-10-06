import { use, useCallback, type MouseEvent } from 'react';
import { emptyFilterSelection } from '../model';
import { FilterContext } from './filterContext';
import { LayoutContext } from './layoutContext';
import { useDrawerMode } from './useDrawerMode';
import type { Slot } from './viewModel';

/**
 * «Ny tråd» as the whole action, and not only the link to `/` (issue
 * 114): an empty conversation, an empty filter, the drawer out of the way and
 * the keyboard in the compose field. The link still does the navigating, so
 * it stays a real link — middle-click and «open in new tab» work, and a
 * screen reader says «lenke». The conversation is emptied by the navigation
 * itself; see the key in ChatSlotView.tsx.
 *
 * The rest is done on the click, before the link navigates:
 *
 *   - The filter is emptied. A new thread starts from the whole corpus, which
 *     is what the reader expects to see (issue 114). The reader's own choice
 *     goes, not only the lock: the lock goes by itself when the thread does.
 *   - An open drawer is closed. Below the drawer breakpoint the list is a
 *     modal over the conversation, and the new one would start behind it.
 *     Only then: beside the answer column the panel is not in the way, and
 *     closing it would be closing something the reader opened.
 *   - The compose field is asked for, and the chat slot gives it focus when
 *     the new conversation has mounted — after the drawer has shut and the
 *     browser has handed focus back to the rail button. See
 *     `takeComposerFocusRequest`.
 *
 * A click that opens a new tab or window changes nothing here: this page is
 * not the one the reader is going to.
 *
 * Both contexts are read without requiring them, so a view mounted on its own
 * — every view test — keeps working; there is simply nothing to empty or to
 * close there.
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

/**
 * Whether «Ny tråd» asked for the compose field, and the answer only once.
 *
 * A module variable and not router state. State lives in `history.state`,
 * which survives a reload, and the next page load would take the focus away
 * from the skip link. Nothing here outlives the page, which is right: the
 * request is about the navigation that is happening now.
 *
 * **Once** is the whole contract. Every conversation asks on mount, and only
 * the one the link navigated to is allowed a yes — a thread opened from the
 * list a moment later would otherwise pull the keyboard out of the row the
 * reader was standing in.
 */
let composerFocusRequested = false;

export function takeComposerFocusRequest(): boolean {
  const requested = composerFocusRequested;
  composerFocusRequested = false;
  return requested;
}

/**
 * How many times «Ny tråd» has been clicked in this page load.
 *
 * The chat slot keys `/` on this number, so a click gives a new conversation
 * and nothing else does. It used to key on `location.key`, which is a fair
 * reading of «a navigation to `/` is a new front page» — but it counts
 * navigations nobody asked a new conversation of. Closing the settings menu
 * is one: it is `navigate({ hash: '' }, { replace: true })`, which mints a new
 * `location.key`, so a half-written question on `/` was wiped by opening and
 * shutting a dialog (KA CC on #208, with #203 in).
 *
 * A counter and not a boolean, because two «Ny tråd» clicks in a row are two
 * new conversations and a boolean would make the second one a no-op.
 *
 * Subscribable rather than read bare: a module variable changing is not
 * something React can see, and the click that bumps it has to re-render the
 * slot that reads it. Same shape as `subscribeToCorpus` in src/api/corpus.ts.
 */
let newThreads = 0;
const listeners = new Set<() => void>();

function askedForNewThread(): void {
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
