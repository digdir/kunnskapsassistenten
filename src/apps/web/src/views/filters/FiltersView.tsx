import {
  Alert,
  Button,
  Divider,
  Field,
  Label,
  Link,
  Paragraph,
  Select,
} from '@digdir/designsystemet-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Link as RouterLink } from 'react-router';
import { createChatClient } from '../../api';
import { BackIcon } from '../../components/icons';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import { useAnswerSources } from '../../layout/useAnswerSources';
import { useCorpus } from '../../layout/useCorpus';
import { useFilterSelection } from '../../layout/useFilterSelection';
import { useNewThread } from '../../layout/useNewThread';
import { useOpenThread } from '../../layout/useOpenThread';
import { PanelHead } from '../../layout/PanelHead';
import { ViewHead } from '../../layout/ViewHead';
import type { SlotViewProps } from '../../layout/viewModel';
import {
  emptyFilterSelection,
  filterDimensions,
  isEmptySelection,
  type FilterFacet,
  type FilterSelection,
} from '../../model';
import { ActiveFilter } from './ActiveFilter';
import { valuesWithoutField } from './withoutField';
import { KudosDocuments } from './DocumentsList';
import { OwnDocuments } from './OwnDocuments';
import { CorpusLine } from './CorpusLine';
import { FacetField, type FacetFieldHandle } from './FacetField';
import { FieldPlaceholder } from './FieldPlaceholder';
import { YearRangeField } from './YearRangeField';
import { useFlag } from '../../flags';
import { LockedFilter } from './LockedFilter';
import './filters.css';

/** The note when the filter changes in an unlocked thread, and what is announced. */
const CHANGED_IN_THREAD =
  'Du har endret filteret i en tråd som er i gang. Nye spørsmål i tråden bruker det nye filteret.';

/** Whether two selections hold the same values, in any order. */
function sameSelection(a: FilterSelection, b: FilterSelection): boolean {
  return filterDimensions.every((dimension) => {
    const left = new Set(a[dimension]);
    const right = new Set(b[dimension]);
    return left.size === right.size && [...left].every((value) => right.has(value));
  });
}

export type FiltersViewProps = Pick<SlotViewProps, 'siblingViews' | 'onShowView'> &
  /* Optional: a view mounted outside the shell has not been switched to. */
  Partial<Pick<SlotViewProps, 'switchedByUser'>> & {
    /** Overrides the fetch. Only for tests. */
    facets?: FilterFacet[];
  };

/** The document filter. Its selection and the answer's documents live in the shell: the chat
    view needs them too, and views may not import each other (src/layout/filterContext.ts). */
