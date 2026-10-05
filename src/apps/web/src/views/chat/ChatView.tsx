import { Heading } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { corpusDisplayNameFor, corpusOption, createChatClient, type ChatClient } from '../../api';
import { ErrorState, PageTitle } from '../../components';
import { useAnswerSources } from '../../layout/useAnswerSources';
import { useCitation } from '../../layout/useCitation';
import { useCorpus } from '../../layout/useCorpus';
import { useFilterSelection } from '../../layout/useFilterSelection';
import { useMainScroll } from '../../layout/useMainScroll';
import { useThread } from '../../layout/useThread';
import { emptyFilterSelection, type ThreadDetail } from '../../model';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ScrollToBottom } from './ScrollToBottom';
import { chatErrorText } from './errorText';
import { answerScopeText } from './filterSummary';
import {
  CLARIFICATION_PLACEHOLDER,
  NEW_THREAD_TITLE,
  READING_THREAD,
  kickstartersFor,
} from './text';
import { threadHeading, threadPageTitle } from './threadHeading';
import { useComposerShortcut } from './useComposerShortcut';
import { useFollowAnswer } from './useFollowAnswer';
import { useAttachments } from './useAttachments';
import { useChat } from './useChat';
import { ThreadLoading } from './ThreadLoading';
import { Welcome } from './Welcome';
import { SettingsDialog } from './SettingsDialog';
import { useFooterMode } from '../../layout/footerMode';
import { SETTINGS_HASH, useDisplayLevel } from './displayLevel';
import './chat.css';

export type ChatViewProps = {
  /** The signed-in user's first name, for the greeting before the first question. */
  userName?: string;
  /** The thread to show. Absent means a new conversation. */
  thread?: ThreadDetail;
  /**
   * The address names a conversation that has not been read yet.
   *
   * Absent `thread` means two different things and this is what tells them
   * apart: an untouched front page, and a thread on its way. The view cannot
   * work it out — it takes a `ThreadDetail` and never a route — so whoever
   * knows the address says so. See `slotViews/ChatSlotView.tsx`.
   */
  loading?: boolean;
  /** Which backend to talk to. Defaults to whatever `createChatClient` picks. */
  client?: ChatClient;
};

/**
 * What the shell has been told about one answer, as one comparable string.
 *
 * The status and how many documents; nothing else changes what the sources
 * panel draws, and everything else changes on every token.
 *
 * An answer whose sources have not arrived counts as zero and not as a state
 * of its own, because zero is what the shell stores for it — `AnswerSources`
 * carries an array and never `undefined`. Saying «venter» on this side of the
 * comparison and reading `[]` on the other made the two never agree, so the
 * view reported on every render, which re-rendered the shell, which ran the
 * view again. The suite hung rather than failed.
 */
function sourcesSignature(documents: number, status: string, corpusKey?: string): string {
  return `${status}:${documents}:${corpusKey ?? ''}`;
}

let fallbackClient: ChatClient | undefined;
function defaultClient(): ChatClient {
  fallbackClient ??= createChatClient();
  return fallbackClient;
}

