import { createContext } from 'react';

/**
 * Which conversation is on screen, held above the views.
 *
 * The chat view knows it — it reads the thread from the route, and it mints
 * one when the reader asks the first question on `/` — and the thread list
 * has to draw it: the row for the open thread carries `aria-current="page"`,
 * and that attribute, not the colour, is what tells a screen reader user
 * where they are.
 *
 * Neither view may import the other, and neither can own it, so the shell
 * holds it. Same reason as the active citation, the document filter and the
 * sources behind the answer. See citationContext.ts.
 *
 * It exists because the router could not answer the question. A conversation
 * started on `/` gets its address from `history.replaceState`, deliberately —
 * a real navigation would change `useParams`, remount the chat slot and take
 * the answer streaming into it with it — and `NavLink` never sees that, so
 * the row for the thread the reader had just made stayed unmarked until the
 * next reload. Measured by KA CC on `main` 2c7f250; for a screen reader an
 * open thread without `aria-current` is a thread that is not open.
 */
export type OpenThreadContextValue = {
  /** The conversation on screen, or undefined on a page that has none. */
  openThreadId?: string;
  /** Say which one it is. Called by the view that holds the conversation. */
  setOpenThreadId: (threadId: string | undefined) => void;
};

/**
 * Inert by default rather than undefined, for the reason ComposerContext
 * gives: this is a view telling the chrome something, and a view mounted on
 * its own — every view test, in four owners' folders — should not have to
 * build a provider to say it.
 */
export const OpenThreadContext = createContext<OpenThreadContextValue>({
  setOpenThreadId: () => {},
});
