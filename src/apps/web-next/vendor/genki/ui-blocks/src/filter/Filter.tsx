import { Alert, Button, Divider, Heading, Paragraph } from '@digdir/designsystemet-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnnounceContext, freshText } from './announce.js';
import { FacetField, type FieldHandle } from './FacetField.js';
import {
  ActiveFilter,
  FieldPlaceholder,
  LockedFilter,
  NewThreadLink,
  type NewThreadLinkProps,
} from './FilterStates.js';
import { FilterRows } from './FilterRows.js';
import { useT } from './i18n.js';
import { chosenValues, sameSelection, valuesWithoutField } from './selection.js';
import type { FilterField, FilterSelection } from './types.js';
import { YearRangeField } from './YearRangeField.js';

export type * from './types.js';
export * from './FilterLines.js';
export {
  documentCount,
  fieldValueLabels,
  isEmptySelection,
  narrowing,
  sameSelection,
  valueLabels,
} from './selection.js';

export interface FilterProps {
  /** The filter fields with their facets, in order; undefined while loading, [] for none. */
  fields?: readonly FilterField[] | undefined;
  /** What the reader chose; a value no field shows is listed so it can be removed. */
  selection: FilterSelection;
  /** Called only when the selection changes. Ask with `narrowing(selection, fields)`. */
  onChange: (selection: FilterSelection) => void;
  /** The fields could not be fetched. */
  failed?: boolean | undefined;
  /** «Prøv igjen» with the error. */
  onRetry?: (() => void) | undefined;
  /** The thread on screen is locked to this filter, so the fields are not drawn. */
  locked?: FilterSelection | undefined;
  /** The thread on screen, undefined for a new one; an unlocked thread's change shows a note. */
  thread?: string | undefined;
  /** A plain click on «Ny tråd» in the lock and the note; without it neither link is drawn. */
  onNewThread?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  /** Where «Ny tråd» leads in a new tab. A plain click calls `onNewThread` instead. */
  newThreadHref?: string | undefined;
  /** A field of kind `year` takes periods, and years in a row show as one chip. */
  yearPeriods?: boolean | undefined;
  /**
   * The ids of the fields whose values are years, for when the facets are missing: a filter in
   * force then still shows its years as periods, «2020–2022», one chip each.
   */
  yearFields?: readonly string[] | undefined;
  /** One chip for six or more chosen values too; all of two or more listed always are. */
  compactChips?: boolean | undefined;
  /** The most values a field can send; more shows a warning. */
  maxValues?: number | undefined;
  /** The heading, «Filtrering» by default. `false` leaves it to the host. */
  title?: ReactNode | false | undefined;
  headingLevel?: 2 | 3 | 4 | 5 | undefined;
  /** Over the fields, under the heading, such as `CorpusChoice`. It shares the live region. */
  head?: ReactNode;
  /** Where the heading and `head` are drawn instead, such as a pinned region; `null` draws none. */
  pinIn?: Element | null | undefined;
  /** Before the fields, over a line, such as `Documents`, in sight without scrolling. */
  documents?: ReactNode;
  /** Under a line after the fields, such as the reader's own documents. */
  children?: ReactNode;
  /**
   * `fields`, the default: a list with search per field. `panel`, the dev boards' filter beside
   * the threads: «Fjern alle filtre» over the fields, each a row that opens to a checkbox per value
   * with its exact count, and `children` under them with no line.
   */
  variant?: 'fields' | 'panel' | undefined;
  /** Designsystemet's `data-color` for the block, set only when given. */
  color?: string | undefined;
  className?: string | undefined;
}

