import { Alert, Button, Heading, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { intlLocale } from '@genai/i18n';
import { useFormat } from '@genai/i18n/react';
import { FunnelIcon, PencilWritingIcon } from '@navikt/aksel-icons';
import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { classes, plainClick } from '../dom.js';
import { DeleteThreadDialog } from './DeleteThreadDialog.js';
import { groupThreads, rowTime, type ThreadGroup } from './grouping.js';
import { useT } from './i18n.js';
import { RenameThread } from './RenameThread.js';
import { ThreadMenu } from './ThreadMenu.js';
import { ThreadRow } from './ThreadRow.js';
import type { ThreadItem } from './types.js';

export interface ThreadsProps {
  /** The threads, in any order. Undefined while they load. */
  threads: readonly ThreadItem[] | undefined;
  /** The list could not be read. */
  failed?: boolean | undefined;
  /** Reads the list again after a failure, behind «Prøv igjen». */
  onRetry?: (() => void) | undefined;
  /** The thread on screen. */
  currentId?: string | undefined;
  /** Each thread's address, so a row can be opened in a new tab. */
  threadHref: (thread: ThreadItem) => string;
  /** A plain click on a row, for a host with its own router. A click for a new tab is the browser's. */
  onOpenThread?: ((thread: ThreadItem) => void) | undefined;
  /** The address of a new thread. Without it there is no «Ny tråd». */
  newThreadHref?: string | undefined;
  /** A plain click on «Ny tråd». */
  onNewThread?: (() => void) | undefined;
  /** A rename, which gives the rows a menu; a rejection puts the name back, `'gone'` drops the row. */
  onRename?: ((thread: ThreadItem, title: string) => unknown) | undefined;
  /** A confirmed delete; a rejected promise puts the row back, and `'gone'` counts as deleted. */
  onDelete?: ((thread: ThreadItem) => unknown) | undefined;
  /** Shows «Filtrer dokumenter», for a filter that shares the panel. */
  onShowFilters?: (() => void) | undefined;
  /** Moves focus to «Filtrer dokumenter» on mount, when the person just switched here from it. */
  focusShowFilters?: boolean | undefined;
  /** «Søk i tråder» over the list, as kunnskapsassistenten draws it. `false` leaves it out. */
  search?: boolean | undefined;
  /**
   * `links`, kunnskapsassistenten's: each row a link on one line, with its time under it. `nav`,
   * the design's: titles in the text colour on one line, with no time, the open row tinted,
   * small group names, «Ny tråd» across the panel, and a row's «…» only on hover or focus.
   */
  variant?: 'links' | 'nav' | undefined;
  /** The level of the list's heading, which is hidden on screen. The groups are one below. */
  headingLevel?: 2 | 3 | 4 | 5 | undefined;
  /** Designsystemet's `data-color` for the block, set only when given. */
  color?: string | undefined;
  /** After the list, such as who is signed in. `foot`, as the shell's panels name theirs. */
  foot?: ReactNode;
  /** @deprecated `foot`, the name the shell uses too; kept until hosts have moved. */
  footer?: ReactNode;
  className?: string | undefined;
}

type Pending =
  | {
      kind: 'rename';
      call: number;
      title: string;
      base: string;
      settled: boolean;
      before?: Pending;
    }
  | { kind: 'delete'; call: number; settled: boolean };

/** Where focus goes when the row it was on has gone. */
const newThreadTarget = '\u0000new-thread';

/** The design's «Ny tråd» stands in a row of its own, which the list scrolls under (dev-trader). */
const NewThreadRow = ({ pinned, children }: { pinned: boolean; children: ReactNode }) =>
  pinned ? <div className="uib-threads-top">{children}</div> : children;

/** «Tråder»: the person's conversations by period, with search, rename and delete. */
export const Threads = ({
  threads,
  failed = false,
  onRetry,
  currentId,
  threadHref,
  onOpenThread,
  newThreadHref,
  onNewThread,
  onRename,
  onDelete,
  onShowFilters,
  focusShowFilters = false,
  search = true,
  variant = 'links',
  headingLevel = 2,
  color,
  foot,
  footer,
  className,
}: ThreadsProps) => {
  const t = useT();
  const f = useFormat();
  const timeWords = {
    yesterday: t('threads.yesterday'),
    dateAtClock: (date: string, clock: string) => t('threads.dateAtClock', { date, clock }),
  };
  const tag = intlLocale(f.locale);
  const [query, setQuery] = useState('');
  const statusId = useId();
  const [renaming, setRenaming] = useState<string | undefined>(undefined);
  const [deleting, setDeleting] = useState<ThreadItem | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  /** What a screen reader is told a rename or a delete did. */
  const [announcement, setAnnouncement] = useState('');
  const pending = useRef(new Map<string, Pending>());
  const calls = useRef(0);
  const outcomes = useRef(new Map<number, 'done' | 'failed'>());
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const menuRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const newThreadRef = useRef<HTMLAnchorElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<string | undefined>(undefined);

  // A settled change stands until the host's list moves past it, so a stale read cannot undo it.
  for (const [id, change] of pending.current) {
    if (!change.settled) continue;
    const given = threads?.find((thread) => thread.id === id);
    if (!given || (change.kind === 'rename' && given.title !== change.base))
      pending.current.delete(id);
  }

  const shown = (threads ?? []).flatMap((thread) => {
    const change = pending.current.get(thread.id);
    if (change?.kind === 'delete') return [];
    return [change?.kind === 'rename' ? { ...thread, title: change.title } : thread];
  });
  const titleOf = (thread: ThreadItem) => thread.title || t('threads.untitled');

  const loading = !failed && !threads;
  const empty = threads !== undefined && shown.length === 0;
  // An emptied list hides the search field, so the query goes too, or it would hide the next thread.
  if (empty && query !== '') setQuery('');
  const needle = query.trim().toLocaleLowerCase(tag);
  const matches = needle
    ? shown.filter((thread) => titleOf(thread).toLocaleLowerCase(tag).includes(needle))
    : shown;
  const groups = groupThreads(matches);
  const hostThread = (id: string) => threads?.find((thread) => thread.id === id);

  useEffect(() => {
    const target = focusAfter.current;
    if (target === undefined) return;
    focusAfter.current = undefined;
    const menu = target === newThreadTarget ? undefined : menuRefs.current.get(target);
    (menu ?? newThreadRef.current ?? headingRef.current)?.focus();
  });

  useEffect(() => {
    if (focusShowFilters) filterRef.current?.focus();
    // On mount only: the flag says how the person got here.
  }, []);

  const settle = (
    result: unknown,
    id: string,
    call: number,
    failure: () => string,
    gone?: { text: () => string; next: string | undefined },
  ) => {
    Promise.resolve(result).then(
      (value) => {
        outcomes.current.set(call, 'done');
        const change = pending.current.get(id);
        if (change?.call !== call) return;
        if (value === 'gone' && gone) {
          // Gone elsewhere: the row goes too, and focus on its menu goes to the next row.
          pending.current.set(id, { kind: 'delete', call, settled: true });
          if (menuRefs.current.get(id) === document.activeElement) focusAfter.current = gone.next;
          setAnnouncement('');
          setActionError(gone.text());
        } else change.settled = true;
        rerender();
      },
      () => {
        outcomes.current.set(call, 'failed');
        const change = pending.current.get(id);
        // A later rename of the same thread owns the row now, and says what happened itself.
        if (change?.call !== call) return;
        // Back to the last name that has not failed, settled if its own call has ended.
        let back = change.kind === 'rename' ? change.before : undefined;
        while (back && outcomes.current.get(back.call) === 'failed')
          back = back.kind === 'rename' ? back.before : undefined;
        if (back)
          pending.current.set(id, { ...back, settled: outcomes.current.get(back.call) === 'done' });
        else pending.current.delete(id);
        setAnnouncement('');
        setActionError(failure());
        rerender();
      },
    );
  };

  const rename = (thread: ThreadItem, title: string) => {
    const given = hostThread(thread.id);
    setRenaming(undefined);
    setActionError(undefined);
    focusAfter.current = thread.id;
    if (!onRename || !given) return;
    const call = ++calls.current;
    const before = pending.current.get(thread.id);
    pending.current.set(thread.id, {
      kind: 'rename',
      call,
      title,
      base: given.title,
      settled: false,
      ...(before?.kind === 'rename' ? { before } : {}),
    });
    setAnnouncement(t('threads.renamed', { title }));
    rerender();
    const old = titleOf(thread);
    const order = groups.flatMap((group) => group.threads);
    const index = order.findIndex((row) => row.id === thread.id);
    settle(
      onRename(given, title),
      thread.id,
      call,
      () => t('threads.renameFailed', { title: old }),
      {
        text: () => t('threads.renameGone', { title: old }),
        next: (order[index + 1] ?? order[index - 1])?.id ?? newThreadTarget,
      },
    );
  };

  const remove = (thread: ThreadItem) => {
    const given = hostThread(thread.id);
    setDeleting(undefined);
    setActionError(undefined);
    if (!onDelete || !given) return;
    const order = groups.flatMap((group) => group.threads);
    const index = order.findIndex((row) => row.id === thread.id);
    focusAfter.current = (order[index + 1] ?? order[index - 1])?.id ?? newThreadTarget;
    const call = ++calls.current;
    pending.current.set(thread.id, { kind: 'delete', call, settled: false });
    const name = titleOf(thread);
    setAnnouncement(t('threads.deleted', { title: name }));
    rerender();
    settle(onDelete(given), thread.id, call, () => t('threads.deleteFailed', { title: name }));
  };

  const groupTitle = (group: ThreadGroup) => {
    switch (group.period) {
      case 'today':
        return t('threads.today');
      case 'last7':
        return t('threads.last7');
      case 'last30':
        return t('threads.last30');
      case 'undated':
        return t('threads.undated');
      case 'year':
        return String(group.year);
      case 'month': {
        const month = f.month(group.date);
        return month.charAt(0).toLocaleUpperCase(tag) + month.slice(1);
      }
    }
  };

  const hasMenu = Boolean(onRename ?? onDelete);
  const level = Math.min(headingLevel + 1, 6) as 3 | 4 | 5 | 6;
  const nav = variant === 'nav';

  const groupList = groups.map((group) => (
    <section key={group.id} className="uib-threads-group">
      <Heading level={level} data-size="xs" className="uib-threads-group-title">
        {groupTitle(group)}
      </Heading>
      <ul className="uib-threads-list">
        {group.threads.map((thread) => (
          <li key={thread.id} className="uib-threads-item">
            {renaming === thread.id ? (
              <RenameThread
                title={thread.title}
                onSave={(title) => rename(thread, title)}
                onCancel={() => {
                  setRenaming(undefined);
                  focusAfter.current = thread.id;
                }}
              />
            ) : (
              <div className="uib-threads-row">
                <ThreadRow
                  title={titleOf(thread)}
                  href={threadHref(hostThread(thread.id) ?? thread)}
                  current={thread.id === currentId}
                  time={nav ? undefined : rowTime(thread.updatedAt, f, timeWords)}
                  dataset={thread.dataset}
                  wrap={nav}
                  onOpen={
                    onOpenThread ? () => onOpenThread(hostThread(thread.id) ?? thread) : undefined
                  }
                />
                {hasMenu ? (
                  <ThreadMenu
                    title={titleOf(thread)}
                    ref={(button) => {
                      menuRefs.current.set(thread.id, button);
                    }}
                    onRename={
                      onRename
                        ? () => {
                            setActionError(undefined);
                            setRenaming(thread.id);
                          }
                        : undefined
                    }
                    onDelete={
                      onDelete
                        ? () => {
                            setActionError(undefined);
                            setDeleting(thread);
                          }
                        : undefined
                    }
                  />
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  ));

  return (
    <div
      className={classes('uib-threads', className)}
      data-color={color}
      data-variant={nav ? 'nav' : undefined}
      aria-busy={loading || undefined}
    >
      {onShowFilters ? (
        <Button
          className="uib-threads-show-filters"
          ref={filterRef}
          variant="tertiary"
          // Pinned to neutral, as kunnskapsassistenten draws it: a way to the filter, not the brand.
          data-color="neutral"
          onClick={onShowFilters}
        >
          <FunnelIcon aria-hidden="true" />
          {t('threads.showFilters')}
        </Button>
      ) : null}

      {/* No aria-current: «Ny tråd» is an action, not a place like the rows. */}
      {newThreadHref !== undefined ? (
        <NewThreadRow pinned={nav}>
          <Button asChild>
            <a
              href={newThreadHref}
              ref={newThreadRef}
              className="uib-threads-new"
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                if (!onNewThread || !plainClick(event)) return;
                event.preventDefault();
                onNewThread();
              }}
            >
              {empty ? t('threads.firstThread') : t('threads.newThread')}
              {/* The design's button is its words alone. */}
              {nav ? null : <PencilWritingIcon aria-hidden="true" />}
            </a>
          </Button>
        </NewThreadRow>
      ) : null}

      {/* Hidden on screen, where the groups name themselves; kept so the outline does not jump. */}
      <Heading
        ref={headingRef}
        level={headingLevel}
        data-size="xs"
        className="ds-sr-only"
        tabIndex={-1}
      >
        {t('threads.earlier')}
      </Heading>

      {/* The form makes Search.Clear (a reset) work; the list filters as the person types. */}
      {empty || !search ? null : (
        <search className="uib-threads-search">
          <form onSubmit={(event) => event.preventDefault()} onReset={() => setQuery('')}>
            <Search>
              <Search.Input
                aria-label={t('threads.search')}
                aria-describedby={statusId}
                placeholder={t('threads.search')}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <Search.Clear />
            </Search>
          </form>
        </search>
      )}

      {/* Always rendered with the search: a live region announces only changes inside a region
          that exists. Without the search there is nothing to count. */}
      {search ? (
        <Paragraph asChild data-size="sm">
          <output id={statusId} className="uib-threads-search-status">
            {needle ? t('threads.matches', { count: matches.length }) : ''}
          </output>
        </Paragraph>
      ) : null}

      {/* One alert region, with «Prøv igjen» for the list only: a failed change is put back. */}
      <ErrorRegion
        message={failed ? t('threads.loadFailed') : actionError}
        onRetry={failed ? onRetry : undefined}
        retryLabel={t('threads.retry')}
      />

      {/* The skeleton is hidden from screen readers, so this says it loads, and what a change did. */}
      <output className="ds-sr-only">{loading ? t('threads.loading') : announcement}</output>

      {loading ? (
        <div className="uib-threads-loading">
          {[28, 22, 30, 18].map((characters) => (
            <Skeleton key={characters} variant="text" width={characters} />
          ))}
        </div>
      ) : null}

      {needle && shown.length > 0 && matches.length === 0 ? (
        <div className="uib-threads-no-matches">
          <Heading level={level} data-size="2xs">
            {t('threads.noMatches')}
          </Heading>
          <Paragraph data-size="sm" variant="long">
            {t('threads.noMatchesHint')}
          </Paragraph>
        </div>
      ) : null}

      {/* The design's groups are one list, the space above each heading, none between them. */}
      {nav && groupList.length > 0 ? (
        <div className="uib-threads-groups">{groupList}</div>
      ) : (
        groupList
      )}

      {foot ?? footer}

      {onDelete ? (
        <DeleteThreadDialog
          title={deleting ? titleOf(deleting) : undefined}
          onConfirm={() => deleting && remove(deleting)}
          onCancel={() => {
            if (deleting) focusAfter.current = deleting.id;
            setDeleting(undefined);
          }}
        />
      ) : null}
    </div>
  );
};

/** Always rendered: role="alert" announces only content added to an existing region. */
const ErrorRegion = ({
  message,
  onRetry,
  retryLabel,
}: {
  message: string | undefined;
  onRetry: (() => void) | undefined;
  retryLabel: string;
}) => {
  const region = useRef<HTMLDivElement>(null);
  const retryHeldFocus = useRef(false);

  useEffect(() => {
    if (message || !retryHeldFocus.current) return;
    retryHeldFocus.current = false;
    // Only focus that got lost: a host's retry may have moved it somewhere on purpose.
    if (document.activeElement !== document.body && document.activeElement !== null) return;
    region.current?.focus();
  }, [message]);

  return (
    <div role="alert" className="uib-threads-error" tabIndex={-1} ref={region}>
      {message ? (
        <Alert data-color="danger">
          <Paragraph variant="long">{message}</Paragraph>
          {onRetry ? (
            <Button
              variant="secondary"
              data-size="sm"
              onClick={() => {
                retryHeldFocus.current = region.current?.contains(document.activeElement) ?? false;
                onRetry();
              }}
            >
              {retryLabel}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
};
