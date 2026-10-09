import { Button, Heading, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import type { Session } from '../../api/session';
import { createThreadActions, type ThreadActions } from '../../api/threadActions';
import { FilterIcon, NewThreadIcon } from '../../components/icons';
import { EmptyState, ErrorState } from '../../components';
import { useCorpus } from '../../layout/useCorpus';
import { askedForNewThread, useNewThread } from '../../layout/useNewThread';
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

/** The thread list. It fetches what it renders, so the shell mounts it without wiring. */
export function ThreadsView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  threads: given,
  actions: givenActions,
  session,
}: ThreadsViewProps) {
  // From the shell, not the router; see src/layout/openThreadContext.ts.
  const openThreadId = useOpenThread();
  // The corpus under each row only when there are several to tell apart, and
  // the whole label, so the reader finds the words they picked in the chooser.
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

  // And the panel goes to the filters, where a new thread is narrowed. Only on
  // a plain click (a new-tab click leaves this page alone), and only when the
  // slot holds the filters.
  function newThread(event: MouseEvent<HTMLAnchorElement>) {
    startNewThread(event);
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (siblingViews.includes('filters')) onShowView('filters');
  }

  // Without rename and delete (live), the rows get no menu rather than two
  // buttons that fail on every press.
  const actions = useMemo(
    () => (givenActions === undefined ? createThreadActions() : (givenActions ?? undefined)),
    [givenActions],
  );
  /** The row being renamed, by thread id. */
  const [renaming, setRenaming] = useState<string | undefined>(undefined);
  const [deleting, setDeleting] = useState<Thread | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  /** What a screen reader is told a rename or a delete did. */
  const [announcement, setAnnouncement] = useState('');
  const menuRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const newThreadRef = useRef<HTMLAnchorElement>(null);
  // Where focus goes after the next render, by thread id or NEW_THREAD. In an
  // effect, because the target is not there (or not yet gone) until then.
  const focusAfter = useRef<string | undefined>(undefined);

  useEffect(() => {
    const target = focusAfter.current;
    if (target === undefined) return;
    focusAfter.current = undefined;
    const button = target === NEW_THREAD ? undefined : menuRefs.current.get(target);
    (button ?? newThreadRef.current)?.focus();
  }, [threads, renaming, deleting]);

  // Focus after a switch from the filter view, which unmounted the pressed
  // button. Not on a fresh page load, where the skip link comes first; the flag
  // does not flip while this view is mounted, so this runs on mount only.
  useEffect(() => {
    if (switchedByUser) filterRef.current?.focus();
  }, [switchedByUser]);

  const loading = !failed && !threads;
  // Known to be empty, not just unknown: only then «Start din første tråd»,
  // since a new thread works whether or not the list loaded.
  const empty = threads?.length === 0;
  // An emptied list hides the search field, so the query goes too, or it would
  // filter the next thread away unseen. Set during render, as React advises.
  if (empty && query !== '') setQuery('');
  const trimmed = query.trim().toLocaleLowerCase('nb-NO');
  const matches = useMemo(
    () =>
      (threads ?? []).filter((thread) => thread.title.toLocaleLowerCase('nb-NO').includes(trimmed)),
    [threads, trimmed],
  );
  const groups = useMemo(() => groupThreads(matches), [matches]);

  // On failure only this thread's title goes back, not the whole list: a
  // delete or a refresh may have landed meanwhile.
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
      // Only if the row still shows this call's title (the rule threadActions.ts
      // keeps for the heading); otherwise a later rename owns it.
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

  // A failed delete puts the row back, and the sort returns it to its place.
  // An open thread goes through the «Ny tråd» count, not just the address: a
  // thread started on `/` is still `/` to the router and would stay on screen.
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
    if (thread.id === openThreadId) {
      askedForNewThread();
      void navigate('/');
    }

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
      {/* Not Tabs: this switches between two modes, not two views side by side. */}
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

      {/* No `aria-current`: «Ny tråd» is an action, not a place like the rows.
          Over an empty list it reads «Start din første tråd», with no text to repeat it. */}
      <Button asChild>
        <RouterLink to="/" ref={newThreadRef} onClick={newThread}>
          {empty ? 'Start din første tråd' : 'Ny tråd'}
          <NewThreadIcon aria-hidden="true" />
        </RouterLink>
      </Button>

      {/* Hidden on screen, where the groups name themselves; kept so the outline
          does not jump from the page's h1 to the groups' h3. */}
      <Heading level={2} data-size="xs" className="ds-sr-only">
        Tidligere tråder
      </Heading>

      {/* The <form> makes Search.Clear (type="reset") work; the list filters as
          the user types. Not drawn over a list known to be empty. */}
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

      {/* Always rendered, like the output below, with the text coming and going:
          a live region announces only changes inside a region that exists. */}
      <Paragraph asChild data-size="sm">
        <output id={searchStatusId} className="threads-view__search-status">
          {trimmed ? (matches.length === 1 ? '1 tråd' : `${matches.length} tråder`) : ''}
        </output>
      </Paragraph>

      {/* One alert region, not two voices in no order. «Prøv igjen» is for the
          list only: a failed rename or delete is already put back. */}
      <ErrorState
        message={failed ? 'Klarte ikke å hente trådene.' : actionError}
        onRetry={failed ? retry : undefined}
      />

      {/* Skeleton is aria-hidden, so this carries the loading message, and what a
          rename or delete did, since neither moves focus. */}
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
          {/* Not `PanelHeader`: this labels a group of rows, not a panel. */}
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
