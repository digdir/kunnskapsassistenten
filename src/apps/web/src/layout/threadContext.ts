import { createContext } from 'react';
import type { Thread } from '../model';

export type ThreadContextValue = {
  /** The conversation on screen, from the route or from `startThread()`; none on a fresh `/`. */
  thread?: Thread;
  /**
   * Returns this question's thread; only the first call creates it, so id and address stay.
   */
  startThread: (question: string) => Thread;
};

/** Own file so the slot view exports only a component and Fast Refresh keeps working. */
export const ThreadContext = createContext<ThreadContextValue | undefined>(undefined);