function ChatSession({ userName, thread, loading, client }: ChatViewProps) {
  const chatClient = useMemo(() => client ?? defaultClient(), [client]);

  // The document filter is part of the question. The filter view writes it,
  // the shell holds it, and this view sends it — the two views never meet.
  const { selection } = useFilterSelection();

  /*
   * Which corpus is being searched, for the three suggestions on the empty
   * state. They were three Kudos questions over every corpus, including 351
   * Wikipedia articles that can answer none of them (brukerblikk 5, funn 2).
   *
   * Read here rather than in `Kickstarters`, so the suggestions stay a value
   * handed down and the leaf stays a leaf. `useCorpus` navigates when the
   * corpus is SET, so it needs a router — which this view has under the shell,
   * and which the leaf would otherwise have to be given in every preview and
   * unit test that draws a greeting.
   *
   * It switches on its own: `useCorpus` reads the store through
   * `useSyncExternalStore`, so choosing another corpus re-renders this view
   * with the new key and the list changes in the same paint.
   */
  const { active: corpusKey } = useCorpus();

  const {
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
  } = useChat(chatClient, thread?.messages ?? [], selection, corpusKey);

  // What the alert says, per case. Undefined while the turn is fine, which is
  // what keeps the region mounted and empty.
  const errorText = error ? chatErrorText(error) : undefined;

  /**
   * «Avgrenset til …» over one answer: which corpus, and what was narrowed.
   *
   * The corpus is named only when the answer came from a different one than
   * the chooser stands on now — which is what happens when a thread is opened
   * from the list while the reader is standing somewhere else. Naming it
   * always would put a word that never varies over every answer in a
   * deployment with one corpus.
   *
   * From the ANSWER's key, never from the choice: a name read from the
   * chooser is the bug this was written to fix.
   */
  const filterSummary = useCallback(
    (messageId: string) => {
      // An answer read back from a locked thread was asked with the lock
      // (ThreadDetail.filter); one asked here carries what it was asked with.
      const applied = appliedFilters[messageId] ?? thread?.filter ?? emptyFilterSelection;
      const answer = messages.find((message) => message.id === messageId);
      /*
       * Named only when the answer came from a corpus this deployment knows
       * AND it is not the one the chooser stands on.
       *
       * `corpusOption` is the first half and it is not ceremony:
       * `corpusDisplayNameFor` answers «standardkorpuset» for a key it does
       * not know, which is a sentence about a default rather than about this
       * answer — and a live backend that picked the dataset itself sends a
       * key nobody here has a name for (KA CC bør 1 på #138, same check as
       * #139). No name, no line.
       */
      const from = answer?.corpusKey;
      const elsewhere =
        from !== undefined && from !== corpusKey && corpusOption(from) !== undefined
          ? corpusDisplayNameFor(from)
          : undefined;
      return answerScopeText(applied, elsewhere);
    },
    [appliedFilters, corpusKey, messages, thread?.filter],
  );

  /*
   * «Henter samtalen», through the polite region at the bottom of this view.
   *
   * That region is mounted, empty, from the first render, so putting words in
   * it is a CHANGE — which is the thing a screen reader announces. The
   * loading state used to carry an `output` of its own, and that element
   * arrived with its text already in it: nothing changed, so there was
   * nothing to announce (KA CC on #156).
   *
   * Set from an effect rather than during render, for the same reason: the
   * first commit puts the empty region in the page, and the text lands in the
   * next one.
   *
   * Only while the skeleton is what is on screen. Ask something in the gap
   * and the turn has its own things to say — «Henter svar.», then the answer
   * — and they are about what the reader just did.
   */
  const readingThread = loading === true && messages.length === 0;
  const [noticeSaid, setNoticeSaid] = useState(false);
  useEffect(() => {
    // Nothing to undo when it stops: `loadingNotice` below reads
    // `readingThread` too, so the words leave with the same render that
    // replaces the skeleton.
    if (!readingThread) return;
    /*
     * A beat after the region is in the page, and not in the same commit.
     * Deriving this during render would put the words in the region as it was
     * inserted, which is what a screen reader has nothing to announce about —
     * it is the change it reports, not the content it finds. The timer is the
     * change.
     */
    const timer = setTimeout(() => setNoticeSaid(true));
    return () => clearTimeout(timer);
  }, [readingThread]);
  /*
   * Read back through `readingThread` as well, so the words LEAVE in the same
   * render that replaces the skeleton with the conversation. Only their
   * arrival has to wait for an effect; a region still saying «Henter
   * samtalen» under a conversation that has landed says something that is no
   * longer true.
   */
  const loadingNotice = readingThread && noticeSaid ? READING_THREAD : '';

  const [draft, setDraft] = useState('');
  /*
   * The documents the question being written is asked with. Held here beside
   * the draft, because the two are one unsent question: they are sent
   * together and emptied together.
   */
  const attachments = useAttachments();
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // «Prøv igjen», so focus can be put on it when the error takes the control
  // the reader was holding.
  const retryRef = useRef<HTMLButtonElement>(null);
  // The send button, which is the stop button mid-answer. The one control
  // that changes meaning under the reader when a turn fails.
  const sendRef = useRef<HTMLButtonElement>(null);

  // The main slot owns the scroll, and the shell hands it over. A view must
  // not go looking for it: the day chat is moved to another slot, a search up
  // the DOM finds the wrong element or nothing.
  const { ref: scrollRef, scrollToBottom } = useMainScroll();

  /*
   * The compose field is sticky and opaque, so anything the browser scrolls
   * to can land underneath it — a citation link or an action button reached
   * by Tab ends up behind the field, which is WCAG 2.4.11. Everything in the
   * conversation gets a `scroll-margin` of the field's height, so the browser
   * stops that much short of the bottom; see `--ka-composer-block-size` in
   * chat.css.
   *
   * A margin on the conversation and not `scroll-padding` on the scroller,
   * which is what this was. The padding applied to the field too, and the
   * field is inside the band the padding keeps clear: every keystroke asked
   * the browser to bring the caret out from behind the field, and the column
   * moved 49 px per key towards the bottom (Simens runde 3, ekstra 1). The
   * margin is on what the field can hide, and not on the field.
   *
   * Measured rather than written down: the field grows with the question
   * (`field-sizing: content`) and the follow-up chips come and go, so the
   * height is not a number this view knows.
   */
  useEffect(() => {
    const area = composerRef.current;
    const root = rootRef.current;
    // jsdom has no ResizeObserver; the margin is a scroll affordance, so a
    // test environment without one loses nothing.
    if (!area || !root || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      root.style.setProperty('--ka-composer-block-size', `${Math.round(area.offsetHeight)}px`);
    });
    observer.observe(area);

    return () => observer.disconnect();
  }, []);

  // An answer on its way is followed down, if the reader is at the bottom,
  // and «Bla til nederst» is drawn from the same measurement.
  const atBottom = useFollowAnswer(
    scrollRef,
    rootRef,
    status === 'pending' || status === 'streaming',
  );

  // Activating a `[n]` marker is the shell's business: it opens the sources
  // panel and tells it which excerpt to show. Neither view knows the other.
  const { showCitation } = useCitation();

  // The shell gives the conversation an address the first time a question is
  // asked here, so «Kopier lenke til tråden» has something to copy (C16).
  // Once per question and a no-op after the first; the thread it returns is
  // the shell's business, not this view's.
  const { startThread } = useThread();

  // The sources go the same way, and for the same reason: the sources view
  // draws them, this view produces them, and the two may not import each
  // other.
  //
  // One entry per answer, under the answer's own message id. A thread has
  // several answers and each numbers its excerpts from 1, so a single flat
  // list made `[2]` in the first answer open the second answer's excerpt two
  // — it looked right and was not (#4, brukerreiser punkt 5). The status
  // travels with it, because an empty `documents` means four different
  // things and only the answer knows which.
  const {
    answers: reported,
    setAnswerSources,
    clearAnswerSources,
    setDocuments,
  } = useAnswerSources();

  /*
   * What the shell is holding, against what this thread has to report.
   *
   * Compared against the shell's own state and not against a memo of what was
   * sent, which is the fix for brukerblikk runde 2, funn 1: a reloaded
   * conversation came back with its answer, its markers and its sources in
   * `sessionStorage`, and both side panels still said «Kildene vises her når
   * du har stilt et spørsmål». A `useRef` of what had already been sent
   * cannot know that something emptied the shell afterwards — and several
   * things may, since leaving a thread, a route with no conversation and this
   * view's own unmount all clear it. Whatever the order was on the day, the
   * view had said its piece once and would not say it again.
   *
   * Reading the shell instead makes that impossible to get wrong: whatever
   * empties it, the next render sees the gap and fills it. Reporting changes
   * `answers`, which runs this again, and the second pass finds nothing to do
   * — so it settles rather than loops.
   *
   * `messages` changes on every token, and almost none of those changes say
   * anything about sources. The signature is the two things that do — the
   * answer's status, and whether its documents have arrived — so the shell is
   * told once per real change instead of once per word.
   */
  useEffect(() => {
    const answers = messages.filter((message) => message.role === 'assistant');
    const live = new Set(answers.map((message) => message.id));

    /*
     * An answer that never produced a token is taken out of the thread again
     * (see `settleAnswer` in useChat), and the context can only be emptied
     * whole. So a disappearance costs a rebuild rather than a removal. It
     * happens when a reader stops a turn before the first word, and the
     * alternative is a sources panel waiting forever for an answer that is no
     * longer on screen.
     */
    if ((reported ?? []).some((answer) => !live.has(answer.messageId))) {
      clearAnswerSources();
      return;
    }

    /*
     * A thread with no answers at all, which `answers` cannot say on its own:
     * `clearAnswerSources()` sets it to undefined, and undefined means
     * «nobody has reported yet», which is what draws «Henter kilder …». An
     * untouched front page is not loading anything. So the empty state still
     * goes through the flat slot, and hands over the moment there is a real
     * answer to report.
     */
    if (answers.length === 0) {
      setDocuments([]);
      return;
    }

    for (const message of answers) {
      const held = (reported ?? []).find((answer) => answer.messageId === message.id);
      const signature = sourcesSignature(
        message.sources?.length ?? 0,
        message.status,
        message.corpusKey,
      );
      if (
        held &&
        sourcesSignature(held.documents.length, held.status, held.corpusKey) === signature
      ) {
        continue;
      }

      setAnswerSources({
        messageId: message.id,
        documents: message.sources ?? [],
        status: message.status,
        /*
         * How many `[n]` the answer's own text carries, which is not the same
         * as how many excerpts came with it. A conversation restored from the
         * live backend has the markers and no chunks behind them, and without
         * this the panel says «Svaret viser ikke til noen utdrag» beside an
         * answer showing four. Only a stored turn sets it; a streamed one
         * resolves its markers as they arrive and leaves this undefined.
         */
        ...(message.citationCount === undefined ? {} : { citationCount: message.citationCount }),
        /*
         * Which corpus answered. The panel names the corpus the ANSWER came
         * from and not the one the chooser stands on: open a Kudos thread
         * while the chooser says Wikipedia and the disclaimer said «fra
         * Kudos» over a Wikipedia source, or the other way round (KA CC on
         * #129). It arrives with the frame that ends the stream, so it is
         * undefined while the answer is still writing — and that is why it
         * is part of the signature below, or the panel would never hear
         * about it.
         */
        ...(message.corpusKey === undefined ? {} : { corpusKey: message.corpusKey }),
      });
    }
  }, [messages, reported, setAnswerSources, clearAnswerSources, setDocuments]);

  /*
   * Leaving the thread takes its sources with it. This view is keyed on the
   * thread, so unmount is exactly that moment — and an empty dependency list
   * is what makes «unmount» mean unmount.
   *
   * Through a ref, because the alternative is a trap. With
   * `[clearAnswerSources]` the effect re-runs whenever that function changes
   * identity, and re-running an effect means running its cleanup first: the
   * sources would be wiped on an ordinary re-render rather than on the way
   * out. The shell memoises the callback today, so nothing has gone wrong
   * yet; measured here 2026-09-15 against a provider that does not, and it
   * was an endless clear-and-report between the two effects.
   */
  const clearOnUnmount = useRef(clearAnswerSources);
  useEffect(() => {
    clearOnUnmount.current = clearAnswerSources;
  }, [clearAnswerSources]);
  useEffect(() => () => clearOnUnmount.current(), []);

  const hasAnswer = messages.some(
    (message) => message.role === 'assistant' && message.status === 'complete',
  );

  /**
   * The turn on screen searched and found nothing.
   *
   * The fixed suggestions do not apply under one: «Kan du utdype?» asks the
   * assistant to say more about nothing, and «Identifiser utfordringer» is a
   * question about documents that were never found. The advice the answer
   * already carries — loosen the filter, ask in other words — is the way on
   * from here, and three buttons that lead back to the same nothing are in
   * its way (the conductor, 2026-09-15).
   *
   * Read off the last message and not off the thread: an earlier answer that
   * did find something is still worth following up, right up until this one
   * replaced it as the turn the suggestions would act on.
   */
  const lastMessage = messages.at(-1);
  const foundNothing = lastMessage !== undefined && noHitsAnswers.has(lastMessage.id);

  /**
   * The same head on both routes (brukerblikk 2026-09-15, finding 5). A
   * thread opened from the list brings its title; a conversation started on
   * `/` has none until the client names it, and then the question stands in.
   * See threadHeading.ts for why a stand-in is heard and not seen.
   */
  const heading = threadHeading(thread, messages);
  const pageName = threadPageTitle(thread, messages);

  /**
   * The agent asked back and is waiting: the last turn ended as
   * `needs-clarification` and nothing has been sent since.
   *
   * The reader's next message is the answer to that question — an ordinary
   * next turn in the same thread, sent the ordinary way. What changes is the
   * field: it says what it wants, and the fixed follow-up suggestions step
   * aside, because «Kan du utdype?» is not an answer to anything the agent
   * asked.
   */
  const awaitingClarification =
    messages.at(-1)?.role === 'assistant' && messages.at(-1)?.status === 'needs-clarification';

  /*
   * Focus follows the question, once per clarification.
   *
   * The reader has just been asked something, and the one place to answer it
   * is the field. Focus is only taken from the composer itself or from
   * nobody: the click or the Enter that sent the question left it there, and
   * a reader who has moved on — into the answer above, into the sources —
   * must not have the page pulled back under them.
   */
  const clarificationId = awaitingClarification ? messages.at(-1)?.id : undefined;
  useEffect(() => {
    if (!clarificationId) return;

    const active = document.activeElement;
    const inComposer = active instanceof Node && composerRef.current?.contains(active);
    if (active === document.body || active === null || inComposer) fieldRef.current?.focus();
  }, [clarificationId]);

  function submit(question: string) {
    const query = question.trim();
    if (query.length === 0) return;

    /*
     * Only the ready ones go. A file that was refused is not part of the
     * question — sending its id would ask the backend about a document that
     * does not exist — and one still uploading is not ready to be asked
     * about, which is why the send button waits for it (see `Composer`).
     */
    const ids = attachments.readyIds;
    const names = attachments.items
      .filter((item) => item.documentId !== undefined)
      .map((item) => item.name);

    startThread(query);
    send(query, ids.length > 0 ? { ids, names } : undefined);
    setDraft('');
    attachments.clear();
  }

  /**
   * Where focus goes when a control disappears because of the click that hit
   * it. Both the stop button and «Prøv igjen» are gone by the time their own
   * handler has run, and a control that vanishes without saying where focus
   * should land drops a keyboard user on `<body>`, at the top of the
   * document, mid-action (WCAG 2.4.3). The compose field is where the reader
   * is going anyway: to rewrite the question after stopping, or to keep
   * typing while the retry runs.
   */
  function focusField() {
    fieldRef.current?.focus();
  }

  // `/` from anywhere on the page, the way GitHub and Slack do it. See
  // useComposerShortcut.ts for what it refuses to do.
  useComposerShortcut(fieldRef);

  /*
   * The hidden settings menu. `#innstillinger` in the address opens it, and
   * nothing else does — without the hash nobody can see that it is there,
   * which is what Lars asked for on 30.09.
   *
   * The hash and not a query: it never reaches the server, it never changes
   * which route is showing, and it does not travel in a link somebody pastes
   * into a ticket. See SettingsDialog.tsx.
   */
  const { hash } = useLocation();
  const navigate = useNavigate();
  const settingsOpen = hash === SETTINGS_HASH;
  const displayLevel = useDisplayLevel();
  // Simens issue 123, read here only to hand the dialog the choice on screen.
  const footerMode = useFooterMode();

  /*
   * The same rescue, for the error that arrives on its own.
   *
   * The send button becomes the stop button while an answer is on its way,
   * and when the turn fails it becomes the send button again — disabled,
   * because the field is empty. A reader who clicked it is still standing on
   * it at this moment and lands on `<body>` one frame later, when the browser
   * takes focus off a control that has just been switched off. Traced in the
   * built app, 2026-09-15: «Avbryt genereringen» at 210 ms, «Send spørsmålet»
   * with the alert already up at 5091 ms, `<body>` at 5107 ms.
   *
   * So «is focus lost» cannot be asked of `document.activeElement` alone —
   * asked here it is still the button, and one frame later it is too late.
   * That one button counts as lost too, and it is compared by identity: the
   * reasoning is about the control that changed meaning under the reader, so
   * «a button in the composer» was too wide a net. It caught the paperclip,
   * which changes nothing when a turn fails and has every right to keep the
   * focus a reader put on it (KA CC on #59).
   *
   * Where focus goes is «Prøv igjen», which is the one thing to do next, and
   * the compose field when the error offers no retry — a rejected key does
   * not, and the reader's way on is to write to someone (#4, funn B).
   *
   * The compose field itself is left alone. Enter leaves the caret there, and
   * a reader who is typing must not have it taken away.
   */
  useEffect(() => {
    if (status !== 'error') return;

    const active = document.activeElement;
    const onSendButton = active !== null && active === sendRef.current;
    if (active !== document.body && active !== null && !onSendButton) return;

    (retryRef.current ?? fieldRef.current)?.focus();
  }, [status]);

  return (
    <div className="ka-chat" ref={rootRef}>
      {/*
        The tab's title, from the same heading the column draws: the thread's
        title, or the first sentence of the first question until it has one
        (WCAG 2.4.2; see `threadPageTitle`). «Ny tråd» before anything is asked. While a thread is
        being read, the app's name alone, rather than calling it new.

        Here and not in the route, which has the address and not the title.
      */}
      <PageTitle name={pageName ?? (loading ? undefined : NEW_THREAD_TITLE)} />
      {heading ? (
        <Heading
          className={heading.repeatsQuestion ? 'ds-sr-only' : undefined}
          data-size="lg"
          level={2}
        >
          {heading.title}
        </Heading>
      ) : null}

      {/*
        Three states, in the order a reader meets them: what they asked for,
        what is on its way, and — only when the address names nothing — the
        greeting.

        The conversation wins over the loading shape, and that is the point of
        the order rather than an accident of it: a question asked while the
        thread is being read is already on screen (#149), and drawing
        skeletons over it would take the reader's own words away while they
        waited for older ones.
      */}
      {messages.length > 0 ? (
        <MessageList
          filterSummary={filterSummary}
          attachmentsFor={(messageId) => attachmentsByMessage[messageId]}
          foundNothing={(messageId) => noHitsAnswers.has(messageId)}
          /* Which turn the alert below is speaking for. A failed turn keeps
             its thinking panel, so it outlives the alert — and then its card
             has to say why there is no answer under the question. */
          liveErrorId={status === 'error' ? messages.at(-1)?.id : undefined}
          messages={messages}
          onRegenerate={() => {
            retry();
            focusField();
          }}
          onSelectSource={showCitation}
        />
      ) : loading ? (
        <ThreadLoading />
      ) : (
        <Welcome
          kickstarters={kickstartersFor(corpusKey)}
          onPickKickstarter={(question) => {
            // Fills the field, does not send (answer 40). The caret goes with
            // it, so the reader can edit before asking.
            setDraft(question);
            focusField();
          }}
          userName={userName}
        />
      )}

      {/*
        Mounted whether or not there is an error: an alert region only
        announces content that appears inside a region already in the page.
        See src/components/ErrorState.tsx.

        Heading, text and whether there is a button at all come from the code
        (errorText.ts). A rejected key gets no «Prøv igjen»: the same question
        with the same key fails the same way, and a button that cannot work
        sends the reader round the loop instead of towards whoever can fix it.
      */}
      <ErrorState
        message={errorText?.message}
        retryRef={retryRef}
        onRetry={
          errorText?.retryable
            ? () => {
                retry();
                focusField();
              }
            : undefined
        }
        title={errorText?.title}
      />

      <Composer
        above={
          messages.length > 0 && !atBottom ? (
            <ScrollToBottom
              onScroll={(byKeyboard) => {
                scrollToBottom();
                // The button goes when the column reaches the bottom, and a
                // keyboard would land on <body> (WCAG 2.4.3). The field is
                // where the reader is going next. Not for a tap: focus in the
                // field opens the keyboard on a phone.
                if (byKeyboard) fieldRef.current?.focus({ preventScroll: true });
              }}
            />
          ) : null
        }
        attachments={attachments}
        fieldRef={fieldRef}
        sendRef={sendRef}
        onCancel={() => {
          cancel();
          focusField();
        }}
        onChange={setDraft}
        onFollowUp={submit}
        onSubmit={() => submit(draft)}
        placeholder={awaitingClarification ? CLARIFICATION_PLACEHOLDER : undefined}
        ref={composerRef}
        showFollowUps={hasAnswer && !awaitingClarification && !foundNothing}
        status={status}
        value={draft}
      />

      {/*
        How the answer is coming along, for a screen reader. Polite, never
        assertive: an answer being written is not an interruption. It carries
        whole paragraphs rather than tokens, because a region updated per
        token stutters, and the finished answer is in the page anyway.
      */}
      <p aria-live="polite" className="ds-sr-only">
        {announcement || loadingNotice}
      </p>

      {/*
        The hidden settings menu, opened by `#innstillinger` in the address
        (Lars, 30.09). It lives here rather than in the shell because the one
        setting it holds is this view's, and a menu with one setting belongs
        next to it until there is a second. See SettingsDialog.tsx.

        Mounted only while the address asks for it, unlike the delete dialog
        in the threads view: that one is permanent so it can animate and take
        focus the moment a thread is picked, and this one is supposed to leave
        no trace in the page for anyone who has not asked for it.

        `replace`, so closing it does not leave a step in the history that
        Back walks straight into again.
      */}
      {settingsOpen ? (
        <SettingsDialog
          footerMode={footerMode}
          level={displayLevel}
          onClose={() => navigate({ hash: '' }, { replace: true })}
        />
      ) : null}
    </div>
  );
}

