import { createContext } from 'react';
import type { Thread } from '../model';

export type ThreadContextValue = {
  /**
   * The conversation on screen, or undefined on an untouched front page.
   *
   * It comes from the route when the route names one, and from
   * `startThread()` when the user asks the first question on `/`.
   */
  thread?: Thread;
  /**
   * Tell the shell that a question is starting a conversation.
   *
   * Called by whichever view owns the compose field, once per question. It is
   * a no-op after the first: a thread that already exists keeps its id, its
   * title and its address.
   *
   * Returns the thread the question belongs to, so the caller never has to
   * ask twice or guess whether it made a new one.
   */
  startThread: (question: string) => Thread;
};

/**
 * Lives in its own file so the slot view exports nothing but a component and
 * Fast Refresh keeps working. Same reason as layoutContext.ts.
 */
export const ThreadContext = createContext<ThreadContextValue | undefined>(undefined);
