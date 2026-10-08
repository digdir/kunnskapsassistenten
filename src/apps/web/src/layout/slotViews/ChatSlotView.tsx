import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useParams } from 'react-router';
import { activeCorpusKey, createChatClient, subscribeToCorpus } from '../../api';
import { renamedThreads, subscribeToThreadRenames } from '../../api/threadActions';
import { ErrorState, NotFoundState, PageTitle } from '../../components';
import { threadFromQuestion, type Thread, type ThreadDetail } from '../../model';
import { ChatView } from '../../views/chat';
import { FilterContext } from '../filterContext';
import { COMPOSER_ID } from '../ids';
import { ThreadContext } from '../threadContext';
import { useAnswerSources } from '../useAnswerSources';
import { useComposerPresence } from '../useComposerPresence';
import { newThreadCount, subscribeToNewThread, takeComposerFocusRequest } from '../useNewThread';
import { useNoAnswers } from '../useNoAnswers';
import { useReportOpenThread } from '../useOpenThread';
import { useThreadFilterLock } from '../useThreadFilterLock';

/**
 * Mounts the chat view and settles what it should not know: the thread from
 * the URL (through `createChatClient()`; importing `src/api/mock/` would ship
 * fixtures), an address for a conversation started on `/`, and «Fant ikke
 * tråden» for an unknown id, so a stale link does not look like it worked.
 */
export function ChatSlotView() {
  const { threadId } = useParams();
  // `/` is keyed on «Ny tråd»: its address comes from `replaceState`, which the
  // router never sees. Not `location.key`: closing a dialog navigates too.
  const newThreads = useSyncExternalStore(subscribeToNewThread, newThreadCount);

  // An address this page wrote itself is the conversation on screen; keying on
  // it would reread it and lose what only the stream carried.
  const discovered = threadId !== undefined && startedHere(threadId);
  return (
    <ChatSlot
      // A new address starts from nothing, not from the previous thread.
      key={discovered || threadId === undefined ? `new:${newThreads}` : threadId}
      // Withheld too, or the read would draw the conversation a second time.
      threadId={discovered ? undefined : threadId}
    />
  );
}

// Thread ids this page minted for the conversation on screen (stand-in and
// adopted). Module-level because `ChatSlotView` reads what `ChatSlot` writes;
// read in render, which is safe only because it follows a router change.
const addressesWrittenHere = new Set<string>();

function startedHere(threadId: string): boolean {
  return addressesWrittenHere.has(threadId);
}

