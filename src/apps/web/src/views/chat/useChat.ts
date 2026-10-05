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
} from './text';

/**
 * The documents one question is asked with: what to send, and what to show.
 *
 * Both, because the two are read by different things and neither can be got
 * from the other later. The ids go on the wire; the names go on the reader's
 * own message in the thread, and a name looked up from the document list
 * afterwards would go missing the day the reader removes the file.
 */
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

/**
 * The conversation without the turn «Generer på nytt» is about to replace.
 *
 * Only the last one, and only when it is an answer that did not make it. It
 * used to be every failed or stopped answer in the thread, which was the same
 * thing back when a thread could hold at most one: a stopped turn was not
 * stored, so the only one that could exist was the live one. Now that a
 * stopped turn survives a reload, an older one can be sitting further up —
 * and running the newest question again is no reason to delete a turn the
 * reader stopped last week.
 */
function withoutTurnBeingRetried(messages: Message[]): Message[] {
  const last = messages.at(-1);
  const replacing =
    last?.role === 'assistant' && (last.status === 'error' || last.status === 'aborted');
  return replacing ? messages.slice(0, -1) : messages;
}

export type UseChat = {
  messages: Message[];
  status: ChatStatus;
  /**
   * Why the turn failed, set only when status is 'error'.
   *
   * The code and not the sentence: which case it was decides the heading, the
   * text and whether «Prøv igjen» is offered at all, and that mapping belongs
   * to the view (errorText.ts). A hook that handed over a finished string
   * would have to know what the button under it says.
   */
  error: ChatError | null;
  /**
   * What the polite live region should say at this moment (answer 33).
   *
   * It lives here rather than in the view because only this loop knows when a
   * paragraph finished and when the turn ended. A live region driven by
   * rendering instead of by events either stutters once per token or has to
   * read a ref during render to remember what it already said.
   */
  announcement: string;
  /**
   * The filter each answer was asked under, by message id.
   *
   * Kept beside the messages rather than on them: the answer says which
   * documents it was narrowed to, and «which documents» is what the reader
   * chose at the time, not what is selected now. A second question under a
   * different filter must not rewrite the first answer's line.
   */
  appliedFilters: Record<string, FilterSelection>;
  /**
   * The answers whose search came back empty, by message id.
   *
   * Kept beside the messages rather than derived from their text: a turn that
   * found nothing is a fact about the turn, and reading it back out of the
   * words would break the moment the wording changed. The view needs it
   * because the fixed follow-up suggestions do not apply under one — «Kan du
   * utdype?» asks the assistant to say more about nothing.
   */
  noHitsAnswers: ReadonlySet<string>;
  /**
   * The documents each question was asked with, by the QUESTION's message id.
   *
   * Beside the messages and not on them, the same call `appliedFilters`
   * makes: what a question carried is a fact about that turn at the moment it
   * was asked, and the reader's document list goes on changing afterwards. A
   * document removed tomorrow must not rewrite what yesterday's question said
   * it was asked with.
   *
   * Names and not ids, because the thread draws them and a reader reads
   * «Årsrapport 2025.pdf», not a uuid.
   */
  attachmentsByMessage: Record<string, string[]>;
  send: (question: string, attachments?: AskAttachments) => void;
  /** Stop the generation and keep what has arrived (answer 34). */
  cancel: () => void;
  /**
   * Ask the last question again, in place of the answer that did not make
   * it. «Prøv igjen» after a failure and «Generer på nytt» after a stop are
   * the same move: the question stands, the answer is replaced.
   */
  retry: () => void;
};

/**
 * The chat state machine: messages in, one streamed answer at a time.
 *
 * Streaming is built in rather than added later, because it changes how the
 * answer is rendered — which is why the build order says to do step 3 and
 * step 5 together (design/skal-dette-implementeres.md).
 *
 *   idle       nothing in flight
 *   pending    question sent, no token yet — this is what the skeleton shows
 *   streaming  tokens arriving
 *   error      the turn failed; `error` carries the code, and the view
 *              looks the Norwegian up from it
 *
 * Two of the codes never reach that last state. Cancelling is not an error:
 * the client reports it as an `error` event with
 * code `aborted`, and here that means: keep the partial answer, mark it
 * `aborted`, go back to idle. That is what a reader expects from a stop
 * button, and it is why the code checks the code rather than the event type.
 * The status is kept apart from `complete` because a stopped answer is not a
 * whole one — its sources never arrived, so it carries no action row of a
 * finished answer and offers to run again instead.
 *
 * `no-hits` is not one either: the search ran and found nothing, which is a
 * finished answer with an empty source list rather than a failure. It is the
 * same move in the other direction — an `error` frame settled as `complete`.
 *
 * Only one turn counts at a time. A question asked mid-stream aborts the one
 * before it, and the old turn is then forbidden from touching status,
 * announcement or error — see `turnRef` in `run`.
 */
