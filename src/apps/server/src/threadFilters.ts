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
 * Remembers a new thread's filter once its first turn has an answer.
 *
 * Not when the thread is created: a filter the backend refuses fails the
 * turn, and every follow-up would then be asked with the stored filter and
 * fail the same way. A turn that ends in `error` stores nothing.
 */
export function rememberWhenAnswered(
  conversationId: string,
  filter: Record<string, string[]>,
): (event: TurnEvent) => void {
  return (event) => {
    if (event.type === 'done') remember(conversationId, filter);
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
