/** EventSource cannot POST, so this reads the body directly — and can abort. */
import { useCallback, useRef, useState } from 'preact/hooks';
import type { Source, Stage, TurnEvent } from '@ka/contract';

export interface Turn {
  id: number;
  question: string;
  answer: string;
  sources: Source[];
  stage: Stage | null;
  iteration: number;
  maxIterations: number;
  queries: string[];
  error: string | null;
  running: boolean;
}

let nextId = 0;

const empty = (question: string): Turn => ({
  id: ++nextId,
  question,
  answer: '',
  sources: [],
  stage: null,
  iteration: 0,
  maxIterations: 10,
  queries: [],
  error: null,
  running: true,
});

interface Options {
  onConversationCreated?: (c: { id: string; topic: string }) => void;
}

export function useTurn({ onConversationCreated }: Options = {}) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (
      question: string,
      threadId?: string,
      model?: string,
      filter?: Record<string, string[]>,
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setTurn(empty(question));

      let res: Response;
      try {
        res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: question,
            conversationId: threadId ?? conversationId,
            ...(model ? { model } : {}),
            ...(filter && Object.values(filter).some((v) => v.length) ? { filter } : {}),
          }),
          signal: ac.signal,
        });
      } catch {
        const error = ac.signal.aborted ? 'Avbrutt.' : 'Fikk ikke kontakt med tjenesten.';
        setTurn((t) => t && { ...t, running: false, error });
        return;
      }

      if (!res.ok || !res.body) {
        setTurn((t) => t && { ...t, running: false, error: `Tjenesten svarte ${res.status}.` });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const apply = (e: TurnEvent) =>
        setTurn((t) => {
          if (!t) return t;
          switch (e.type) {
            case 'conversation':
              return t;
            case 'stage':
              return {
                ...t,
                stage: e.stage,
                iteration: e.iteration,
                maxIterations: e.maxIterations,
                queries: e.queries?.length ? e.queries : t.queries,
              };
            case 'delta':
              return { ...t, answer: t.answer + e.text };
            case 'sources':
              return { ...t, sources: e.sources };
            case 'done':
              return { ...t, running: false, stage: 'done' };
            case 'error':
              return { ...t, running: false, error: e.message };
          }
        });

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (!frame.startsWith('data: ')) continue;
            let event: TurnEvent;
            try {
              event = JSON.parse(frame.slice(6)) as TurnEvent;
            } catch {
              continue;
            }
            if (event.type === 'conversation') {
              setConversationId(event.id);
              onConversationCreated?.({ id: event.id, topic: event.topic });
            }
            if (event.type === 'done') setConversationId(event.conversationId);
            if (event.type === 'error' && event.conversationId) {
              setConversationId(event.conversationId);
            }
            apply(event);
          }
        }
      } catch {
        setTurn((t) => (t && t.running ? { ...t, running: false, error: 'Avbrutt.' } : t));
      }
    },
    [conversationId, onConversationCreated],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurn(null);
    setConversationId(null);
  }, []);

  return { turn, conversationId, ask, stop, reset };
}
