import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatClient } from '../../api';
import {
  emptyFilterSelection,
  isEmptySelection,
  type ChatError,
  type FilterSelection,
  type Message,
  type MessageStatus,
} from '../../model';
import { announcedText } from './answerText';
import {
  CLARIFICATION_ANNOUNCEMENT,
  NO_HITS_ANNOUNCEMENT,
  NO_HITS_FILTERED,
  NO_HITS_WHOLE_CORPUS,
  NO_SOURCES_WARNING,
} from './text';

/** The documents one question is asked with: ids for the wire, names for the
    thread. Both, because a name looked up later goes missing when the reader
    removes the file. */
export type AskAttachments = { ids: string[]; names: string[] };

/** Where the current turn is. Drives the skeleton, the stop button and the error. */
export type ChatStatus = 'idle' | 'pending' | 'streaming' | 'error';

/** What an answer can be once the turn is over. */
type SettledStatus = Extract<
  MessageStatus,
  'complete' | 'needs-clarification' | 'aborted' | 'error'
>;

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** The most recent thing the reader asked, or undefined in an empty thread. */
function lastQuestionIn(messages: Message[]): string | undefined {
  return messages.findLast((message) => message.role === 'user')?.content;
}

// The conversation without the turn «Generer på nytt» replaces: only the
// last, and only when it failed or was stopped. Older stopped turns survive a
// reload, and asking the newest question again is no reason to delete them.
function withoutTurnBeingRetried(messages: Message[]): Message[] {
  const last = messages.at(-1);
  const replacing =
    last?.role === 'assistant' && (last.status === 'error' || last.status === 'aborted');
  return replacing ? messages.slice(0, -1) : messages;
}

export type UseChat = {
  messages: Message[];
  status: ChatStatus;
  /** Why the turn failed, set only when status is 'error'. The code and not
      the sentence: the mapping belongs to the view (errorText.ts). */
  error: ChatError | null;
  /** What the polite live region should say now. Here and not in the view,
      because only this loop knows when a paragraph finished. */
  announcement: string;
  /** The filter each answer was asked under, by message id: what the reader
      chose then, not what is selected now. */
  appliedFilters: Record<string, FilterSelection>;
  /** The answers whose search came back empty, by message id. A fact about
      the turn, not something read back out of its words. */
  noHitsAnswers: ReadonlySet<string>;
  /** The documents each question was asked with, by the QUESTION's id. Names,
      since the thread draws them, and kept, so a document removed tomorrow
      does not rewrite yesterday's question. */
  attachmentsByMessage: Record<string, string[]>;
  send: (question: string, attachments?: AskAttachments) => void;
  /** Stop the generation and keep what has arrived. */
  cancel: () => void;
  /** Ask the last question again, in place of the answer that did not make
      it. «Prøv igjen» and «Generer på nytt» are the same move. */
  retry: () => void;
};

/**
 * The chat state machine: messages in, one streamed answer at a time.
 *
 *   idle       nothing in flight
 *   pending    question sent, no token yet — what the skeleton shows
 *   streaming  tokens arriving
 *   error      the turn failed; `error` carries the code
 *
 * **Two `error` codes do not mean failure, so the code checks the code and
 * not the event type:** `aborted` keeps the partial answer and goes to idle
 * under a status of its own, `no-hits` settles as `complete`. Only one turn
 * counts at a time; see `turnRef` in `run`.
 */
