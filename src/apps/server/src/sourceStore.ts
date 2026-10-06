import type { Source, TurnEvent } from '@ka/contract';

const MAX_CONVERSATIONS = 500;
const store = new Map<string, Source[]>();

/**
 * The sources of a conversation's last answer, for `GET /api/conversations/:id`.
 * An empty set is stored like any other: an answer without sources has none
 * after a reload, rather than the ones the answer before it had.
 */
export function remember(conversationId: string, sources: Source[]): void {
  if (!conversationId) return;
  store.delete(conversationId);
  store.set(conversationId, sources);
  while (store.size > MAX_CONVERSATIONS) {
    store.delete(store.keys().next().value as string);
  }
}

/**
 * Reads one answer's sources off its events as they pass.
 *
 * `ask` sends no `sources` event when the answer has none (mcp.ts), so the
 * empty set is remembered when `done` comes without one. A turn that ends in
 * `error` changes nothing: the last answer's sources stay the last answer's.
 */
export function answerSources(conversationId: string): (event: TurnEvent) => void {
  let seen = false;
  return (event) => {
    if (event.type === 'sources') {
      seen = true;
      remember(conversationId, event.sources);
    } else if (event.type === 'done' && !seen) {
      remember(conversationId, []);
    }
  };
}

export const recall = (conversationId: string): Source[] => store.get(conversationId) ?? [];

export const forget = (conversationId: string): void => void store.delete(conversationId);
