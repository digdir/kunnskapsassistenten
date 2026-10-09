import { use } from 'react';
import { ThreadContext, type ThreadContextValue } from './threadContext';

/**
 * The conversation on screen, and the way to start one. The compose field's view calls
 * `startThread(question)` when it sends; until then the conversation has no address, and
 * «Kopier lenke til tråden» copies the front page.
 */
export function useThread(): ThreadContextValue {
  const value = use(ThreadContext);
  if (!value) {
    throw new Error('useThread må brukes inne i en ChatSlotView.');
  }
  return value;
}
