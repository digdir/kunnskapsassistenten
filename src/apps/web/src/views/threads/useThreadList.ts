import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatClient } from '../../api';
import { AnswerSourcesContext } from '../../layout/answerSourcesContext';
import { useOpenThread } from '../../layout/useOpenThread';
import type { AnswerSources, Thread } from '../../model';

/**
 * The thread list, kept in step with the conversation on screen.
 *
 * `ThreadsView` fetched once on mount, and that was wrong the moment the list
 * could be open while somebody asked a question: the thread they had just
 * made was not in the list until they switched to the filter view and back
 * (measured by KA CC on #63). The list is a view of the same conversations
 * the chat view is writing, so it has to re-read them when they change.
 *
 * Nothing polls. The shell already says everything needed to know that
 * something changed — see `conversationRevision` below — so a refresh happens
 * on the render where it happened and not a second later.
 */
export type ThreadList = {
  /** Undefined until the first read answers. */
  threads: Thread[] | undefined;
  /** The first read failed and there is nothing to show. */
  failed: boolean;
  /** Read again after a failure. */
  retry: () => void;
  /**
   * Change the list on screen before the backend has answered: a new name,
   * a deleted row. Returns the list as it was, so a failure can put it back.
   */
  change: (update: (threads: Thread[]) => Thread[]) => Thread[] | undefined;
};

/**
 * What the shell knows about the conversation, as one comparable string.
 *
 * Two things move it, and between them they cover both ways the list goes
 * stale:
 *
 *   The open thread's id, which changes when a question asked on `/` mints a
 *   thread. That thread is in the store before the shell is told, so a read
 *   that follows this change sees it.
 *
 *   The answers that have stopped streaming, which is when a turn has been
 *   written down and the thread's `updatedAt` has moved. Streaming answers
 *   are deliberately left out: the row would be re-read once per token and
 *   nothing about it would differ.
 *
 * The sources are used as a clock rather than as data — the list draws none
 * of them. It is the only thing the shell holds that moves when an answer
 * lands, and `answers` is the honest half of it: it carries one entry per
 * answer with its status, so it says «a turn settled» without the list having
 * to know anything about what was in it. If the chat view ever stops
 * reporting its answers this stops ticking, and the list would then want a
 * signal of its own from the shell.
 */
export function conversationRevision(
  openThreadId: string | undefined,
  answers: AnswerSources[] | undefined,
): string {
  const settled = (answers ?? [])
    .filter((answer) => answer.status !== 'streaming')
    .map((answer) => answer.messageId);

  return `${openThreadId ?? ''}|${settled.join(',')}`;
}

/**
 * Read the thread list, and read it again when the conversation moves.
 *
 * `given` overrides the fetch, for tests and for a view mounted with fixtures.
 */
export function useThreadList(given?: Thread[]): ThreadList {
  const client = useMemo(() => createChatClient(), []);
  const [threads, setThreads] = useState<Thread[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const openThreadId = useOpenThread();
  /*
   * The context itself and not `useAnswerSources()`, which throws outside a
   * LayoutProvider. That is right for the sources panel, which has nothing to
   * draw without it, and wrong here: this is a clock tick, and a list mounted
   * on its own should still be a list. Same reason OpenThreadContext has an
   * inert default.
   */
  const answers = use(AnswerSourcesContext)?.answers;
  const revision = conversationRevision(openThreadId, answers);

  /*
   * What is on screen, as a ref, so a failed read can tell the two cases
   * apart: nothing to show, which is an error state, and a refresh that
   * failed while a perfectly good list is on screen, which is not worth
   * replacing the list with an error the reader can do nothing about.
   */
  const shown = useRef<Thread[] | undefined>(given);
  const inFlight = useRef<AbortController | undefined>(undefined);
  /*
   * Which read is the current one. Two can overlap — the first one is still
   * out when the reader's question settles — and the answer that comes back
   * last is not necessarily the newest. The ticket, not the order of arrival,
   * decides who may write.
   */
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
        // A refresh that fails leaves the list alone. A first read that fails
        // has left the reader with skeletons, and has to say so.
        if (!shown.current) setFailed(true);
      });
  }, [client]);

  useEffect(() => {
    if (given) return;

    read();
    return () => inFlight.current?.abort();
  }, [given, read, attempt]);

  /*
   * The revision as it was when this list was last read, so the mount does
   * not read twice. A ref rather than state: it is bookkeeping for the effect
   * below and nothing renders from it.
   */
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

  /*
   * A change the reader made wins over a read that was already out. That read
   * was asked before the change reached the backend, so it answers with the
   * old title or the deleted row, and landing after the change it would put
   * them back for as long as the next read takes. The ticket moves on, and the
   * answer is thrown away when it comes.
   */
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
