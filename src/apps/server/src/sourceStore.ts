import type { Source } from '@ka/contract';

const MAX_CONVERSATIONS = 500;
const store = new Map<string, Source[]>();

export function remember(conversationId: string, sources: Source[]): void {
  if (!conversationId || !sources.length) return;
  store.delete(conversationId);
  store.set(conversationId, sources);
  while (store.size > MAX_CONVERSATIONS) {
    store.delete(store.keys().next().value as string);
  }
}

export const recall = (conversationId: string): Source[] => store.get(conversationId) ?? [];

export const forget = (conversationId: string): void => void store.delete(conversationId);
