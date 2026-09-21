/** `X-User-Id` always comes from the session, never from a request. */
import type { ConversationDetail, ConversationSummary, Message } from '@ka/contract';
import { config } from './config.ts';
import { noteTitleFromBackend } from './capabilities.ts';

const headers = (userId: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'X-API-Key': config.apiKey,
  'X-User-Id': userId,
});

interface BackendConversation {
  id: string;
  topic?: string;
  created?: number;
}

const toSummary = (c: BackendConversation): ConversationSummary => ({
  id: c.id,
  topic: c.topic?.trim() || 'Uten tittel',
  created: c.created ?? 0,
});

export function topicFrom(query: string): string {
  const one = query.replace(/\s+/g, ' ').trim();
  return one.length <= 60 ? one : `${one.slice(0, 57)}…`;
}

export async function list(userId: string): Promise<ConversationSummary[]> {
  const res = await fetch(`${config.apiBase}/api/conversations?page_size=100`, {
    headers: headers(userId),
  });
  if (!res.ok) throw new Error(`list ${res.status}`);
  const body = (await res.json()) as { conversations?: BackendConversation[] };
  return (body.conversations ?? []).map(toSummary).sort((a, b) => b.created - a.created);
}

export async function create(userId: string, topic: string): Promise<ConversationSummary> {
  const res = await fetch(`${config.apiBase}/api/conversations`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ agentId: config.agentId, title: topic }),
  });
  if (!res.ok) throw new Error(`create ${res.status}`);
  const body = (await res.json()) as { conversation: BackendConversation };
  const summary = toSummary(body.conversation);
  noteTitleFromBackend(topic, summary.topic);
  return summary;
}

export async function detail(userId: string, id: string): Promise<ConversationDetail> {
  const res = await fetch(`${config.apiBase}/api/conversations/${encodeURIComponent(id)}`, {
    headers: headers(userId),
  });
  if (!res.ok) throw new Error(`detail ${res.status}`);
  const body = (await res.json()) as {
    conversation: BackendConversation;
    messages?: Array<{ id: string; role: string; text: string; created: number }>;
  };
  const messages: Message[] = (body.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: m.text ?? '',
      created: m.created ?? 0,
    }));
  return { conversation: toSummary(body.conversation), messages };
}

export async function rename(userId: string, id: string, title: string): Promise<void> {
  const res = await fetch(`${config.apiBase}/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: headers(userId),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`rename ${res.status}`);
}

export async function remove(userId: string, id: string): Promise<void> {
  const res = await fetch(`${config.apiBase}/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(userId),
  });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}