/** An error, always rendered, as `role="alert"` announces only what is added to it. */
const ErrorRegion = ({
  message,
  onRetry,
  retryRef,
}: {
  message: string | undefined;
  onRetry: (() => void) | undefined;
  retryRef: RefObject<HTMLButtonElement | null>;
}) => {
  const t = useT();
  const region = useRef<HTMLDivElement>(null);
  // True only between a retry click that held focus and the error clearing.
  const retryHeldFocus = useRef(false);

  useEffect(() => {
    if (message || !retryHeldFocus.current) return;
    retryHeldFocus.current = false;
    if (document.activeElement !== document.body && document.activeElement !== null) return;
    region.current?.focus();
  }, [message]);

  return (
    <div role="alert" className="uib-filter-error ds-focus" tabIndex={-1} ref={region}>
      {message ? (
        <Alert data-color="danger">
          <Paragraph variant="long">{message}</Paragraph>
          {onRetry ? (
            <Button
              variant="secondary"
              data-size="sm"
              ref={retryRef}
              onClick={() => {
                // Read before the button unmounts; Safari does not focus a clicked button.
                retryHeldFocus.current = region.current?.contains(document.activeElement) ?? false;
                onRetry();
              }}
            >
              {t('filter.retry')}
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </div>
  );
};

/** The document filter: a field per facet, a thread's lock and a note. Data in, events out. */
export const Filter = ({
  fields,
  selection,
  onChange,
  failed = false,
  onRetry,
  locked,
  thread,
  onNewThread,
  newThreadHref,
  yearPeriods = false,
  yearFields,
  compactChips = false,
  maxValues = 100,
  title,
  headingLevel = 2,
  head,
  pinIn,
  documents,
  children,
  variant = 'fields',
  color,
  className,
}: FilterProps) => {
  const t = useT();
  const panel = variant === 'panel';
  const sub = Math.min(headingLevel + 1, 6) as 3 | 4 | 5 | 6;
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback(
    (text: string) => setAnnouncement((previous) => freshText(previous, text)),
    [],
  );

  // A note while an unlocked thread's filter differs from when it came, set during render.
  const [baseline, setBaseline] = useState({ thread, selection });
  if (baseline.thread !== thread) setBaseline({ thread, selection });
  const inUnlockedThread = thread !== undefined && !locked;
  const changedInThread = inUnlockedThread && !sameSelection(selection, baseline.selection);
  const newThread: NewThreadLinkProps | undefined = onNewThread
    ? {
        href: newThreadHref,
        onNewThread: (event) => {
          // The note was about the thread that is now gone.
          setAnnouncement('');
          onNewThread(event);
        },
      }
    : undefined;

  /** Every change the reader makes, so the note is announced; a field's `said` comes first. */
  const change = (next: FilterSelection, said?: string) => {
    const note =
      inUnlockedThread && !changedInThread && !sameSelection(next, baseline.selection)
        ? t('filter.changedInThread')
        : undefined;
    const text = [said, note].filter(Boolean).join(' ');
    if (text) announce(text);
    // A field may only tell, as of a period already chosen.
    if (!sameSelection(next, selection)) onChange(next);
  };

  const loading = !failed && fields === undefined;
  // None while loading, so chips do not flicker; a failed refetch keeps the old fields.
  const withoutField = loading ? [] : valuesWithoutField(selection, fields);

  const retryRef = useRef<HTMLButtonElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<FieldHandle>(null);
  /** Set by ActiveFilter when it went away holding focus; read below. */
  const activeFilterLostFocus = useRef(false);
  const onActiveFilterLostFocus = useCallback(() => {
    activeFilterLostFocus.current = true;
  }, []);

  // Focus after the filter went: «Prøv igjen», else the first field, else the region.
  useLayoutEffect(() => {
    if (!activeFilterLostFocus.current) return;
    activeFilterLostFocus.current = false;
    (retryRef.current ?? firstFieldRef.current ?? unavailableRef.current)?.focus();
  });

  // The announcement goes with a retry, or the region would read it a second time.
  const retry = onRetry
    ? () => {
        setAnnouncement('');
        onRetry();
      }
    : undefined;

  const headNode =
    title === false && !head ? null : (
      <div className="uib-filter-head" data-color={color}>
        {title === false ? null : (
          <Heading level={headingLevel} data-size="sm">
            {title ?? t('filter.title')}
          </Heading>
        )}
        {head}
      </div>
    );

  return (
    <AnnounceContext value={announce}>
      <div
        className={['uib-filter', className].filter(Boolean).join(' ')}
        data-color={color}
        data-variant={panel ? 'panel' : undefined}
        aria-busy={loading || undefined}
      >
        {headNode === null
          ? null
          : pinIn === undefined
            ? headNode
            : pinIn && createPortal(headNode, pinIn)}

        {documents ? (
          <>
            {/* Above is about documents; below narrows the search. */}
            <div className="uib-filter-above">{documents}</div>
            <Divider className="uib-filter-divider" />
          </>
        ) : null}

        {/* While locked, the fields are not drawn, so a failure to fetch them can wait. */}
        <ErrorRegion
          message={failed && !locked ? t('filter.failed') : undefined}
          onRetry={retry}
          retryRef={retryRef}
        />

        {/* Always rendered, since a live region announces only changes inside it. */}
        <output className="ds-sr-only">{loading ? t('filter.loading') : announcement}</output>

        {locked && (
          <LockedFilter values={chosenValues(locked, fields)} level={sub} newThread={newThread} />
        )}

        {/* Info, not an error. Not a live region: `change` announces it once, not per render. */}
        {changedInThread && (
          <Alert data-color="info" data-size="sm" className="uib-filter-changed">
            <Paragraph data-size="sm" variant="long">
              {t('filter.changedInThread')}
              {newThread ? ` ${t('filter.changedInThreadAsk')}` : ''}
            </Paragraph>
            {newThread ? <NewThreadLink {...newThread} /> : null}
          </Alert>
        )}

        {/* One per field the facets usually bring, so nothing below moves. */}
        {loading && !locked && ['a', 'b', 'c'].map((key) => <FieldPlaceholder key={key} />)}

        {/* A stored filter without fields still narrows, so it shows here, focusable. */}
        <div ref={unavailableRef} tabIndex={-1} className="uib-filter-unavailable ds-focus">
          {/* A normal state, not an error, with no hint while a filter is in force. */}
          {!locked && fields?.length === 0 && (
            <div className="uib-filter-empty">
              <Heading level={sub} data-size="2xs">
                {t('filter.unavailable')}
              </Heading>
              {withoutField.length === 0 ? (
                <Paragraph data-size="sm" variant="long">
                  {t('filter.unavailableHint')}
                </Paragraph>
              ) : null}
            </div>
          )}

          {!locked && withoutField.length > 0 && (
            <ActiveFilter
              selection={selection}
              chosen={withoutField}
              yearFields={[
                ...(yearFields ?? []),
                ...(fields ?? []).filter((field) => field.kind === 'year').map((field) => field.id),
              ]}
              hasFields={(fields?.length ?? 0) > 0}
              level={sub}
              onChange={change}
              onFocusLost={onActiveFilterLostFocus}
              onAnnounce={announce}
            />
          )}
        </div>

        {!locked && panel && fields && fields.length > 0 ? (
          <FilterRows
            ref={firstFieldRef}
            fields={fields}
            selection={selection}
            onChange={change}
            level={sub}
            yearPeriods={yearPeriods}
            compact={compactChips}
            max={maxValues}
          />
        ) : null}

        {!locked &&
          !panel &&
          fields?.map((field, index) => {
            const Field = field.kind === 'year' && yearPeriods ? YearRangeField : FacetField;
            return (
              <Field
                key={field.id}
                ref={index === 0 ? firstFieldRef : undefined}
                field={field}
                selected={selection[field.id] ?? []}
                compact={compactChips}
                max={maxValues}
                onChange={(values, said) => change({ ...selection, [field.id]: values }, said)}
              />
            );
          })}

        {children ? (
          <>
            {/* Above narrows the search; below is about documents. The panel's rows end in a line. */}
            {panel ? null : <Divider className="uib-filter-divider" />}
            <div className="uib-filter-below">{children}</div>
          </>
        ) : null}
      </div>
    </AnnounceContext>
  );
};