/**
 * The chat: the greeting, the conversation and the compose field.
 *
 * Mounted in the `main` slot by the shell. It is a view, so it is named after
 * its content and could sit in another slot the day the layout lets a reader
 * move it. It expects the route around it to carry the page's level 1
 * heading, as Figma draws it: «Kunnskapsassistenten» on top, the thread title
 * under it.
 *
 * **It does not key itself.** It used to: `key={props.thread?.id ?? 'new'}`,
 * so that moving between threads started from that thread's messages instead
 * of carrying the previous conversation across. The trouble is that `thread`
 * is undefined until the client has answered, so on `/threads/:id` the key
 * went `'new'` → the id a moment after mount, and the session remounted with
 * everything the compose field was holding. Type while the thread is loading
 * and the text was gone. In CI, which is slower, the remount landed in the
 * middle of a test's keystrokes and `chat.spec` went red on main.
 *
 * The remount it was for already happens above: `ChatSlotView` renders
 * `<ChatSlot key={threadId}>` off the route, so a real thread change replaces
 * this whole subtree, and the preview passes a key of its own. Keying here as
 * well only added the one transition the route never makes — from «no thread»
 * to «this thread» — which is not a change of conversation at all. It is the
 * same conversation arriving.
 *
 * Which is also why the route is not read here instead: a view takes a
 * `ThreadDetail` and never a route (see slotViews/ChatSlotView.tsx), and the
 * caller that knows the address is already doing the job.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession {...props} />;
}