export function useChat(
  client: ChatClient,
  initialMessages: Message[] = [],
  filters: FilterSelection = emptyFilterSelection,
  corpusKey?: string,
): UseChat {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  /*
   * The thread can arrive after the view has mounted, and usually does:
   * `ChatSlotView` draws the chat straight away and fills `thread` in when
   * the client answers, so on `/threads/:id` this hook starts with no
   * messages and the conversation lands a moment later.
   *
   * It used to land by remounting — the view keyed itself on the thread id,
   * so `undefined → id` replaced the whole session. That is how the restored
   * conversation got in, and it is also why anything the reader had typed
   * while it loaded was thrown away with it, and why CI went red on main
   * (the remount fell in the middle of a test's keystrokes; two different
   * assertions, one cause). So the messages are adopted instead.
   *
   * A reader who has already asked something at this address keeps what they
   * asked. The stored conversation is laid in FRONT of it rather than instead
   * of it: both are real, and the order is the one they happened in — the
   * saved turns are older than the question asked while they loaded.
   *
   * It used to be dropped outright (`if (messages.length === 0)`), which is
   * the hole KA CC found in #66: ask something on `/threads/:id` before
   * `getThread` answers, and the conversation that was already there never
   * arrived. Only the turn in flight was protected, and protecting it did not
   * require throwing the rest away.
   *
   * By id, so nothing lands twice. The live turn and the stored one can be
   * the same turn — the mock writes a finished answer into the store under
   * the id it just streamed (`recordMockTurn`), so a thread that resolves
   * after the answer settled carries it back. What is already on screen wins;
   * only ids the conversation has not seen are prepended.
   *
   * Adjusted while rendering the change rather than in an effect, which is
   * React's own answer to «a prop changed and state has to follow»: an effect
   * would draw the empty conversation once first.
   *
   * Compared on what the messages ARE and not on the identity of the array
   * that carries them. `initialMessages` has a default of `[]`, which is a
   * fresh array on every call, so a reference check said «a new thread» every
   * render and looped. Length plus the last id is enough: a thread that has
   * grown or been replaced differs, and the same thread handed over twice
   * does not.
   */
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

  /*
   * The conversation as it stands, for the handlers that need to read it
   * without being rebuilt by it. `retry` is the one: it changes identity with
   * its dependencies, and `messages` changes on every token, so depending on
   * it directly would hand the composer a new callback per word.
   *
   * Written in an effect rather than during render. `retry` runs from a click,
   * long after effects have settled, so it always reads the conversation that
   * was on screen when the reader pressed the button.
   */
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /*
   * Switching corpus lets go of the conversation.
   *
   * A thread belongs to the corpus it was started in — its answers cite
   * documents that only exist there — so continuing it against another one
   * would produce a conversation whose citations point into two different
   * document sets, with nothing on screen saying which is which. The thread
   * list would draw one corpus for a thread that has two (KA CC on #131).
   *
   * Everything goes: the messages, the backend conversation the next question
   * would have continued, and what each answer was asked under. The draft
   * does not, because it is not part of the conversation — it is a question
   * the reader is still writing, and it is as good a question of the new
   * corpus as of the old (see `ChatView`, which holds it).
   *
   * What the READER sees is emptied while rendering, the same way the thread
   * below is adopted: an effect would draw the old conversation once under
   * the new corpus first.
   *
   * What the reader does not see — the backend conversation, the question a
   * retry would repeat, the turn in flight — is let go in the effect under
   * it. Those are refs, and a ref read or written during render is a value
   * React cannot see changing. It costs nothing here: the only thing that
   * reads them is a question, and a question comes from a click or a
   * keystroke, long after effects have run.
   */
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

  /**
   * End a turn: mark the answer, or drop it if nothing ever arrived.
   *
   * An answer that failed or finished before its first token draws no card,
   * so leaving it in the list leaves an `<li>` whose whole content is the
   * hidden «Kunnskapsassistenten svarte:» — a screen reader hears an
   * assistant that answered nothing. The alert says what became of a failed
   * turn, and carries the way onward.
   *
   * A stopped one is the exception, and it is the whole of #4's funn A: the
   * reader pressed stop while «Tenker …» was still running, and the turn
   * vanished — no «Generer på nytt», and a sources panel back to «Kildene
   * vises her når du har stilt et spørsmål» for someone who had just asked
   * something. Stopping the same answer one second later, after the first
   * word, left both. So a stopped turn stays whatever phase it was in, and
   * the card says it was stopped and offers to run it again.
   */
  const settleAnswer = useCallback(
    (id: string, status: SettledStatus, settled?: { createdAt?: string; corpusKey?: string }) => {
      /*
       * The answer is stamped here and not when its placeholder was made,
       * because the time on an answer means «when the answer was finished»
       * — that is what a reader refers back to, and it is what the turn is
       * written down with.
       *
       * Stamping it at both ends is what made one answer carry two times:
       * the placeholder was made when the question was sent and the stored
       * copy when the turn was recorded, a whole answer apart. «14:32» on
       * screen, «14:32:15» after a reload (KA CC on #71). Nothing draws the
       * time until the turn settles, so moving it costs nothing on screen.
       *
       * The `done` frame's own time wins when there is one, so the message
       * and the stored turn are the same string and not merely the same
       * second. A stream that ends any other way — stopped, failed, or with
       * no `done` at all — has no time to be given, and the local clock is
       * that same instant give or take the trip home.
       */
      const settledAt = settled?.createdAt ?? new Date().toISOString();
      setMessages((current) => {
        const answer = current.find((message) => message.id === id);
        /*
         * A turn with nothing to show is taken out again. «Nothing» is the
         * point: an `<li>` whose whole content is the hidden «Kunnskapsassistenten
         * svarte:» tells a screen reader that the assistant answered, when it
         * did not.
         *
         * What the agent DID is something to show. A failed turn used to be
         * dropped on `content.length === 0` alone, and it took the thinking
         * panel with it: «Tenker …» and «Jeg søker i korpuset» were on screen
         * while the question ran, and the moment the error card arrived the
         * reader had the question, the error, and nothing about what was tried
         * — on the one path where that is worth most (brukerblikk 4, funn 3).
         * A successful answer keeps its panel; this is the only path that
         * cleared its own trace.
         *
         * A stopped turn stays whatever phase it was stopped in, panel or no
         * panel, because its card is what says it was stopped and offers to run
         * it again (#4, funn A).
         */
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
                /*
                 * Which corpus answered, from the frame that ended the
                 * stream. The client is the only thing that knows: it is what
                 * put `dataset_config_key` on the wire. Reading the store
                 * instead would answer «which corpus is selected now», and
                 * the reader may have moved since.
                 *
                 * Left alone when the frame says nothing. `undefined` means
                 * «not known» and never «the default corpus» — a live stack
                 * without a tenant lets the backend choose, and then nothing
                 * on this side can name what answered.
                 */
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
      // Every turn gets a number, and only the newest one may write status,
      // announcement or error. Asking a second question while the first is
      // still streaming aborts the first, but that abort is handled one tick
      // later — after the new turn has already said «Henter svar.». Without
      // this guard the old turn overwrites it with «Genereringen ble
      // avbrutt.», which is a status message that lies, and puts the status
      // back to idle, which takes the stop button away from a generation
      // that is still running.
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

      /*
       * Which of the two «fant ingenting» answers fits this turn. Read here,
       * from the filter the question was asked under, and not when it lands:
       * telling a reader to loosen a filter they never set sends them looking
       * for a control they have not touched.
       */
      const noHitsAnswer = isEmptySelection(filters) ? NO_HITS_WHOLE_CORPUS : NO_HITS_FILTERED;

      // Said once per turn, when the first step lands. The steps arrive
      // seconds apart and there can be a dozen of them; a polite region that
      // spoke once per step would still be reading them out when the answer
      // arrived. The panel itself is silent, see ThinkingPanel.
      let saidSearching = false;

      /*
       * When the thinking started, so how long it took can be written down
       * rather than worked out afterwards (brukerblikk runde 2, funn 5). The
       * stream is where the two ends of that interval actually are: the first
       * step arriving, and the first word of the answer.
       */
      let thinkingStartedAt: number | undefined;

      try {
        for await (const event of client.ask({
          query: question,
          conversationId: conversationRef.current,
          // The document filter is part of the question, not a view
          // decoration. The backend ignores it today (API-bestilling A2) and
          // it is sent regardless: that is the contract, and the day it is
          // honoured nothing here has to change.
          filters,
          // Which of the reader's own documents THIS question is about.
          // Separate from `filters`, which narrows the corpus and follows the
          // reader between questions.
          ...(attachments?.length ? { attachments } : {}),
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
                setAnnouncement(clarifying ? CLARIFICATION_ANNOUNCEMENT : 'Svaret er ferdig.');
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

              /*
               * A search that found nothing is not a failure: the assistant
               * did the work and came back empty-handed, which is an answer
               * with an empty source list (API-bestilling A16). So the turn
               * finishes rather than fails — no red alert, no «Prøv igjen»
               * offering to ask the same question of the same documents
               * again — and the empty `sources` is what makes the sources
               * panel say the same thing in its own words instead of waiting
               * for excerpts that are not coming.
               *
               * It arrives as an `error` event because that is the frame
               * that ends a stream with no content in it; see model/stream.ts.
               */
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
          setAnnouncement('Svaret er ferdig.');
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
    [client, filters, patchAnswer, settleAnswer],
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
    /*
     * The question to ask again. The ref holds it while the session that
     * asked it is still open, and a restored conversation has no ref to hold
     * anything: nothing was sent in this browser session, so it is null.
     *
     * That mattered the day a stopped turn started surviving a reload. The
     * card came back with «Generer på nytt» on it, as it should — and the
     * button did nothing at all, because this returned on the first line. The
     * question is in the thread either way, which is where it is read from
     * when the ref is empty.
     */
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
