import { useCallback, useEffect, useState } from 'preact/hooks';
import type { ConversationSummary, Message, Source } from '@ka/contract';

export function useConversations() {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sourcesByThread, setSourcesByThread] = useState<Record<string, Source[]>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) return;
      const body = (await res.json()) as { conversations: ConversationSummary[] };
      setList(body.conversations);
    } catch {
      /* not worth an error banner */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(async (id: string): Promise<Record<string, string[]>> => {
    setActiveId(id);
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
      if (!res.ok) return {};
      const body = (await res.json()) as {
        messages: Message[];
        sources?: Source[];
        filter?: Record<string, string[]>;
      };
      setMessages(body.messages);
      if (body.sources?.length) {
        setSourcesByThread((m) => ({ ...m, [id]: body.sources as Source[] }));
      }
      return body.filter ?? {};
    } catch {
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  const startNew = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  const noteCreated = useCallback((c: ConversationSummary) => {
    setActiveId(c.id);
    setList((l) => (l.some((x) => x.id === c.id) ? l : [c, ...l]));
  }, []);

  const rememberSources = useCallback((threadId: string, sources: Source[]) => {
    if (!threadId || sources.length === 0) return;
    setSourcesByThread((m) => ({ ...m, [threadId]: sources }));
  }, []);

  const appendTurn = useCallback((question: string, answer: string) => {
    const now = Date.now();
    setMessages((m) => [
      ...m,
      { id: `local-u-${now}`, role: 'user', text: question, created: now },
      { id: `local-a-${now}`, role: 'assistant', text: answer, created: now + 1 },
    ]);
  }, []);

  const rename = useCallback(
    async (id: string, title: string) => {
      setList((l) => l.map((c) => (c.id === id ? { ...c, topic: title } : c)));
      await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(() => void refresh());
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setList((l) => l.filter((c) => c.id !== id));
      setActiveId((cur) => (cur === id ? null : cur));
      setMessages((m) => (activeId === id ? [] : m));
      await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(
        () => void refresh(),
      );
    },
    [activeId, refresh],
  );

  return {
    list,
    activeId,
    messages,
    sourcesByThread,
    rememberSources,
    loading,
    open,
    startNew,
    noteCreated,
    appendTurn,
    rename,
    remove,
    refresh,
  };
}