export function useChat(
  client: ChatClient,
  initialMessages: Message[] = [],
  filters: FilterSelection = emptyFilterSelection,
  corpusKey?: string,
  /** The agent to ask (`AgentChoice.model`). Undefined asks the default. */
  model?: string,
): UseChat {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // The stored thread arrives after this hook has mounted, so its messages
  // are ADOPTED in FRONT of the session, matched by id. Compared on what they
  // ARE: `initialMessages` defaults to a fresh `[]`, so a ref check loops.
  const threadSignature =
    initialMessages.length === 0 ? '' : `${initialMessages.length}:${initialMessages.at(-1)?.id}`;
  const [adopted, setAdopted] = useState(threadSignature);
  if (threadSignature !== '' && threadSignature !== adopted) {
    setAdopted(threadSignature);
    setMessages((current) => {
      if (current.length === 0) return initialMessages;
      const here = new Set(current.map((message) => message.id));
      const stored = initialMessages.filter((message) => !here.has(message.id));
      return stored.length === 0 ? current : [...stored, ...current];
    });
  }
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterSelection>>({});
  const [attachmentsByMessage, setAttachmentsByMessage] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<ChatError | null>(null);
  const [noHitsAnswers, setNoHitsAnswers] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const turnRef = useRef(0);
  const conversationRef = useRef<string | undefined>(undefined);
  const lastQuestionRef = useRef<string | null>(null);
  const lastAttachmentsRef = useRef<AskAttachments | undefined>(undefined);

  // For handlers that must read the conversation without being rebuilt by
  // it: `messages` changes on every token, so as a dependency it hands the
  // composer a new `retry` per word.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Switching corpus lets go of the conversation: its answers cite documents
  // that only exist in the old one. The draft stays. Emptied while rendering,
  // since an effect would draw the old conversation under the new corpus.
  const [corpusInUse, setCorpusInUse] = useState(corpusKey);
  if (corpusKey !== corpusInUse) {
    setCorpusInUse(corpusKey);
    setMessages([]);
    setAppliedFilters({});
    setAttachmentsByMessage({});
    setNoHitsAnswers(new Set());
    setAnnouncement('');
    setError(null);
    setStatus('idle');
  }

  useEffect(() => {
    abortRef.current?.abort();
    conversationRef.current = undefined;
    lastQuestionRef.current = null;
    lastAttachmentsRef.current = undefined;
  }, [corpusKey]);

  // Abort a turn still in flight when the view goes away, so the stream does
  // not keep setting state on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const patchAnswer = useCallback((id: string, patch: (message: Message) => Message) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? patch(message) : message)),
    );
  }, []);

  // End a turn: mark the answer, or drop it if nothing arrived — an empty
  // `<li>` tells a screen reader the assistant answered when it did not. A
  // stopped turn stays, because its card is what says it was stopped.
  const settleAnswer = useCallback(
    (id: string, status: SettledStatus, settled?: { createdAt?: string; corpusKey?: string }) => {
      // Stamped here and NOT when the placeholder was made, which gives one
      // answer two times a whole answer apart. The `done` frame's own time
      // wins, so the message and the stored turn are the same string.
      const settledAt = settled?.createdAt ?? new Date().toISOString();
      setMessages((current) => {
        const answer = current.find((message) => message.id === id);
        // The thinking panel counts as something to show: dropping on
        // `content.length === 0` alone takes «Jeg søker i dokumentene» with
        // it, on the one path where it is worth most.
        const hasNothingToShow =
          answer !== undefined &&
          answer.content.length === 0 &&
          (answer.thinkingSteps?.length ?? 0) === 0;
        if (hasNothingToShow && status !== 'aborted') {
          return current.filter((message) => message.id !== id);
        }
        return current.map((message) =>
          message.id === id
            ? {
                ...message,
                createdAt: settledAt,
                // Which corpus answered, from the frame that ended the
                // stream; the store answers «which is selected now».
                // `undefined` is «not known», never «the default corpus».
                ...(settled?.corpusKey === undefined ? {} : { corpusKey: settled.corpusKey }),
                status,
              }
            : message,
        );
      });
    },
    [],
  );

  const run = useCallback(
    async (question: string, answerId: string, attachments?: string[]) => {
      // Only the newest turn may write status, announcement or error: the
      // abort of the one before it lands a tick later and would say
      // «Genereringen ble avbrutt.» over a generation that is still running.
      const turn = (turnRef.current += 1);
      const isCurrentTurn = () => turnRef.current === turn;

      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('pending');
      setError(null);
      setAnnouncement('Henter svar.');

      // The running text, so a finished paragraph can be spotted without
      // reading it back out of state.
      let content = '';

      // Which «fant ingenting» answer fits, read from the filter the
      // question was asked under: telling a reader to loosen a filter they
      // never set sends them looking for a control they have not touched.
      const noHitsAnswer = isEmptySelection(filters) ? NO_HITS_WHOLE_CORPUS : NO_HITS_FILTERED;

      // Said once per turn: a dozen steps arrive seconds apart, and a region
      // that spoke per step would still be reading them out when the answer
      // arrived. The panel itself is silent, see ThinkingPanel.
      let saidSearching = false;

      // When the thinking started. The stream is where both ends of that
      // interval are: the first step, and the first word of the answer.
      let thinkingStartedAt: number | undefined;

      // How many documents came with the answer. One with none carries a
      // warning in its card, and a reader who only hears «ferdig» would not
      // know the warning is there.
      let sourceCount = 0;
      const doneAnnouncement = () =>
        content.trim() !== '' && sourceCount === 0
          ? `Svaret er ferdig. ${NO_SOURCES_WARNING}`
          : 'Svaret er ferdig.';

      try {
        for await (const event of client.ask({
          query: question,
          conversationId: conversationRef.current,
          // Part of the question, not a view decoration. The backend ignores
          // it today (API-bestilling A2) and it is sent regardless: that is
          // the contract.
          filters,
          // Which of the reader's own documents THIS question is about.
          // Separate from `filters`, which narrows the corpus and follows the
          // reader between questions.
          ...(attachments?.length ? { attachments } : {}),
          // Read when the question is sent: a choice made while an answer is
          // on its way is for the next question, not this one.
          ...(model ? { model } : {}),
          signal: controller.signal,
        })) {
          switch (event.type) {
            case 'token': {
              setStatus('streaming');
              const thoughtMs =
                thinkingStartedAt === undefined ? undefined : Date.now() - thinkingStartedAt;
              // Only the first token ends the thinking; the rest are the
              // answer being written.
              thinkingStartedAt = undefined;
              content += event.text;
              patchAnswer(answerId, (message) => ({
                ...message,
                content,
                ...(thoughtMs === undefined ? {} : { thoughtMs }),
              }));
              // Blocks are separated by a blank line, so only a token with a
              // newline in it can have finished one. Everything else would be
              // half a sentence.
              if (event.text.includes('\n')) {
                const finished = announcedText(content);
                if (finished) setAnnouncement(finished);
              }
              break;
            }

            case 'thinking-step':
              thinkingStartedAt ??= Date.now();
              patchAnswer(answerId, (message) => ({
                ...message,
                thinkingSteps: [...(message.thinkingSteps ?? []), event.step],
              }));
              if (!saidSearching && isCurrentTurn()) {
                saidSearching = true;
                setAnnouncement('Kunnskapsassistenten søker …');
              }
              break;

            case 'sources':
              sourceCount = event.documents.length;
              patchAnswer(answerId, (message) => ({
                ...message,
                sources: event.documents,
                citations: event.citations,
                retrieval: event.retrieval,
              }));
              break;

            case 'done': {
              conversationRef.current = event.conversationId;
              // `outcome` absent means the turn completed, which is what every
              // answer was before the field existed. See model/stream.ts.
              const clarifying = event.outcome === 'needs-clarification';
              settleAnswer(answerId, clarifying ? 'needs-clarification' : 'complete', event);
              if (isCurrentTurn()) {
                setAnnouncement(clarifying ? CLARIFICATION_ANNOUNCEMENT : doneAnnouncement());
                setStatus('idle');
              }
              return;
            }

            case 'error':
              if (event.error.code === 'aborted') {
                settleAnswer(answerId, 'aborted', event);
                if (isCurrentTurn()) {
                  setAnnouncement('Genereringen ble avbrutt.');
                  setStatus('idle');
                }
                return;
              }

              // Not a failure but an answer with an empty source list
              // (API-bestilling A16), so the turn finishes and the panel
              // stops waiting for excerpts that are not coming.
              if (event.error.code === 'no-hits') {
                patchAnswer(answerId, (message) => ({
                  ...message,
                  // Whatever the agent managed to write stands; the notice
                  // only stands in when it wrote nothing, which is the case
                  // this exists for.
                  content: message.content.length > 0 ? message.content : noHitsAnswer,
                  sources: [],
                  citations: [],
                }));
                settleAnswer(answerId, 'complete', event);
                setNoHitsAnswers((current) => new Set(current).add(answerId));
                if (isCurrentTurn()) {
                  setAnnouncement(NO_HITS_ANNOUNCEMENT);
                  setStatus('idle');
                }
                return;
              }

              settleAnswer(answerId, 'error', event);
              if (isCurrentTurn()) {
                setError(event.error);
                // The Alert has role="alert" and announces itself.
                setAnnouncement('');
                setStatus('error');
              }
              return;
          }
        }
        // The stream ended without a `done` frame. Nothing is in flight any
        // more, so the answer is as finished as it is going to get.
        settleAnswer(answerId, 'complete');
        if (isCurrentTurn()) {
          setAnnouncement(doneAnnouncement());
          setStatus('idle');
        }
      } catch {
        if (controller.signal.aborted) {
          settleAnswer(answerId, 'aborted');
          if (isCurrentTurn()) {
            setAnnouncement('Genereringen ble avbrutt.');
            setStatus('idle');
          }
          return;
        }
        settleAnswer(answerId, 'error');
        if (isCurrentTurn()) {
          // A client that threw rather than yielding an error frame says
          // nothing about what went wrong, which is what `unknown` means.
          setError({ code: 'unknown' });
          setAnnouncement('');
          setStatus('error');
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [client, filters, model, patchAnswer, settleAnswer],
  );

  const send = useCallback(
    (question: string, attachments?: AskAttachments) => {
      const query = question.trim();
      if (query.length === 0) return;

      abortRef.current?.abort();
      lastQuestionRef.current = query;
      // Carried on the turn, so «Generer på nytt» asks the same question of
      // the same documents rather than of none.
      lastAttachmentsRef.current = attachments;

      const now = new Date().toISOString();
      const questionId = nextId('user');
      const answerId = nextId('assistant');
      setAppliedFilters((current) => ({ ...current, [answerId]: filters }));
      if (attachments?.names.length) {
        setAttachmentsByMessage((current) => ({ ...current, [questionId]: attachments.names }));
      }
      setMessages((current) => [
        ...current,
        {
          id: questionId,
          role: 'user',
          content: query,
          createdAt: now,
          citations: [],
          status: 'complete',
        },
        {
          id: answerId,
          role: 'assistant',
          content: '',
          createdAt: now,
          citations: [],
          status: 'streaming',
        },
      ]);

      void run(query, answerId, attachments?.ids);
    },
    [filters, run],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const retry = useCallback(() => {
    // The ref is empty for a conversation restored from the store. The
    // question is in the thread either way, or «Generer på nytt» on a
    // restored turn does nothing.
    const question = lastQuestionRef.current ?? lastQuestionIn(messagesRef.current);
    if (!question) return;

    const answerId = nextId('assistant');
    setAppliedFilters((current) => ({ ...current, [answerId]: filters }));
    setMessages((current) => [
      ...withoutTurnBeingRetried(current),
      {
        id: answerId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        citations: [],
        status: 'streaming',
      },
    ]);
    void run(question, answerId, lastAttachmentsRef.current?.ids);
  }, [filters, run]);

  return {
    messages,
    status,
    error,
    announcement,
    appliedFilters,
    attachmentsByMessage,
    noHitsAnswers,
    send,
    cancel,
    retry,
  };
}