export function FiltersView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  facets: given,
}: FiltersViewProps) {
  const client = useMemo(() => createChatClient(), []);
  // `chosen` is what the reader ticked, and the fields show it; `selection` is what a question
  // is asked with (filterContext.ts, `askedSelection`), so the counts are fetched for it.
  const {
    selection,
    setSelection,
    locked,
    chosen: ownChoice,
    setKnownValues,
  } = useFilterSelection();
  const chosen = ownChoice ?? selection;

  // The note shows while an unlocked thread's filter differs from what it was when the thread
  // came on screen, since such a thread keeps no filter of its own. Adjusted during render, so
  // the note is never drawn against the previous thread.
  const openThreadId = useOpenThread();
  const [baseline, setBaseline] = useState({ thread: openThreadId, selection: chosen });
  if (baseline.thread !== openThreadId) setBaseline({ thread: openThreadId, selection: chosen });
  const inUnlockedThread = openThreadId !== undefined && !locked;
  const changedInThread = inUnlockedThread && !sameSelection(chosen, baseline.selection);

  // Keeps the reader's filter, which `useNewThread` empties. Not a plain link to `/`: the chat
  // slot keys `/` on «Ny tråd» being pressed, so only the address would change.
  const startNewThread = useNewThread();
  function newThread(event: MouseEvent<HTMLAnchorElement>) {
    const keep = chosen;
    startNewThread(event);
    setSelection(keep);
    // The note was about the thread that is now gone.
    setAnnouncement('');
  }

  /** Every change the reader makes, so the note is announced as it appears. */
  function change(next: FilterSelection) {
    if (inUnlockedThread && !changedInThread && !sameSelection(next, baseline.selection)) {
      setAnnouncement(CHANGED_IN_THREAD);
    }
    setSelection(next);
  }
  const { documents } = useAnswerSources();
  const { options, active, option, choosable, set } = useCorpus();
  // What the live region says after a corpus switch (otherwise silent to a screen reader) or a
  // removal in ActiveFilter. One region with «Henter filtre»: two would speak in no set order.
  const [announcement, setAnnouncement] = useState('');

  function chooseCorpus(key: string) {
    const picked = options.find((candidate) => candidate.key === key);

    // The values are the old corpus's keys and would narrow the new one by values it lacks.
    // Here, not in an effect on `active`, so React commits both together and fetches once.
    const hadFilter = !isEmptySelection(chosen);
    if (hadFilter) setSelection(emptyFilterSelection);

    setAnnouncement(
      hadFilter
        ? `Korpus: ${picked?.label ?? key}. Filteret er nullstilt fordi korpuset ble byttet.`
        : `Korpus: ${picked?.label ?? key}`,
    );

    // The shell owns what a switch does (a new thread and address); see useCorpus.ts.
    set(key);
  }

  const [facets, setFacets] = useState<FilterFacet[] | undefined>(given);
  /* Unnarrowed facets for the corpus line, so ticking a box cannot shrink the corpus. */
  const [corpus, setCorpus] = useState<FilterFacet[] | undefined>(given);
  // A filter restored before mount narrows the first fetch, so the corpus line then needs a
  // fetch of its own. Read once: later changes cannot make the first fetch unconditional.
  const [needsOwnCorpusFetch] = useState(() => !isEmptySelection(selection));
  const [failed, setFailed] = useState(false);

  // On a corpus switch the facets are dropped, not kept while the new ones load: their values
  // belong to the other corpus and could go with the question. Adjusted during render, so the
  // old numbers are never painted.
  const [shownCorpus, setShownCorpus] = useState(active);
  if (shownCorpus !== active) {
    setShownCorpus(active);
    // Back to the override: a view handed its facets does not fetch, and would load forever.
    setFacets(given);
    setCorpus(given);
    setFailed(false);
  }
  const [attempt, setAttempt] = useState(0);
  const backRef = useRef<HTMLButtonElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<FacetFieldHandle>(null);
  const yearRanges = useFlag('year-ranges');
  /** Set by ActiveFilter when it went away holding focus; read below. */
  const activeFilterLostFocus = useRef(false);
  const onActiveFilterLostFocus = useCallback(() => {
    activeFilterLostFocus.current = true;
  }, []);
  const loading = !failed && !facets;
  // None while loading: chips drawn for one request would flicker. A failed refetch keeps the
  // old fields, and they still show their values.
  const withoutField = loading ? [] : valuesWithoutField(chosen, facets);

  // Every value of each field, so a question can leave out a field the reader ticked whole.
  // The facets list every value, whatever is ticked.
  useEffect(() => {
    if (!facets) return;
    setKnownValues?.(
      Object.fromEntries(
        facets.map((facet) => [facet.dimension, facet.values.map((v) => v.value)]),
      ),
    );
  }, [facets, setKnownValues]);

  // The pressed button went with the other view, so focus fell to the body. Not on a page load
  // (the skip link keeps it), and only if focus was dropped: «Ny tråd» also switches here and
  // focuses the compose field in the same commit.
  useEffect(() => {
    const dropped = document.activeElement === null || document.activeElement === document.body;
    if (switchedByUser && dropped) backRef.current?.focus();
  }, [switchedByUser]);

  // Refetched on every selection change: the backend counts each dimension given the others.
  // `facets` is not cleared first, so the old counts stay instead of a skeleton. Success clears
  // the error too: a chip removal refetches.
  useEffect(() => {
    if (given) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal, selection)
      .then((found) => {
        setFacets(found);
        setFailed(false);
        if (isEmptySelection(selection)) setCorpus(found);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => abort.abort();
    // `active` is not read here, but the client sends the stored corpus with the request
    // (src/api/corpus.ts), so a switch has to refetch.
  }, [client, given, attempt, selection, active]);

  // The unconditional facets when the fetch above is narrowed. Silent on failure: the effect
  // above owns `failed`, and the corpus line only loses its counts, as in live mode.
  useEffect(() => {
    if (given || !needsOwnCorpusFetch) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal, emptyFilterSelection)
      .then(setCorpus)
      .catch(() => {});

    return () => abort.abort();
  }, [client, given, attempt, needsOwnCorpusFetch]);

  // After the active filter went away holding focus: «Prøv igjen», else the first field, else
  // the region. Not always the region: empty, it is 0 × 0 and hides the focus ring (WCAG 2.4.7).
  // A layout effect, so the new refs are set before paint.
  useLayoutEffect(() => {
    if (!activeFilterLostFocus.current) return;
    activeFilterLostFocus.current = false;
    (retryRef.current ?? firstFieldRef.current ?? unavailableRef.current)?.focus();
  });

  // Cleared here, not in the effect: state set in an effect costs a render.
  // The announcement goes too: when «Henter filtre» gives way, the region
  // would read the old announcement a second time.
  const retry = useCallback(() => {
    setFacets(undefined);
    setFailed(false);
    setAnnouncement('');
    setAttempt((count) => count + 1);
  }, []);

  return (
    <div className="filters-view" aria-busy={loading || undefined}>
      {/* On the panel's row: it says which view the panel shows. First in the view so the tab
          order matches the screen; a portal moves the DOM, not the tab order. */}
      {siblingViews.includes('threads') && (
        <PanelHead>
          <Button
            ref={backRef}
            variant="tertiary"
            data-color="neutral"
            className="filters-view__back"
            onClick={() => onShowView('threads')}
          >
            <BackIcon aria-hidden="true" />
            Tråder
          </Button>
        </PanelHead>
      )}

      {/* Anything reachable goes IN the pinned head or stays clear of it: a control below it
          scrolls in under it when focused. The heading stays with its controls. The box is the
          shell's (src/layout/viewHeadContext.ts). */}
      <ViewHead>
        <PanelHeader title="Filtrering" size="sm" />

        {/* First, since the corpus decides what every field below counts. `Select`, not
            `Suggestion`: one value from a handful. No description: the options say it. */}
        {choosable && (
          <Field>
            <Label>Korpus</Label>
            <Select value={active} onChange={(event) => chooseCorpus(event.currentTarget.value)}>
              {options.map((candidate) => (
                <Select.Option key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </Select.Option>
              ))}
            </Select>
          </Field>
        )}
      </ViewHead>

      {/* While locked, the fields are not drawn, so a failure to fetch them can wait. */}
      <ErrorState
        message={failed && !locked ? 'Klarte ikke å hente filtrene.' : undefined}
        onRetry={retry}
        retryRef={retryRef}
      />

      {/* Always rendered: a live region only announces changes inside a region that already
          exists. The skeleton is aria-hidden, so this carries «Henter filtre». */}
      <output className="ds-sr-only">{loading ? 'Henter filtre' : announcement}</output>

      {locked && <LockedFilter locked={locked} onNewThread={newThread} />}

      {/* Info, not an error. Not a live region: `change` announces it once, not per render. */}
      {changedInThread && (
        <Alert data-color="info" data-size="sm" className="filters-view__changed">
          <Paragraph data-size="sm" variant="long">
            {CHANGED_IN_THREAD} Vil du heller starte en ny tråd med det?
          </Paragraph>
          <Link asChild data-size="sm">
            <RouterLink to="/" onClick={newThread}>
              Ny tråd
            </RouterLink>
          </Link>
        </Alert>
      )}

      {/* One per field the facets usually bring, so nothing below moves. */}
      {loading && !locked && ['a', 'b', 'c'].map((key) => <FieldPlaceholder key={key} />)}

      {/* Without facets a stored filter still narrows every question, so it is shown here.
          Always rendered and focusable: focus lands here when the last chip goes. */}
      <div ref={unavailableRef} tabIndex={-1} className="filters-view__unavailable ds-focus">
        {/* A normal state, not an error. Apart from loading, since an empty array is truthy.
            No description while a filter is in force: «uten å avgrense» would not be true. */}
        {!locked && facets?.length === 0 && (
          <EmptyState
            title="Filtrering er ikke tilgjengelig ennå"
            description={
              withoutField.length === 0
                ? 'Du kan stille spørsmål uten å avgrense dokumentene.'
                : undefined
            }
          />
        )}

        {!locked && withoutField.length > 0 && (
          <ActiveFilter
            selection={chosen}
            chosen={withoutField}
            hasFields={(facets?.length ?? 0) > 0}
            onChange={change}
            onFocusLost={onActiveFilterLostFocus}
            onAnnounce={setAnnouncement}
          />
        )}
      </div>

      {!locked &&
        facets?.map((facet, index) => {
          /* Behind `year-ranges`: the year field takes periods. */
          const Field = facet.dimension === 'year' && yearRanges ? YearRangeField : FacetField;
          return (
            <Field
              key={facet.dimension}
              ref={index === 0 ? firstFieldRef : undefined}
              facet={facet}
              selected={chosen[facet.dimension]}
              onChange={(values) => change({ ...chosen, [facet.dimension]: values })}
            />
          );
        })}

      {/* Above narrows the search; below is about documents. */}
      <Divider className="filters-view__divider" />

      {/* Not in the pinned head: the fields name what they narrow in their labels. */}
      <div className="filters-view__documents">
        <CorpusLine facets={corpus} corpus={option} />

        {/* Below the filters even though the reader scrolls to them: the facets keep their
            full size, as this panel is the only place filtering lives. */}
        <KudosDocuments documents={documents} />
      </div>

      {/* Last: nothing in it changes with the answer. */}
      <OwnDocuments />
    </div>
  );
}
