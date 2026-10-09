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
import { useAgents } from './useAgents';
import { AgentPicker } from './AgentPicker';
import { ThreadLoading } from './ThreadLoading';
import { Welcome } from './Welcome';
import { SettingsDialog } from './SettingsDialog';
import { useFooterMode } from '../../layout/footerMode';
import { SETTINGS_HASH, useDisplayLevel } from './displayLevel';
import { FEATURE_FLAGS_HASH, FeatureFlagsDialog, useFlagLink } from '../../flags';
import './chat.css';

export type ChatViewProps = {
  /** The signed-in user's first name, for the greeting before the first question. */
  userName?: string;
  /** The thread to show. Absent means a new conversation. */
  thread?: ThreadDetail;
  /** The address names a conversation that has not been read yet. Absent
      `thread` otherwise means both an untouched front page and one on its
      way, and the view never sees the route. */
  loading?: boolean;
  /** Which backend to talk to. Defaults to whatever `createChatClient` picks. */
  client?: ChatClient;
};

// Status and document count only: everything else changes on every token.
// Sources that have not arrived count as zero, because zero is what the shell
// stores — any other value never agrees with it, and the two loop.
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

  // For the suggestions on the empty state: one naming documents the corpus
  // does not hold invites a question it cannot answer. Read here, or
  // `Kickstarters` needs a router in every preview that draws a greeting.
  const { active: corpusKey } = useCorpus();

  // Which agent the question goes to, chosen in the compose field.
  const agentChoice = useAgents(chatClient);

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
  } = useChat(chatClient, thread?.messages ?? [], selection, corpusKey, agentChoice.model);

  // What the alert says, per case. Undefined while the turn is fine, which is
  // what keeps the region mounted and empty.
  const errorText = error ? chatErrorText(error) : undefined;

  // «Avgrenset til …» over one answer. The corpus is named only when the
  // answer came from another one than the chooser stands on now, and always
  // from the ANSWER's key: the chooser's belongs to a different answer.
  const filterSummary = useCallback(
    (messageId: string) => {
      // An answer read back from a locked thread was asked with the lock
      // (ThreadDetail.filter); one asked here carries what it was asked with.
      const applied = appliedFilters[messageId] ?? thread?.filter ?? emptyFilterSelection;
      const answer = messages.find((message) => message.id === messageId);
      // `corpusOption` is not ceremony: `corpusDisplayNameFor` answers
      // «standardkorpuset» for a key it does not know, which says something
      // about a default rather than about this answer. No name, no line.
      const from = answer?.corpusKey;
      const elsewhere =
        from !== undefined && from !== corpusKey && corpusOption(from) !== undefined
          ? corpusDisplayNameFor(from)
          : undefined;
      return answerScopeText(applied, elsewhere);
    },
    [appliedFilters, corpusKey, messages, thread?.filter],
  );

  // Through the polite region this view already keeps in the page: one that
  // arrives WITH its text was inserted, not changed, and announces nothing.
  // Only while the skeleton is on screen; a question in the gap says its own.
  const readingThread = loading === true && messages.length === 0;
  const [noticeSaid, setNoticeSaid] = useState(false);
  useEffect(() => {
    // Nothing to undo when it stops: `loadingNotice` below reads
    // `readingThread` too.
    if (!readingThread) return;
    // The timer is what makes the words a change rather than content the
    // region was inserted with.
    const timer = setTimeout(() => setNoticeSaid(true));
    return () => clearTimeout(timer);
  }, [readingThread]);
  // Read through `readingThread` as well, so the words LEAVE in the render
  // that replaces the skeleton. Only their arrival waits for an effect.
  const loadingNotice = readingThread && noticeSaid ? READING_THREAD : '';

  const [draft, setDraft] = useState('');
  // The documents the question being written is asked with. Beside the
  // draft, because the two are one unsent question.
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

  // The shell hands the scroller over; a view must not go looking for it, or
  // moving chat to another slot finds the wrong element.
  const { ref: scrollRef, scrollToBottom } = useMainScroll();

  // The sticky field must not hide what the browser scrolls to (WCAG
  // 2.4.11). NOT `scroll-padding` on the scroller: that covers the field too,
  // and every keystroke then walks the column towards the bottom.
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

  // The shell gives the conversation an address on the first question, so
  // «Kopier lenke til tråden» has something to copy (C16). A no-op after it.
  const { startThread } = useThread();

  // One entry per answer: each numbers its excerpts from 1, so a flat list
  // makes `[2]` in the first answer open the second answer's excerpt two. The
  // status travels with it, since an empty `documents` means four things.
  const {
    answers: reported,
    setAnswerSources,
    clearAnswerSources,
    setDocuments,
  } = useAnswerSources();

  // Compared against the shell's own state and NOT a memo of what was sent:
  // several things empty the shell, and a memo cannot know, so the view would
  // say its piece once and never again.
  useEffect(() => {
    const answers = messages.filter((message) => message.role === 'assistant');
    const live = new Set(answers.map((message) => message.id));

    // An answer that never produced a token leaves the thread (`settleAnswer`
    // in useChat), and the context can only be emptied whole — so a
    // disappearance costs a rebuild rather than a removal.
    if ((reported ?? []).some((answer) => !live.has(answer.messageId))) {
      clearAnswerSources();
      return;
    }

    // Undefined means «nobody has reported yet», which draws «Henter kilder
    // …», and an untouched front page is not loading anything. So an empty
    // thread reports `[]` rather than leaving the slot undefined.
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
        // How many `[n]` the text carries, which is not how many excerpts
        // came with it: a restored conversation has the markers and no chunks
        // behind them. Only a stored turn sets it.
        ...(message.citationCount === undefined ? {} : { citationCount: message.citationCount }),
        // Read back from a store that kept no sources for it: the panel says
        // they were not stored rather than that there were none.
        ...(message.sourcesNotStored ? { sourcesNotStored: true } : {}),
        // The corpus the ANSWER came from, never the one the chooser stands
        // on. It arrives with the frame ending the stream, so it is part of
        // the signature or the panel never hears about it.
        ...(message.corpusKey === undefined ? {} : { corpusKey: message.corpusKey }),
      });
    }
  }, [messages, reported, setAnswerSources, clearAnswerSources, setDocuments]);

  // Leaving the thread takes its sources with it, and an empty dependency
  // list is what makes «unmount» mean unmount. Through a ref: as a
  // dependency, a re-render would run the cleanup on the way in.
  const clearOnUnmount = useRef(clearAnswerSources);
  useEffect(() => {
    clearOnUnmount.current = clearAnswerSources;
  }, [clearAnswerSources]);
  useEffect(() => () => clearOnUnmount.current(), []);

  const hasAnswer = messages.some(
    (message) => message.role === 'assistant' && message.status === 'complete',
  );

  // The turn on screen found nothing, so the fixed suggestions do not apply:
  // «Kan du utdype?» asks the assistant to say more about nothing. The LAST
  // message, since an earlier answer was worth following up until replaced.
  const lastMessage = messages.at(-1);
  const foundNothing = lastMessage !== undefined && noHitsAnswers.has(lastMessage.id);

  // The same head on both routes; see threadHeading.ts for why a stand-in
  // title is heard and not seen.
  const heading = threadHeading(thread, messages);
  const pageName = threadPageTitle(thread, messages);

  // The agent asked back and is waiting. The next message is the answer,
  // sent the ordinary way; the field's placeholder changes and the follow-up
  // suggestions step aside.
  const awaitingClarification =
    messages.at(-1)?.role === 'assistant' && messages.at(-1)?.status === 'needs-clarification';

  // Focus follows the question, once per clarification. Only taken from the
  // composer or from nobody: a reader who has moved into the answer or the
  // sources must not have the page pulled back under them.
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

    // Only the ready ones go: a refused file's id would ask the backend
    // about a document that does not exist.
    const ids = attachments.readyIds;
    const names = attachments.items
      .filter((item) => item.documentId !== undefined)
      .map((item) => item.name);

    startThread(query);
    send(query, ids.length > 0 ? { ids, names } : undefined);
    setDraft('');
    attachments.clear();
  }

  // Where focus goes when a control disappears under the click that hit it.
  // Without this a keyboard user lands on `<body>`, at the top of the
  // document, mid-action (WCAG 2.4.3).
  function focusField() {
    fieldRef.current?.focus();
  }

  // `/` from anywhere on the page, the way GitHub and Slack do it. See
  // useComposerShortcut.ts for what it refuses to do.
  useComposerShortcut(fieldRef);

  // The hidden settings menu. A hash and not a query: it never reaches the
  // server, never changes the route, and does not travel in a pasted link.
  const { hash } = useLocation();
  const navigate = useNavigate();
  const settingsOpen = hash === SETTINGS_HASH;
  // The flags menu opens the same way, from `#feature-flags`, and a link with
  // `?flagg=` turns a flag on and lands there. See src/flags/flagLink.ts.
  const flagsOpen = hash === FEATURE_FLAGS_HASH;
  useFlagLink();
  const displayLevel = useDisplayLevel();
  // Read here only to hand the dialog the choice on screen.
  const footerMode = useFooterMode();

  // The browser takes focus off the failed turn's send button one frame
  // LATER, so standing on that one button counts as lost — by identity, since
  // «a button in the composer» also catches the paperclip. The field stands.
  useEffect(() => {
    if (status !== 'error') return;

    const active = document.activeElement;
    const onSendButton = active !== null && active === sendRef.current;
    if (active !== document.body && active !== null && !onSendButton) return;

    (retryRef.current ?? fieldRef.current)?.focus();
  }, [status]);

  return (
    <div className="ka-chat" ref={rootRef}>
      {/* The tab's title, from the heading the column draws (WCAG 2.4.2).
          Here and not in the route, which has the address and not the
          title. */}
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

      {/* The conversation wins over the loading shape on purpose: a question
          asked while the thread is being read is already on screen, and
          skeletons over it would take the reader's own words away. */}
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
            // Fills the field, does not send. The caret goes with it, so the
            // reader can edit before asking.
            setDraft(question);
            focusField();
          }}
          userName={userName}
        />
      )}

      {/* Mounted whether or not there is an error: an alert region only
          announces content that appears inside one already in the page.
          Whether there is a button at all comes from errorText.ts. */}
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
                // keyboard would land on <body> (WCAG 2.4.3). Not for a tap:
                // focus in the field opens the keyboard on a phone.
                if (byKeyboard) fieldRef.current?.focus({ preventScroll: true });
              }}
            />
          ) : null
        }
        agentPicker={
          <AgentPicker
            agents={agentChoice.agents}
            current={agentChoice.current}
            onChoose={agentChoice.choose}
          />
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

      {/* How the answer is coming along, for a screen reader. Polite, since
          an answer being written is not an interruption, and by whole
          paragraphs, since a region updated per token stutters. */}
      <p aria-live="polite" className="ds-sr-only">
        {announcement || loadingNotice}
      </p>

      {/* Mounted only while the address asks for it, so a page nobody asked
          it of holds no trace. `replace`, so closing leaves no history step
          that Back walks straight into again. */}
      {settingsOpen ? (
        <SettingsDialog
          footerMode={footerMode}
          level={displayLevel}
          onClose={() => navigate({ hash: '' }, { replace: true })}
        />
      ) : null}
      {flagsOpen ? (
        <FeatureFlagsDialog onClose={() => navigate({ hash: '' }, { replace: true })} />
      ) : null}
    </div>
  );
}

/**
 * The chat, mounted in the `main` slot by the shell. **It must not key
 * itself**: `thread` is undefined until the client answers, so a key on it
 * remounts the session and throws away the draft. `ChatSlotView` keys it.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession {...props} />;
}