function ChatSlot({ threadId }: { threadId?: string }) {
  const client = useMemo(() => createChatClient(), []);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  // «No such thread» from the client. Not `thread === null` (also «not read
  // yet»), and not a read that threw, which says nothing about existence.
  const [missing, setMissing] = useState(false);
  // The read threw (a 502, no network): offer it again rather than show
  // «Henter samtalen» until the reader asks something.
  const [unreadable, setUnreadable] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  // A question asked before the read came back; a failed read must not take
  // its turn away.
  const askedWhileReading = useRef(false);
  const { setDocuments } = useAnswerSources();

  // What this tab started, as opposed to `thread`, what the backend had. Only
  // one is ever set: a route with an id never starts anything.
  const [started, setStarted] = useState<Thread | undefined>(undefined);
  const startedRef = useRef<Thread | undefined>(undefined);

  // A new corpus lets go of the thread started in the old one; in bff mode it
  // can change without a navigation. State in render, the ref in an effect:
  // React cannot see a ref written during render.
  const corpusKey = useSyncExternalStore(subscribeToCorpus, activeCorpusKey);
  const [corpusInUse, setCorpusInUse] = useState(corpusKey);
  if (corpusKey !== corpusInUse) {
    setCorpusInUse(corpusKey);
    setStarted(undefined);
  }

  useEffect(() => {
    startedRef.current = undefined;
  }, [corpusKey]);

  // The filter lock of the thread on this page. See useThreadFilterLock.ts.
  const lockNewThread = useThreadFilterLock(client, thread, corpusKey);
  // Stored with a new thread by a client that keeps filters. The context, not
  // `useFilterSelection()`: tests mount the page on its own.
  const askedFilter = use(FilterContext)?.selection;

  useEffect(() => {
    if (!threadId) return;

    const abort = new AbortController();
    client
      .getThread(threadId, abort.signal)
      .then((found) => {
        if (abort.signal.aborted) return;
        setThread(found);
        setMissing(found === null);
        // Tell the client which conversation the questions that follow belong
        // to. Only a client that remembers anything implements it; see
        // ChatClient.openThread.
        if (found) client.openThread?.(found);
      })
      .catch(() => {
        if (abort.signal.aborted || askedWhileReading.current) return;
        setUnreadable(true);
      });

    return () => abort.abort();
  }, [client, threadId, readAttempt]);

  function readAgain() {
    setUnreadable(false);
    setReadAttempt((attempt) => attempt + 1);
  }

  // Where «Prøv igjen» sends focus once its button is gone: the compose field,
  // looked up when needed, since it belongs to the chat view.
  const composerField = useMemo(
    () => ({
      get current() {
        return document.getElementById(COMPOSER_ID);
      },
    }),
    [],
  );

  // A rename in the thread list, on this copy too, since the heading is drawn
  // from it. The store publishes before the backend answers and rolls back on
  // a no, as the list does, so heading and row agree.
  useEffect(
    () =>
      subscribeToThreadRenames(() => {
        const names = renamedThreads();
        const withName = <T extends Thread>(
          current: T | null | undefined,
        ): T | null | undefined => {
          const name = current ? names.get(current.id) : undefined;
          if (!current || !name) return current;
          if (
            name.title === current.title &&
            name.titleFromQuestion === current.titleFromQuestion
          ) {
            return current;
          }
          // The flag comes from the store too, or a rolled-back title would
          // look chosen by the reader.
          return { ...current, title: name.title, titleFromQuestion: name.titleFromQuestion };
        };
        setThread((current) => withName(current) ?? null);
        // Nothing reads `started`'s name today, so no test can fail on this
        // line; it stays because the store promises both copies are in step.
        setStarted((current) => withName(current) ?? undefined);
      }),
    [],
  );

  // Leaving a thread clears its sources, or the panel keeps citing them.
  useEffect(() => () => setDocuments(undefined), [setDocuments]);

  // Once this slot is gone, its addresses are ordinary threads to read again.
  useEffect(() => () => addressesWrittenHere.clear(), []);

  // On mount, when «Ny tråd» asked for the compose field: before that, the
  // field is the old conversation's.
  useEffect(() => {
    if (takeComposerFocusRequest()) document.getElementById(COMPOSER_ID)?.focus();
  }, []);

  // No compose field on «Fant ikke tråden», so no skip link to one. Only the
  // client's answer tells; while it is pending, the composer is on screen.
  useComposerPresence(!missing && !unreadable);

  // No answers either, so the panel says so rather than draw skeletons. It
  // works without this today only through a race in the chat view.
  useNoAnswers(missing || unreadable);

  // Move a thread from the stand-in id to its backend id: address, client and
  // thread list together. `replaceState` keeps the streaming answer mounted;
  // the guard drops a late answer if the reader has moved on.
  const adoptRealThread = useCallback(
    async (placeholder: Thread): Promise<void> => {
      const real = await client.createThread?.(placeholder).catch(() => undefined);

      if (!real || real.id === placeholder.id) {
        // Nothing better to call it, so file it under the stand-in.
        client.openThread?.(placeholder);
        return;
      }

      if (startedRef.current?.id !== placeholder.id) return;

      client.openThread?.(real);
      startedRef.current = real;
      setStarted(real);
      addressesWrittenHere.add(real.id);
      window.history.replaceState(
        window.history.state,
        '',
        `/threads/${encodeURIComponent(real.id)}`,
      );
      lockNewThread(real.id, () => startedRef.current?.id === real.id);
    },
    [client, lockNewThread],
  );

  // Warning: `replaceState`, NOT the router: a navigation would remount this and
  // drop the streaming answer. The router's location stays `/`, so every link
  // must be absolute. The ref makes it once-only; state would be a render stale.
  const startThread = useCallback(
    (question: string): Thread => {
      const existing = startedRef.current ?? thread ?? undefined;
      if (existing) return existing;

      // The address names a thread still being read: the question belongs to
      // it. Told now, or an answer that ends before the read lands is filed
      // nowhere; `id-only`, so the stand-in title is not stored as its name.
      if (threadId) {
        askedWhileReading.current = true;
        const asked: Thread = { ...threadFromQuestion(question), id: threadId };
        client.openThread?.(asked, 'id-only');
        return asked;
      }

      // Stamped with its corpus, as a thread read back carries it (a `corpus:`
      // tag), and with the filter, which then locks the thread.
      const created: Thread = {
        ...threadFromQuestion(question),
        corpusKey: activeCorpusKey(),
        ...(askedFilter ? { filter: askedFilter } : {}),
      };
      startedRef.current = created;
      setStarted(created);
      addressesWrittenHere.add(created.id);
      window.history.replaceState(
        window.history.state,
        '',
        `/threads/${encodeURIComponent(created.id)}`,
      );

      // A stand-in id: the backend names its own conversations and answers
      // «Conversation not found» for ours, so the address moves to its id.
      // Not awaited: `useChat` needs a thread now.
      void adoptRealThread(created);
      return created;
    },
    [adoptRealThread, askedFilter, client, thread, threadId],
  );

  const value = useMemo(
    () => ({ thread: thread ?? started, startThread }),
    [thread, started, startThread],
  );

  // For the thread list's `aria-current`. Not the route's id: `NavLink` never
  // sees a `replaceState` address. Nothing when `missing`.
  useReportOpenThread(missing ? undefined : (thread ?? started)?.id);

  return (
    <ThreadContext value={value}>
      {/* Mounted before the read can fail: an alert region only announces what
        appears inside a region that is already there. */}
      {threadId !== undefined && thread === null && !missing && (
        <ErrorState
          message={unreadable ? 'Klarte ikke å hente tråden.' : undefined}
          onRetry={unreadable ? readAgain : undefined}
          focusAfterRetry={composerField}
        />
      )}
      {missing ? (
        // The page title here, since the chat view is not drawn.
        <>
          <PageTitle name="Fant ikke tråden" />
          <NotFoundState
            title="Fant ikke tråden"
            description="Lenken peker på en tråd som ikke finnes. Den kan være slettet, eller høre til en annen bruker."
          />
        </>
      ) : unreadable ? (
        <PageTitle name="Klarte ikke å hente tråden" />
      ) : (
        // Without `loading`, an absent thread means «front page» to the view,
        // which would greet the reader over the conversation they chose.
        <ChatView
          loading={threadId !== undefined && thread === null}
          thread={thread ?? undefined}
        />
      )}
    </ThreadContext>
  );
}
