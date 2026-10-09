import { createContext } from 'react';

/**
 * Which conversation is on screen, held above the views: the chat view knows it, and the thread
 * list marks its row with `aria-current="page"`. Not from the router: a thread started on `/`
 * gets its address through `history.replaceState`, which `NavLink` never sees.
 */
export type OpenThreadContextValue = {
  /** The conversation on screen, or undefined on a page that has none. */
  openThreadId?: string;
  /** Say which one it is. Called by the view that holds the conversation. */
  setOpenThreadId: (threadId: string | undefined) => void;
};

/**
 * Inert by default rather than undefined: a view telling the chrome something should not need a
 * provider when mounted on its own, as in every view test.
 */
export const OpenThreadContext = createContext<OpenThreadContextValue>({
  setOpenThreadId: () => {},
});
