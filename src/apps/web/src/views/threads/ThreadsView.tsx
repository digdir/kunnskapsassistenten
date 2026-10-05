import { Button, Heading, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import type { Session } from '../../api/session';
import { createThreadActions, type ThreadActions } from '../../api/threadActions';
import { FilterIcon, NewThreadIcon } from '../../components/icons';
import { EmptyState, ErrorState } from '../../components';
import { useCorpus } from '../../layout/useCorpus';
import { useNewThread } from '../../layout/useNewThread';
import { useOpenThread } from '../../layout/useOpenThread';
import type { SlotViewProps } from '../../layout/viewModel';
import type { Thread } from '../../model';
import { DeleteThreadDialog } from './DeleteThreadDialog';
import { groupThreads } from './grouping';
import { RenameThread } from './RenameThread';
import { SignedIn } from './SignedIn';
import { ThreadLink } from './ThreadLink';
import { ThreadMenu } from './ThreadMenu';
import { useThreadList } from './useThreadList';
import './threads.css';

export type ThreadsViewProps = Pick<SlotViewProps, 'siblingViews' | 'onShowView'> &
  /* Optional: a view mounted outside the shell has not been switched to. */
  Partial<Pick<SlotViewProps, 'switchedByUser'>> & {
    /** Overrides the fetch. Only for tests. */
    threads?: Thread[];
    /** Overrides the deployment's rename and delete; null for none. Only for tests. */
    actions?: ThreadActions | null;
    /** Overrides who is signed in; null for nobody. Only for tests. */
    session?: Session | null;
  };

/** Where focus goes when the row it was on has gone: the way to a new thread. */
const NEW_THREAD = '\u0000new-thread';

/**
 * The thread list: a new thread, a search field, and earlier threads grouped
 * by period.
 *
 * The view fetches what it renders, so the shell mounts it without wiring.
 * Data comes from the ChatClient, which is the mock until the live client
 * exists. `useThreadList` reads it again when the conversation on screen
 * moves, so a thread the reader starts while the list is open appears in it
 * without a detour through another view.
 */
export function ThreadsView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  threads: given,
  actions: givenActions,
  session,
}: ThreadsViewProps) {
  // Which conversation is on screen, whoever put it there. See
  // src/layout/openThreadContext.ts.
  const openThreadId = useOpenThread();
  /*
   * Which corpus a thread was asked of, for the rows — and only when there is
   * more than one to tell apart. With a single corpus the label would be the
   * same word under every row in the list, which is noise rather than
   * information, and the panel pays for it in height.
   *
   * The WHOLE label, not the short name the corpus line above uses: the row
   * and the chooser name the same corpora, and a reader who picked «Kudos,
   * 938 dokumenter (mock)» should find those words again under the thread. It
   * costs a second line when the label is long — see `.threads-view__meta` in
   * threads.css, which wraps — and that cost belongs to whoever writes the
   * label in `VITE_KA_DATASETS`.
   */
  const { options, choosable } = useCorpus();
  const corpusLabel = (key?: string) =>
    choosable ? options.find((candidate) => candidate.key === key)?.label : undefined;
  const { threads, failed, retry, change } = useThreadList(given);
  const [query, setQuery] = useState('');
  const searchStatusId = useId();
  const filterRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  /** «Ny tråd» as the whole action: empty filter, drawer shut, focus in the field. */
  const startNewThread = useNewThread();

  /*
   * And the panel goes to the filters (Simens issue 75, round 2). A new
   * thread starts from the whole corpus, and the filter view is where the
   * reader narrows it before the first question; the thread list has nothing
   * new to show until that question is asked.
   *
   * The same plain click `useNewThread` acts on, and only that: a click that
   * opens a new tab leaves this page as it was, the panel included. Only
   * when the slot holds the filters as well, since `onShowView` switches
   * between the views of one slot.
   *
   * Focus stays with the compose field, which is what the click asked for.
   * The filter view takes focus on a switch only when it was dropped; see
   * FiltersView.
   */
  function newThread(event: MouseEvent<HTMLAnchorElement>) {
    startNewThread(event);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (siblingViews.includes('filters')) onShowView('filters');
  }

  /*
   * Rename and delete, when this deployment has them (bff and mock, not
   * live). Without them the rows have no menu at all, rather than two
   * buttons that fail on every press.
   */
  const actions = useMemo(
    () => (givenActions === undefined ? createThreadActions() : (givenActions ?? undefined)),
    [givenActions],
  );
  /** The row being renamed, by thread id. */
  const [renaming, setRenaming] = useState<string | undefined>(undefined);
  /** The thread the delete dialog is asking about. */
  const [deleting, setDeleting] = useState<Thread | undefined>(undefined);
  /** What went wrong with the last rename or delete, for the alert region. */
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  /** What a screen reader is told a rename or a delete did. */
  const [announcement, setAnnouncement] = useState('');
  const menuRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const newThreadRef = useRef<HTMLAnchorElement>(null);
  /*
   * Where focus goes once the list has been drawn again, by thread id, or
   * NEW_THREAD. In an effect, because the button to focus is not there — or
   * not yet gone — until React has drawn the change.
   */
  const focusAfter = useRef<string | undefined>(undefined);

  useEffect(() => {
    const target = focusAfter.current;
    if (target === undefined) return;
    focusAfter.current = undefined;
    const button = target === NEW_THREAD ? undefined : menuRefs.current.get(target);
    (button ?? newThreadRef.current)?.focus();
  }, [threads, renaming, deleting]);

  /*
   * Focus after a switch from the filter view, which unmounted the button the
   * user pressed and dropped focus on the body. The shell says whether a user
   * asked for this view or the page merely opened on it, so this never fires
   * ahead of the skip link. See SlotViewProps.
   */
  // The flag is settled before this view mounts and does not flip while it is
  // mounted: the button that switches away from a view is the only one that
  // sets it, and it is in the OTHER view. So this runs on mount and no later.
  useEffect(() => {
    if (switchedByUser) filterRef.current?.focus();
  }, [switchedByUser]);

  const loading = !failed && !threads;
  /*
   * Known to be empty, as opposed to not known yet. Only then does «Ny tråd»
   * become «Start din første tråd»; while the list loads, or when it could
   * not be fetched, it stays «Ny tråd», since a new thread works whether or
   * not the list does.
   */
  const empty = threads?.length === 0;
  /*
   * The search goes with the field. A list that empties while a query stands
   * — the last thread deleted mid-search — hides the field, and the query
   * would otherwise come back invisibly with the next thread and filter it
   * away. Adjusted during render, as React has it for state that follows a
   * change in what was handed in.
   */
  if (empty && query !== '') setQuery('');
  const trimmed = query.trim().toLocaleLowerCase('nb-NO');
  const matches = useMemo(
    () =>
      (threads ?? []).filter((thread) => thread.title.toLocaleLowerCase('nb-NO').includes(trimmed)),
    [threads, trimmed],
  );
  const groups = useMemo(() => groupThreads(matches), [matches]);

  /*
   * A new name, on screen at once and taken back if the backend says no.
   *
   * Only the one thread's title goes back on a failure, not the list as it
   * was: a delete or a refresh may have landed in between, and the reader
   * did not ask for those to be undone.
   */
  function rename(thread: Thread, title: string) {
    if (!actions) return;
    setRenaming(undefined);
    setActionError(undefined);
    focusAfter.current = thread.id;
    change((list) =>
      list.map((row) => (row.id === thread.id ? { ...row, title, titleFromQuestion: false } : row)),
    );
    setAnnouncement(`Tråden heter nå «${title}».`);
    actions.rename(thread, title).catch(() => {
      /*
       * Back to the old title only if the row still shows the one this call
       * sent, the rule the rename store keeps for the heading
       * (threadActions.ts). Renamed again in the meantime, the row is the
       * later rename's, and there is nothing to put back or to tell the
       * reader.
       */
      let putBack = false;
      change((list) =>
        list.map((row) => {
          if (row.id !== thread.id || row.title !== title) return row;
          putBack = true;
          return { ...row, title: thread.title, titleFromQuestion: thread.titleFromQuestion };
        }),
      );
      if (!putBack) return;
      setAnnouncement('');
      setActionError(`Klarte ikke å endre navnet. Tråden heter fortsatt «${thread.title}».`);
    });
  }

  function cancelRename(thread: Thread) {
    setRenaming(undefined);
    focusAfter.current = thread.id;
  }

  /*
   * A deletion, the same way: the row goes at once, and comes back if the
   * backend says no.
   *
   * Focus goes to the next row's menu — where a reader clearing out old
   * threads is heading — then the one before, and to «Start din første tråd»
   * when the list is empty. The row is put back by id, and the list sorts
   * itself by `updatedAt`, so it lands where it was.
   *
   * The thread on screen is left for a new one, since there is nothing to
   * show for it any more. If the delete then fails, the row is back in the
   * list and one click away.
   */
  function remove(thread: Thread) {
    if (!actions) return;
    setDeleting(undefined);
    setActionError(undefined);

    const order = groups.flatMap((group) => group.threads);
    const index = order.findIndex((row) => row.id === thread.id);
    const next = order[index + 1] ?? order[index - 1];
    focusAfter.current = next?.id ?? NEW_THREAD;

    change((list) => list.filter((row) => row.id !== thread.id));
    setAnnouncement(`«${thread.title}» er slettet.`);
    if (thread.id === openThreadId) void navigate('/');

    actions.remove(thread).catch(() => {
      change((list) => (list.some((row) => row.id === thread.id) ? list : [...list, thread]));
      setAnnouncement('');
      setActionError(`Klarte ikke å slette «${thread.title}». Tråden er fortsatt her.`);
    });
  }

  function cancelDelete() {
    if (deleting) focusAfter.current = deleting.id;
    setDeleting(undefined);
  }

  return (
    <div className="threads-view" aria-busy={loading || undefined}>
      {/*
        The way in to filtering. The slot tells the view which other views it
        holds, so the button appears only when there is somewhere to go.
        Conditional rendering, not Tabs: this is navigation between two modes,
        not two views that exist side by side. See
        design/designsystemet/behov-til-komponent.md.
      */}
      {siblingViews.includes('filters') && (
        <Button
          ref={filterRef}
          variant="tertiary"
          data-color="neutral"
          onClick={() => onShowView('filters')}
        >
          <FilterIcon aria-hidden="true" />
          Filtrer dokumenter
        </Button>
      )}

      {/*
        No `aria-current` here, and that is the same distinction the rows
        below make: «Ny tråd» is an ACTION, and marking it as the current page
        told a screen reader user that the button they are about to press is
        the page they are already on. The thread rows are places, and they are
        marked (answer 7).

        Over an empty list it is «Start din første tråd», and it is alone
        there (Simens issue 82, round 2): «Ingen tråder ennå» and the sentence
        under it said twice what the button says once. The same link with
        other words rather than a second link further down, so it stands
        exactly where «Ny tråd» stands — lower down, it had the hit count's
        empty region and one more gap over it, 48 px under «Filtrer
        dokumenter» against 24. And focus has one element to go to when the
        last thread is deleted.

        A screen reader loses nothing it needs without the heading. The
        panel's level 2, «Tidligere tråder», still follows, and «første» says
        the list is empty.
      */}
      <Button asChild>
        <RouterLink to="/" ref={newThreadRef} onClick={newThread}>
          {empty ? 'Start din første tråd' : 'Ny tråd'}
          <NewThreadIcon aria-hidden="true" />
        </RouterLink>
      </Button>

      {/*
        «Tidligere tråder» is gone from the screen (Lars, 23.09): the panel is
        a list of threads, the search field says «Søk i tråder», and the
        groups under it name themselves. It stays for a screen reader, and
        that is measured rather than kept out of habit — the group headings
        are level 3, so without a level 2 over them the panel jumps from the
        page's h1 to h3 and a reader moving by headings loses the step that
        says what the list under it is.
      */}
      <Heading level={2} data-size="xs" className="ds-sr-only">
        Tidligere tråder
      </Heading>

      {/*
        <search> is the landmark; the <form> inside it is what makes
        Search.Clear work, since that button is type="reset". Submitting
        does nothing because the list filters as the user types.

        Not drawn over a list known to be empty (KA CC on #197, the same
        thought as Simen's issue 82): there is nothing to search, and «Start
        din første tråd» should stand alone. While the list loads, or could
        not be fetched, it stays, as «Ny tråd» does.
      */}
      {!empty && (
        <search className="threads-view__search">
          <form onSubmit={(event) => event.preventDefault()} onReset={() => setQuery('')}>
            <Search>
              <Search.Input
                aria-label="Søk i tråder"
                aria-describedby={searchStatusId}
                placeholder="Søk i tråder"
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <Search.Clear />
            </Search>
          </form>
        </search>
      )}

      {/*
        The hit count, and the loading message under it, are both rendered
        permanently with their text coming and going. A live region only
        announces content that appears inside a region that already existed,
        so mounting the region together with its text — which is what a
        `{trimmed && …}` around it did — said nothing on the first search.
        ErrorState keeps its alert container for the same reason.
      */}
      <Paragraph asChild data-size="sm">
        <output id={searchStatusId} className="threads-view__search-status">
          {trimmed ? (matches.length === 1 ? '1 tråd' : `${matches.length} tråder`) : ''}
        </output>
      </Paragraph>

      {/*
        One alert region for both kinds of failure. Two would be two voices
        with no order between them, and «Prøv igjen» belongs to the list only:
        a failed rename or delete has already been put back, and doing it
        again is the reader's call, from the row.
      */}
      <ErrorState
        message={failed ? 'Klarte ikke å hente trådene.' : actionError}
        onRetry={failed ? retry : undefined}
      />

      {/*
        Skeleton is aria-hidden, so this carries the message. It also says
        what a rename or a delete did: both change the list without moving
        the reader, so nothing else would tell a screen reader it happened.
      */}
      <output className="ds-sr-only">{loading ? 'Henter tråder' : announcement}</output>

      {loading && (
        <div className="threads-view__loading">
          {[28, 22, 30, 18].map((characters) => (
            <Skeleton key={characters} variant="text" width={characters} />
          ))}
        </div>
      )}

      {threads && threads.length > 0 && matches.length === 0 && (
        <EmptyState title="Ingen treff" description="Ingen tråder passer til søket." />
      )}

      {groups.map((group) => (
        <section key={group.id} className="threads-view__group">
          {/*
            The heading on its own, without `PanelHeader` (Lars, 23.09):
            bigger, in the default text colour, and without the box that
            component draws around a panel's top. It is a label over a group
            of rows, not the head of a panel — the panel's head is the row
            above with «Skjul tråder og filter» in it.

            Level 3 unchanged: the semantics are the same as before, and it is
            only the size and the wrapper that moved.
          */}
          <Heading level={3} data-size="xs" className="threads-view__group-title">
            {group.title}
          </Heading>
          <ul className="threads-view__list">
            {group.threads.map((thread) => {
              return (
                <li key={thread.id} className="threads-view__item">
                  {renaming === thread.id ? (
                    <RenameThread
                      thread={thread}
                      onSave={(title) => rename(thread, title)}
                      onCancel={() => cancelRename(thread)}
                    />
                  ) : (
                    <div className="threads-view__row">
                      {/*
                        Its own component because it measures itself: a title
                        cut off at one line shows the whole row again on hover
                        and on focus, and a title that fits does not. The row
                        is the whole link — title, time and corpus. See
                        ThreadLink.tsx.
                      */}
                      <ThreadLink
                        thread={thread}
                        current={thread.id === openThreadId}
                        corpusLabel={corpusLabel(thread.corpusKey)}
                      />
                      {actions && (
                        <ThreadMenu
                          thread={thread}
                          ref={(button) => {
                            menuRefs.current.set(thread.id, button);
                          }}
                          onRename={() => {
                            setActionError(undefined);
                            setRenaming(thread.id);
                          }}
                          onDelete={() => {
                            setActionError(undefined);
                            setDeleting(thread);
                          }}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <SignedIn session={session} />

      {actions && (
        <DeleteThreadDialog thread={deleting} onConfirm={remove} onCancel={cancelDelete} />
      )}
    </div>
  );
}
