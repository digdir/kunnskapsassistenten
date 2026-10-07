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
// Rett fra modulen og ikke via src/api/index.ts, som er #5 sin barrel.
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
 * Mounts the chat view in whichever slot holds it.
 *
 * Three things the view should not have to know are settled here.
 *
 * The thread comes from the URL. `/threads/:threadId` names one, `/` names
 * none, and the view takes a `ThreadDetail` and never a route. It is fetched
 * through `createChatClient()`, so it follows `VITE_API_MODE` like everything
 * else: mock mode has the fixtures, live mode has no readable thread history
 * and says so by returning null. Reaching into `src/api/mock/` directly would
 * put fixtures in a production bundle.
 *
 * A conversation started on `/` gets an address here, through
 * `ThreadContext`. See `ChatSlot` below.
 *
 * An id the client does not know draws «Fant ikke tråden» instead of a
 * conversation. Before that it drew a fresh, working front page under an
 * address naming a thread, so a shared link that had gone stale looked like
 * it had worked — reise 14 in design/brukerreiser-2026-09-15.md. That state
 * has no compose field, and the shell is told, because the shell draws a skip
 * link straight to one. See composerContext.ts.
 *
 * The sources behind the answer are lifted to the shell, so the sources view
 * can draw them without the two views knowing about each other. See
 * answerSourcesContext.ts.
 */
export function ChatSlotView() {
  const { threadId } = useParams();
  const newThreads = useSyncExternalStore(subscribeToNewThread, newThreadCount);

  // Keyed on the address, so moving between threads starts from nothing
  // rather than showing the previous thread until the next one has loaded.
  // It is also what lets the state below start at null without an effect
  // writing it back on every navigation.
  //
  // `/` is keyed on «Ny tråd» instead, because «/» is not one place. A
  // conversation started there gets its address from `replaceState`, which
  // the router never sees (see `startThread`), so to the router the page is
  // still `/` — and «Ny tråd», a link to `/`, changed neither the route nor
  // the key. Nothing remounted, and the old conversation, its sources and its
  // filter stayed on screen under an address that said `/` (issue
  // 114; measured in mock, bff and live).
  //
  // It was `location.key` for a while, which every navigation mints a new one
  // of — including one to the same path, which made «Ny tråd» work. But it
  // counts navigations nobody asked a new conversation of: closing the hidden
  // settings menu is `navigate({ hash: '' }, { replace: true })`, and a
  // half-written question on `/` was wiped by opening and shutting a dialog
  // (KA CC on #208). The count says what the key is actually about — the
  // reader asked for a new conversation — and nothing else changes it.
  //
  // And a `threadId` the ROUTER has only just noticed is not a navigation
  // either. `replaceState` writes the address without telling the router, so
  // `useParams` keeps saying «no thread» — until the next real navigation, on
  // which the router re-reads `window.location` and sees `/threads/<id>` for
  // the first time. Opening `#innstillinger` is such a navigation. The key
  // then went from `new:N` to the id, the slot remounted, and the thread was
  // read back from the backend: «Fremgangsmåte» gone, the Kudos links from 6
  // to 0, the excerpts gone (measured in Azure on dfbb869 in live mode, and
  // in mock here — there the re-read puts everything back, so only a
  // half-written question is lost). It is the same conversation, and
  // `startedHere` is how this side says so.
  //
  // The slot is told «no thread» as well as keyed as one, and it has to be
  // both. Keeping the key alone left the instance standing but handed it a
  // `threadId` for the first time, and the effect on `[client, threadId]`
  // read the thread back IN ON TOP of the conversation already on screen:
  // question, answer card and «Fremgangsmåte» each drawn twice (KA CC on
  // #218, measured in mock; it needs a FINISHED turn, because that is when
  // the mock writes the conversation down). This page started the
  // conversation, so «no thread in the address» is the truth it has been
  // working from all along — the address is a link for later, and this says
  // so twice instead of once.
  const discovered = threadId !== undefined && startedHere(threadId);
  return (
    <ChatSlot
      key={discovered || threadId === undefined ? `new:${newThreads}` : threadId}
      threadId={discovered ? undefined : threadId}
    />
  );
}

