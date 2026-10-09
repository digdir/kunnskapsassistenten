import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatClient } from '../../api';
import { AnswerSourcesContext } from '../../layout/answerSourcesContext';
import { useOpenThread } from '../../layout/useOpenThread';
import type { AnswerSources, Thread } from '../../model';

export type ThreadList = {
  /** Undefined until the first read answers. */
  threads: Thread[] | undefined;
  /** The first read failed and there is nothing to show. */
  failed: boolean;
  /** Read again after a failure. */
  retry: () => void;
  /** Changes the list before the backend answers. Returns the list as it was. */
  change: (update: (threads: Thread[]) => Thread[]) => Thread[] | undefined;
};

/** The open thread's id, `|`, and the ids of the answers no longer streaming, comma-separated:
 * it moves when a question on `/` mints a thread or a turn is written. Streaming answers are
 * left out, or the list would re-read once per token. */
export function conversationRevision(
  openThreadId: string | undefined,
  answers: AnswerSources[] | undefined,
): string {
  const settled = (answers ?? [])
    .filter((answer) => answer.status !== 'streaming')
    .map((answer) => answer.messageId);

  return `${openThreadId ?? ''}|${settled.join(',')}`;
}

/** Reads the thread list, and again whenever `conversationRevision` moves (no polling).
 * `given` overrides the fetch, for tests and fixtures. */
export function useThreadList(given?: Thread[]): ThreadList {
  const client = useMemo(() => createChatClient(), []);
  const [threads, setThreads] = useState<Thread[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const openThreadId = useOpenThread();
  // The context, not `useAnswerSources()`, which throws outside a
  // LayoutProvider: a list mounted on its own should still be a list.
  const answers = use(AnswerSourcesContext)?.answers;
  const revision = conversationRevision(openThreadId, answers);

  const shown = useRef<Thread[] | undefined>(given);
  const inFlight = useRef<AbortController | undefined>(undefined);
  // Reads can overlap and arrive out of order; only the latest ticket writes.
  const ticket = useRef(0);

  const read = useCallback(() => {
    inFlight.current?.abort();
    const abort = new AbortController();
    inFlight.current = abort;
    const mine = ++ticket.current;

    client
      .listThreads(abort.signal)
      .then((fresh) => {
        if (mine !== ticket.current) return;
        shown.current = fresh;
        setThreads(fresh);
      })
      .catch(() => {
        if (mine !== ticket.current || abort.signal.aborted) return;
        // A failed refresh leaves a good list alone rather than show an error
        // the reader can do nothing about; a failed first read has to say so.
        if (!shown.current) setFailed(true);
      });
  }, [client]);

  useEffect(() => {
    if (given) return;

    read();
    return () => inFlight.current?.abort();
  }, [given, read, attempt]);

  // The revision last read, so the mount does not read twice.
  const lastRead = useRef(revision);

  useEffect(() => {
    if (given || revision === lastRead.current) return;

    lastRead.current = revision;
    read();
  }, [given, read, revision]);

  // Clearing the error here rather than in the effect: the retry click is
  // what changed, and setting state inside an effect starts another render.
  const retry = useCallback(() => {
    shown.current = undefined;
    setThreads(undefined);
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  // A change wins over a read already out: asked before the change reached the
  // backend, it would put the old title or the deleted row back. The ticket
  // moves on, so its answer is thrown away.
  const change = useCallback((update: (threads: Thread[]) => Thread[]) => {
    const before = shown.current;
    if (!before) return undefined;
    ticket.current += 1;
    inFlight.current?.abort();
    const after = update(before);
    shown.current = after;
    setThreads(after);
    return before;
  }, []);

  return { threads, failed, retry, change };
}
