import { use } from 'react';
import { ThreadContext, type ThreadContextValue } from './threadContext';

/**
 * The conversation on screen, and the way to start one.
 *
 * A view that owns a compose field calls `startThread(question)` when it
 * sends. That is what gives the conversation an address: until it has one,
 * «Kopier lenke til tråden» copies the front page (C16 in
 * design/funksjonssjekk-v1.md).
 */
export function useThread(): ThreadContextValue {
  const value = use(ThreadContext);
  if (!value) {
    throw new Error('useThread må brukes inne i en ChatSlotView.');
  }
  return value;
}