/**
 * The thread ids this page has minted for the conversation on screen.
 *
 * A module Set and not state, because the one that has to read it is the
 * component ABOVE the one that fills it: `startThread` runs inside `ChatSlot`,
 * and `ChatSlotView` is where the key is decided. Two, not one, because
 * adoption renames the conversation while the answer streams — the stand-in id
 * and the one the backend gave it are both addresses this page wrote, and the
 * router can notice either.
 *
 * Read during render rather than through `useSyncExternalStore`, and that is
 * safe for a narrow reason: the only render that consults it is one where
 * `threadId` has just appeared, which is a router change, which has already
 * re-rendered this component. Nothing else asks.
 *
 * Emptied when `ChatSlot` unmounts, which is what keeps it from outliving the
 * conversation it belongs to. A slot that has gone is a conversation that is
 * no longer on screen, so its address is an ordinary thread again: going back
 * to it later reads it from the backend, the way any thread does.
 */
const addressesWrittenHere = new Set<string>();

function startedHere(threadId: string): boolean {
  return addressesWrittenHere.has(threadId);
}

function ChatSlot({ threadId }: { threadId?: string }) {
  const client = useMemo(() => createChatClient(), []);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  /**
   * The client answered, and the answer was «no such thread».
   *
   * Separate from `thread === null`, which is also what «not read yet» looks
   * like. Only the client saying no counts, and only saying no in so many
   * words: a read that THREW says nothing about whether the thread exists.
   */
  const [missing, setMissing] = useState(false);
  /**
   * The read threw: a 502, a network that is down. The thread may well be
   * there, so this is not `missing`, and the reader is offered the read
   * again. Without it the main column showed «Henter samtalen» until the
   * reader asked something.
   */
  const [unreadable, setUnreadable] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  /**
   * A question was asked before the read came back (see `startThread`). Its
   * turn is on screen, and a read that fails then must not take it away.
   */
  const askedWhileReading = useRef(false);
  const { setDocuments } = useAnswerSources();

  /**
   * The conversation the user started here, on a page that had no address.
   *
   * Separate state from `thread` because they are answers to different
   * questions: `thread` is what the backend had, `started` is what this tab
   * made. Only one of them can be set — this component is keyed on the route,
   * so a route with an id never starts anything.
   */
  const [started, setStarted] = useState<Thread | undefined>(undefined);
  const startedRef = useRef<Thread | undefined>(undefined);

  /*
   * Switching corpus lets go of the thread this page started.
   *
   * A thread belongs to the corpus it was started in, and the selector says
   * so by navigating to `/`. That navigation is a no-op here, and the reason
   * is three paragraphs down: the address was written with
   * `history.replaceState`, which the ROUTER never sees, so React Router
   * still believes the location is `/` and navigating there changes nothing.
   * Nothing remounts, this ref keeps the old thread, and the next question is
   * filed under it — one thread with answers from two corpora, which is what
   * the thread list then draws one corpus for (KA CC on #131).
   *
   * So the thread is released here instead, where the change is actually
   * observable. `useChat` empties the conversation on the same change; this
   * is the other half, and without it the empty screen would still mint its
   * next question into the old thread.
   *
   * The navigation is no longer a no-op since `/` is keyed on it (see
   * `ChatSlotView`), so a switch from the selector remounts this anyway. This
   * stays for a corpus that changes without one: in bff mode the BFF names
   * its dataset in every `/capabilities` answer, and it is asked again for as
   * long as its probe has not settled — minutes, with a question already
   * asked (`adoptServerCorpus`).
   *
   * The state goes while rendering, the ref in the effect beside it: a ref
   * written during render is a change React cannot see. Nothing reads this
   * one before then — `startThread` runs from a question, which is a click or
   * a keystroke, long after effects.
   */
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
  /*
    What the first question is asked with, for the thread it starts: a client
    that keeps a filter on a thread stores it when it makes the conversation
    (live, issue 90). The context and not `useFilterSelection()`, for
    the reason useThreadFilterLock gives: the page is mounted on its own in
    tests.
  */
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

  /**
   * Where «Prøv igjen» leaves focus when it took the button with it: the
   * compose field, which is back with the conversation as the read starts
   * again, and where the chat view's own «Prøv igjen» sends it. Looked up
   * when it is needed, since the field is the chat view's.
   */
  const composerField = useMemo(
    () => ({
      get current() {
        return document.getElementById(COMPOSER_ID);
      },
    }),
    [],
  );

  /*
   * A new name given in the thread list, on this copy of the thread too.
   *
   * The list owns its own rows and renames them itself. This copy is the one
   * the main column draws its heading from, and nothing told it — so renaming
   * the open thread left the old name over the answer until the next load
   * (measured 2026-09-29 in mock). Both states are updated: `thread` is what
   * the backend had, `started` is what this tab began, and either can be the
   * one on screen.
   *
   * The store publishes the new name before the backend is asked and the old
   * one back if it says no, exactly as the list does, so the heading and the
   * row cannot disagree.
   */
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
          /*
           * Flagget kommer fra butikken det også. Ved et tilbakefall er det
           * det tråden hadde, og en tittel satt tilbake som om leseren hadde
           * valgt den, ville stått synlig over spørsmålet den er laget av.
           */
          return { ...current, title: name.title, titleFromQuestion: name.titleFromQuestion };
        };
        setThread((current) => withName(current) ?? null);
        /*
         * `started` holdes i takt, men ingen test kan være rød for denne
         * linja i dag, og det er verdt å si rett ut framfor å skrive en test
         * som er grønn uansett (KA CC målte 0 røde på mutasjonen, #185).
         *
         * Grunnen er at ingen leser navnet: `ChatView` får `thread` og ikke
         * `thread ?? started`, og det eneste `ThreadContext` brukes til er
         * `startThread`. `useReportOpenThread` bruker bare id-en, og
         * adopsjonen bytter hele tråden ut. Linja står fordi butikken lover
         * at de to kopiene er i takt, og fordi `ThreadContext.thread` er
         * åpen for den som senere leser den.
         */
        setStarted((current) => withName(current) ?? undefined);
      }),
    [],
  );

  // The sources on screen belong to the answer on screen. Leaving a thread
  // has to clear them, or the sources panel keeps citing the previous answer.
  useEffect(() => () => setDocuments(undefined), [setDocuments]);

  /*
   * The addresses this page wrote go with the conversation that wrote them.
   * See `addressesWrittenHere`: while this slot stands, its own address is
   * «the conversation on screen» and must not remount it; once it is gone,
   * that address is an ordinary thread to be read from the backend.
   */
  useEffect(() => () => addressesWrittenHere.clear(), []);

  /*
   * The keyboard in the compose field, when «Ny tråd» asked for it (issue
   * 114). See useNewThread.ts.
   *
   * On mount, because this is the new conversation the link navigated to,
   * and the field is the old one's until it has mounted. By now the drawer
   * the link stood in has closed: that was a separate update on the click,
   * committed before the navigation, and closing it handed the focus back to
   * the rail button — which is the focus this takes over.
   */
  useEffect(() => {
    if (takeComposerFocusRequest()) document.getElementById(COMPOSER_ID)?.focus();
  }, []);

  /**
   * «Fant ikke tråden» has no compose field, so «Hopp til skrivefeltet» must
   * not be drawn over it. The shell cannot see this: the route is an ordinary
   * `/threads/:threadId` and draws an ordinary main slot, and only the answer
   * from the client says which of the two things goes in it. Tab Tab + Enter
   * on an unknown thread left the focus on a link to an element that was not
   * in the document (KA CC, 2026-09-15).
   *
   * `!missing` and not «the view is mounted»: the chat view always brings a
   * composer when it draws a conversation, and «not there» and «could not be
   * read» are the two branches where it is not drawn. While the client is
   * still answering, both are false and a composer really is on screen — the
   * welcome screen is drawn until the answer comes — so the link is right at
   * every moment, not only at the end.
   */
  useComposerPresence(!missing && !unreadable);

  // A thread that is not there, or could not be read, has no answers either,
  // and the panel has to say so rather than draw skeletons. It happens to be right without this
  // today — the chat view mounts for a moment before the client answers, and
  // reports an empty list on its way past — but that is a race in another
  // view, not a decision this page has made. See useNoAnswers.ts.
  useNoAnswers(missing || unreadable);

  /**
   * Give the conversation an address, once.
   *
   * Without this the first question on `/` produces a thread in the list and
   * an answer on screen while the URL still says `/`, so «Kopier lenke til
   * tråden» copies the front page. C16 in design/funksjonssjekk-v1.md.
   *
   * `history.replaceState` and NOT the router, and that is the whole reason
   * this is three lines rather than one `navigate()`. The router would
   * re-render, `useParams` would change, `ChatSlotView`'s key would go from
   * `new` to the id, and this component would remount — taking the answer
   * that is streaming into it with it. The address is a link for later, not a
   * navigation: nothing on screen should move.
   *
   * What that costs: React Router's own idea of the location stays `/` until
   * the next real navigation. Every link in this app is absolute, so nothing
   * resolves against it, and a reload lands on `/threads/:id` and reads the
   * thread properly. A relative `navigate('..')` would be wrong, and there
   * is none.
   *
   * The ref is what makes it once-only. State would be read from a closure
   * that is one render stale, and the second question of a conversation would
   * mint a second thread.
   *
   * A thread that is still being read is NOT no thread. See below.
   */
  /**
   * Move a thread from the stand-in id to the one its backend gave it.
   *
   * Everything that names the thread has to move together — the address, what
   * the client files answers under, and what the thread list marks as open —
   * or the reader ends up with two of something they only made one of.
   *
   * Three things make it safe to do while an answer streams. The address is
   * written with `replaceState`, which the router does not see, so nothing
   * remounts. `ChatView` does not key itself on the thread either. And the
   * guard below is what keeps a slow creation from writing over a reader who
   * has moved on in the meantime: if the thread this started for is no longer
   * the one on screen, the new name is simply not used.
   *
   * A client that cannot mint a thread — or fails to — leaves the stand-in
   * standing, which is what the app did before this existed.
   */
  const adoptRealThread = useCallback(
    async (placeholder: Thread): Promise<void> => {
      const real = await client.createThread?.(placeholder).catch(() => undefined);

      if (!real || real.id === placeholder.id) {
        // Nothing better to call it. File it under the stand-in, as before.
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

  const startThread = useCallback(
    (question: string): Thread => {
      const existing = startedRef.current ?? thread ?? undefined;
      if (existing) return existing;

      /*
       * The address already names a conversation; it just has not arrived
       * yet. The question belongs to that one.
       *
       * This is the rest of the hole KA CC found in #66. The compose field
       * works while `getThread` is in flight — deliberately, and `useChat`
       * lays the stored conversation in front of the turn when it lands — but
       * nothing here could tell «no thread» from «a thread that is still on
       * its way», and the two look identical: `thread` is null in both. So a
       * question asked in that gap minted a thread of its own, wrote the
       * address over to it, and left an empty conversation in the list beside
       * the one the reader was standing in. «Kopier lenke til tråden» copies
       * `window.location.href`, so it copied the wrong one. Measured on
       * `/threads/nkom-maaloppnaaelse`.
       *
       * Nothing is minted and nothing is navigated, because there is nothing
       * to do: the address is already right.
       *
       * The client IS told, here and not only when the read lands, and that
       * is the second half of the same hole (KA CC on #149). The read is what
       * used to say where the answer goes — and it says it too late when it
       * comes back after the turn is over. Then nothing had filed the answer
       * anywhere, and the question the reader asked in the gap was gone at
       * the next reload. Measured with a read that takes longer than the
       * answer: the turn finished at 3 s, the read landed at 4 s, and nothing
       * was written down.
       *
       * Saying it twice costs nothing: opening a thread that is already open
       * is what the effect above does on every mount.
       *
       * The id is the part of this that is true, and `id-only` is how the
       * client is told so. The title is a stand-in until the read lands with
       * the real one — and the client is the one that has to know the
       * difference, or it writes the stand-in down as the conversation's name
       * (KA CC on #153). See `ChatClient.openThread`.
       */
      if (threadId) {
        askedWhileReading.current = true;
        const asked: Thread = { ...threadFromQuestion(question), id: threadId };
        client.openThread?.(asked, 'id-only');
        return asked;
      }

      /*
        Stamped with the corpus the question is about to be asked of, so a
        thread minted here says the same thing as one read back from the
        backend (which carries it as a `corpus:` tag). A thread belongs to one
        corpus for good: switching starts a new one rather than moving this.
        And with the filter it is asked with, which the client stores with
        the conversation and which then locks the thread.
      */
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

      /*
       * The id above is a stand-in, and the address it just wrote is a
       * promise this browser cannot keep on its own.
       *
       * A thread is a conversation in the backend, and the backend names its
       * own: `POST /api/conversations` answered with `rskfhAR3otaiib3NJiKfQ`
       * while the reader was looking at `/threads/<uuid we invented>`.
       * Reopening that address returned «Conversation not found», stably, for
       * everyone including the reader who had just written it — and «Kopier
       * lenke til tråden» copied precisely it (brukerblikk 8).
       *
       * So the client is asked what the thread is really called, and the
       * address moves there when the answer comes, a fraction of a second
       * later. Nothing on screen moves with it: `replaceState` is invisible
       * to the router, which is why the streaming answer survives an id
       * changing underneath it (see the note above this callback).
       *
       * Not awaited, because this function cannot be: `useChat` needs a
       * thread now, and the answer is already on its way.
       */
      void adoptRealThread(created);
      return created;
    },
    [adoptRealThread, askedFilter, client, thread, threadId],
  );

  const value = useMemo(
    () => ({ thread: thread ?? started, startThread }),
    [thread, started, startThread],
  );

  /**
   * Tell the shell which conversation is on screen, so the thread list can
   * mark its row.
   *
   * `thread ?? started` and not the route's id, and that is the whole point:
   * a conversation the reader started here has an address written with
   * `history.replaceState` (see `startThread`), which `NavLink` never sees.
   * The row for the thread they had just made stayed unmarked until the next
   * reload — measured by KA CC, and for a screen reader an open thread
   * without `aria-current` is a thread that is not open.
   *
   * `missing` is the one case where the address names a thread and none is on
   * screen. Marking a row for a thread that is not there would point the
   * reader at the conversation they failed to open.
   */
  useReportOpenThread(missing ? undefined : (thread ?? started)?.id);

  return (
    <ThreadContext value={value}>
      {/*
        Mounted while the address names a thread and none is on screen, so
        it is in the page before the read can fail: an alert region only
        announces what appears inside a region already there. See
        src/components/ErrorState.tsx. Not beside a conversation, which has
        an alert region of its own in the chat view.
      */}
      {threadId !== undefined && thread === null && !missing && (
        <ErrorState
          message={unreadable ? 'Klarte ikke å hente tråden.' : undefined}
          onRetry={unreadable ? readAgain : undefined}
          focusAfterRetry={composerField}
        />
      )}
      {missing ? (
        /*
          The page title here and not in the chat view, which is not drawn:
          this branch is the one place that knows the address names nothing.
        */
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
        /*
          `loading` is the one thing about the address the view cannot see.
          An absent thread means «front page» to it, and it drew the greeting
          and three suggestions over a conversation the reader had already
          chosen, while the filter panel beside it said it was loading
          (brukerblikk 8, funn 2).

          Read off what is actually true here: the route names a thread, the
          client has not come back with it, and it has not said the thread is
          gone either — `missing` has its own screen above.
        */
        <ChatView
          loading={threadId !== undefined && thread === null}
          thread={thread ?? undefined}
        />
      )}
    </ThreadContext>
  );
}
