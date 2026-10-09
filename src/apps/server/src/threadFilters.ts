import type { TurnEvent } from '@ka/contract';

/** The filter a thread was started with. The backend stores it but does not return it. */
const MAX_CONVERSATIONS = 500;
const store = new Map<string, Record<string, string[]>>();

export function remember(conversationId: string, filter: Record<string, string[]>): void {
  if (!conversationId || !Object.values(filter).some((v) => v.length)) return;
  store.delete(conversationId);
  store.set(conversationId, filter);
  while (store.size > MAX_CONVERSATIONS) {
    store.delete(store.keys().next().value as string);
  }
}

/**
 * Forgets a new thread's filter when its first turn ends in `error`, as when
 * the backend refuses the filter: every follow-up would fail the same way.
 */
export function forgetIfFailed(conversationId: string): (event: TurnEvent) => void {
  return (event) => {
    if (event.type === 'error') forget(conversationId);
  };
}

export function recall(conversationId: string): Record<string, string[]> | undefined {
  const filter = store.get(conversationId);
  if (filter) {
    store.delete(conversationId);
    store.set(conversationId, filter);
  }
  return filter;
}

export const forget = (conversationId: string): void => void store.delete(conversationId);
