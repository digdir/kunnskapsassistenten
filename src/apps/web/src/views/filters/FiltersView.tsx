import {
  Alert,
  Button,
  Divider,
  Field,
  Label,
  Link,
  Paragraph,
  Select,
  Skeleton,
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
import { YearRangeField } from './YearRangeField';
import { useFlag } from '../../flags';
import { LockedFilter } from './LockedFilter';
import './filters.css';

/**
 * What the panel says when the filter is changed in a thread that is going on
 * and not locked (issue 90). The first two sentences are also what a
 * screen reader is told when it appears.
 */
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

/**
 * The document filter: what the answer is allowed to build on.
 *
 * This is where a first-time user lands (answer 1), so it is the view that
 * has to be legible without any prior state.
 *
 * The selection is not kept here. The chat view has to ask its question
 * against the same narrowing, and two views may not import each other, so the
 * shell holds it — see src/layout/filterContext.ts.
 *
 * The documents under «Fra Kudos» come the same way, from the same shell: they
 * are the sources behind the answer on screen, which the chat view produces
 * and the sources panel also draws. See src/layout/answerSourcesContext.ts.
 */
export function FiltersView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  facets: given,
}: FiltersViewProps) {
  const client = useMemo(() => createChatClient(), []);
  /*
   * Two selections, and the difference matters. `chosen` is what the reader
   * ticked, and it is what the fields, the chips and every change here are
   * made from. `selection` is what a question is asked with — the lock, or
   * the ticks without the fields where every value is ticked — and it is
   * what the counts are fetched for, since they describe what a question
   * would search. filterContext.ts, `askedSelection`.
   */
  const {
    selection,
    setSelection,
    locked,
    chosen: ownChoice,
    setKnownValues,
  } = useFilterSelection();
  const chosen = ownChoice ?? selection;

  /*
   * A thread that is going on, and what its filter was when it came on screen
   * (issue 90).
   *
   * A locked thread cannot have its filter changed: the fields are not drawn.
   * One that is not — started without a filter, or in a mode that keeps none
   * — could, and nothing said that the next question would be asked with
   * something the answers above were not. So a change from what the filter
   * was when the thread came on screen says so, with the same way out the
   * lock has: «Ny tråd». Changing it back takes the note away.
   *
   * «When it came on screen» and not «what its questions were asked with»,
   * which an unlocked thread does not keep. A thread started here comes on
   * screen with its first question, so for it the two are the same.
   *
   * Adjusted during render, as `shownCorpus` below is, so the note is never
   * drawn against the filter of the thread before.
   */
  const openThreadId = useOpenThread();
  const [baseline, setBaseline] = useState({ thread: openThreadId, selection: chosen });
  if (baseline.thread !== openThreadId) setBaseline({ thread: openThreadId, selection: chosen });
  const inUnlockedThread = openThreadId !== undefined && !locked;
  const changedInThread = inUnlockedThread && !sameSelection(chosen, baseline.selection);

  /*
   * «Ny tråd» from this panel, from the note and from the lock: a new
   * conversation, the drawer out of the way and the keyboard in the compose
   * field, as the thread list's — and the reader's filter kept, which is the
   * difference. `useNewThread` empties it, because a new thread from the list
   * starts from the whole corpus (issue 114); from here the reader has just
   * said which filter they want, and is starting over to use it.
   *
   * A plain link to `/` did not do it. The chat slot keys `/` on «Ny tråd»
   * being pressed, so for a thread started on this page the address changed
   * and the conversation and the lock stayed (measured in live, 05.10).
   */
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
  /**
   * What the live region says after a corpus switch, or after a value is
   * removed from a filter that has no field to show it in (ActiveFilter).
   *
   * The region already exists and already announces «Henter filtre»; this
   * reuses it rather than adding a second one, which is what the brief asks
   * and what a panel with two announcers would get wrong anyway — two regions
   * mean two voices and no order between them.
   *
   * The switch itself is silent on screen: the panel is redrawn and the
   * address goes to `/`, neither of which a screen reader reads out. Without
   * this, the one thing that changed — which corpus the next question is
   * asked of — is the one thing nobody is told.
   */
  const [announcement, setAnnouncement] = useState('');

  function chooseCorpus(key: string) {
    const picked = options.find((candidate) => candidate.key === key);

    /*
     * The filter goes with the corpus it was made in.
     *
     * Its values are the keys the backend filters on, and they are the
     * corpus's own: «Nasjonal kommunikasjonsmyndighet» is a Kudos value and
     * means nothing in NorQuAD (persistence.ts says the same about the stored
     * filter). Kept across a switch, it narrows the new corpus by values it
     * has never heard of, and the narrowing travels with the next question.
     *
     * Cleared whole rather than value by value: keeping the few that happen
     * to exist in both — a year, say — keeps a narrowing the reader chose for
     * other documents, and the switch already starts a new thread. It is one
     * fact to tell them, and the region below tells it.
     *
     * Here and not in an effect on `active`: the switch and the clearing are
     * one event, so React commits them together and the fetch below is made
     * once, with the empty selection, instead of once with each.
     */
    const hadFilter = !isEmptySelection(chosen);
    if (hadFilter) setSelection(emptyFilterSelection);

    setAnnouncement(
      hadFilter
        ? `Korpus: ${picked?.label ?? key}. Filteret er nullstilt fordi korpuset ble byttet.`
        : `Korpus: ${picked?.label ?? key}`,
    );

    // The shell owns what a switch does — a new thread, and the address with
    // it. See useCorpus.ts.
    set(key);
  }

  const [facets, setFacets] = useState<FilterFacet[] | undefined>(given);
  /*
   * The facets as they are with nothing selected, kept apart from the ones
   * above because the corpus line is about the corpus and not about what the
   * user is looking at right now. Fed only by a fetch that no selection
   * narrowed, so the line cannot say the corpus shrank when all that happened
   * was that somebody ticked a box.
   */
  const [corpus, setCorpus] = useState<FilterFacet[] | undefined>(given);
  /*
   * Whether the corpus needs a fetch of its own.
   *
   * It used to get one for free: the selection started empty, so the first
   * conditional fetch WAS the unconditional one. #39 restores a saved filter
   * before this view mounts, and with one saved the first fetch is already
   * narrowed — `corpus` was then never set and the line fell back to
   * «Dokumenter fra Kudos» alone, on exactly the reload where the user had
   * most reason to want it. KA CC's follow-up on #34.
   *
   * Read once, at mount, because that is the question: was the selection
   * empty when this view opened? Later changes cannot make the first fetch
   * unconditional in hindsight. Clearing the filter does hand `corpus` the
   * same data through the effect below, which is free and harmless.
   */
  const [needsOwnCorpusFetch] = useState(() => !isEmptySelection(selection));
  const [failed, setFailed] = useState(false);

  /*
   * The corpus the facets on screen were counted from.
   *
   * They were counted once, when the page loaded, and then stayed: after a
   * switch «Virksomheter» still offered Kudos's 259 values and «Vis mer»
   * still said 938 documents, until a reload put it right (KA CC on #131).
   * The reader could pick a value the corpus does not have, and it went with
   * the question.
   *
   * Dropped rather than left standing while the new ones load: the old values
   * belong to the other corpus, and a field that offers them is the bug. The
   * fields go to skeleton for one request, which is what they do on a reload
   * anyway. A selection change still keeps its counts on screen — see the
   * fetch below; that is the same corpus and only a narrowing.
   *
   * Adjusted during render rather than in an effect, so the browser never
   * paints the other corpus's numbers: React re-runs the component with the
   * new state before it commits.
   */
  const [shownCorpus, setShownCorpus] = useState(active);
  if (shownCorpus !== active) {
    setShownCorpus(active);
    // Back to what the view starts on, which is the override when a parent
    // supplies one and nothing otherwise. A view handed its facets is not
    // fetching, and clearing them would leave it loading forever.
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
  /*
   * What is chosen and has no field to be shown in. Nothing while loading:
   * the fields are on their way, and chips drawn for one request would
   * flicker. A failure on a later change keeps the fields it had (see the
   * fetch below), and they still show their values.
   */
  const withoutField = loading ? [] : valuesWithoutField(chosen, facets);

  /*
   * Tell the shell every value each field has, so a question can leave out a
   * field where the reader ticked them all. From the facets on screen, which
   * list every value whatever is ticked — only the counts are conditioned.
   */
  useEffect(() => {
    if (!facets) return;
    setKnownValues?.(
      Object.fromEntries(
        facets.map((facet) => [facet.dimension, facet.values.map((v) => v.value)]),
      ),
    );
  }, [facets, setKnownValues]);

  /*
   * Focus after a switch from the thread list. The button the user pressed
   * was unmounted with the view it stood in, so focus fell to the body; this
   * takes it back to the same place in the panel. The shell says whether a
   * user asked for this view or the page merely opened on it, so nothing is
   * stolen from the skip link on a page load. See SlotViewProps.
   */
  // The flag is settled before this view mounts and does not flip while it is
  // mounted: the button that switches away from a view is the only one that
  // sets it, and it is in the OTHER view. So this runs on mount and no later.
  //
  // Only when focus really was dropped. «Ny tråd» in the thread list switches
  // here too (issue 75, round 2), and the focus that click asked for
  // is the compose field's, which the chat slot takes in an effect of its
  // own in the same commit. Whichever of the two effects runs first, the
  // field keeps it: taken first, it is not on the body when this runs; taken
  // second, it simply moves on from here.
  useEffect(() => {
    const dropped = document.activeElement === null || document.activeElement === document.body;
    if (switchedByUser && dropped) backRef.current?.focus();
  }, [switchedByUser]);

  /*
   * The counts are conditional on the other dimensions: picking one
   * organisation changes how many documents each year has, and leaves that
   * organisation's own list alone. That is the backend's rule and #33 built
   * it; this is the caller, and without it the dropdowns showed the whole
   * corpus no matter what the user had chosen.
   *
   * Refetched on every change of the selection, and `facets` is deliberately
   * NOT cleared first: the fields stay on screen with the old counts until
   * the new ones land, instead of collapsing to a skeleton on every click.
   * The cleanup aborts the previous request, so two answers cannot arrive out
   * of order and leave the counts from a selection the user has moved past.
   *
   * An answer also clears the error. Only «Prøv igjen» used to, and it was the
   * only way the selection could change while the error stood — until the
   * active filter could be removed without a field (ActiveFilter). A removal
   * refetches too, and when that one succeeds the fields are back; an alert
   * saying they could not be fetched may not stand above them.
   */
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
    /*
     * `active` is in here for its side effect and not because the fetch reads
     * it: the corpus travels on the wire from the store, which the client
     * reads when it builds the request (src/api/corpus.ts), so a switch
     * changes the answer to the same call. Without it the facets kept the
     * corpus they were first counted from.
     */
  }, [client, given, attempt, selection, active]);

  /*
   * The unconditional facets, for the corpus line, when the conditional fetch
   * above cannot double as them. One extra request, on a load that restored a
   * filter, and none otherwise.
   *
   * A failure here is deliberately silent: the effect above owns `failed`,
   * and it is asking the same endpoint. Losing this one alone costs the
   * numbers in one sentence, which then says «Dokumenter fra Kudos» — the
   * same thing it says in live mode. That is a worse sentence, not a broken
   * panel, and an error region about it would be.
   */
  useEffect(() => {
    if (given || !needsOwnCorpusFetch) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal, emptyFilterSelection)
      .then(setCorpus)
      .catch(() => {});

    return () => abort.abort();
  }, [client, given, attempt, needsOwnCorpusFetch]);

  /*
   * Where focus goes when the active filter went away with it.
   *
   * To what replaced the block, which is drawn in the same commit — so this
   * is a layout effect: it runs after the new fields' refs are attached and
   * before anything is painted. In order:
   *
   *   - «Prøv igjen», while the fetch has failed. It is the next thing to do,
   *     and it shows.
   *   - The first field, when the facets are here: it is where the tab order
   *     from the chips was going, and a value may have just moved into it.
   *   - The region, when there are no facets. It holds «Filtrering er ikke
   *     tilgjengelig ennå», which says what the panel is now.
   *
   * The region used to be the target in all three, and after a 502 or with
   * fields on screen it was empty by then: 0 × 0, with the focus ring cut
   * away (WCAG 2.4.7; KA CC, kan 1 on #177).
   */
  useLayoutEffect(() => {
    if (!activeFilterLostFocus.current) return;
    activeFilterLostFocus.current = false;
    (retryRef.current ?? firstFieldRef.current ?? unavailableRef.current)?.focus();
  });

  // Clearing the error here rather than in the effect: the retry click is
  // what changed, and setting state inside an effect starts another render.
  //
  // The announcement goes too. The live region says «Henter filtre» while the
  // retry loads and falls back to the announcement when it is done, and a
  // region whose text changes back is read again: «Fjernet fra filteret:
  // 2024» a second time, with nothing removed — and the corpus message the
  // same way (KA CC, kan 2 on #177). It was news once, and it was told.
  const retry = useCallback(() => {
    setFacets(undefined);
    setFailed(false);
    setAnnouncement('');
    setAttempt((count) => count + 1);
  }, []);

  return (
    <div className="filters-view" aria-busy={loading || undefined}>
      {/*
        The top of the panel, pinned while the facets and the documents scroll
        under it: «Filtrering», and the corpus chooser when there is one.

        Anything the reader can reach up here goes IN the head, and that is
        the lesson from #55 rather than a preference. The «Tråder»
        button is the first thing in the tab order here; left below a pinned
        head it keeps that place, the browser scrolls it to the top of the
        region when it takes focus, and it arrives underneath — clicks land on
        the head and the focus ring is invisible. Anything the reader can
        reach either goes IN the head or stays clear of it, and the way out of
        this view is not something to make them scroll for.

        The «Filtrering» heading comes with it because it names what the
        button leads away from, and a heading that scrolled off while its own
        controls stayed would read as a heading for the wrong thing.

        The box is the shell's; see src/layout/viewHeadContext.ts.
      */}
      {/*
        The way back to the thread list, on the PANEL's row rather than in the
        view's pinned head.

        It belongs to the panel and not to what is in it: it says which of the
        two views the panel shows, the way «Skjul tråder og filter» beside it
        says whether the panel is open at all. Sitting in the view head it
        also cost 48 px of a head that took 137 of the scrolling window, and
        the panel scrolls at every width we draw — N1 in
        design/hoydebudsjett-forslag-2026-09-21.md, decided on 21.09.

        Written first in this view so the tab order matches what the reader
        sees: the head row is drawn above the scrolling region, and a portal
        moves the DOM but not the order the browser tabs in. See PanelHead.

        On a rail there is no room for a second control, and `PanelHead` draws
        nothing there — so the rail is exactly as it was.
      */}
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

      <ViewHead>
        <PanelHeader title="Filtrering" size="sm" />

        {/*
          More than one corpus to search, and the choice between them stays at
          the top: it decides what every field below is counted from, so it is
          the first filter rather than a fact about documents. `Select` and not
          `Suggestion`: one value, a handful of options, and the native
          dropdown is the one control a reader already knows on every
          platform (select.md).

          Its description used to be the corpus line. The line has moved
          under the divider (issue 76), and the options already say
          what each corpus is — «Kudos, 938 dokumenter» — so the field stands
          without one.

          Only locally and in mock: a deployment with one corpus, as the test
          environment has in bff mode, draws no chooser at all (corpus.ts).
        */}
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

      {/*
        While the thread is locked the fields are not drawn, so a failure to
        fetch them is not the reader's concern until they leave it.
      */}
      <ErrorState
        message={failed && !locked ? 'Klarte ikke å hente filtrene.' : undefined}
        onRetry={retry}
        retryRef={retryRef}
      />

      {/*
        Skeleton is aria-hidden, so this carries the message. Rendered
        permanently with the text coming and going: a live region only
        announces what appears inside a region that already existed, so
        mounting the region and its text together says nothing — the same
        reason ErrorState keeps its alert container. A retry has to announce.
      */}
      <output className="ds-sr-only">{loading ? 'Henter filtre' : announcement}</output>

      {/*
        The thread on screen is locked to a filter, and every question in it
        is asked with that (filterContext.ts, `locked`). The lock is drawn in
        place of everything that would let the reader change it.
      */}
      {locked && <LockedFilter locked={locked} onNewThread={newThread} />}

      {/*
        The note for a thread that is not locked, where the lock would have
        stood, and with the same way out (issue 90). Designsystemet's
        info alert: it is something to know, not something that went wrong.
        It is not a live region; the panel's own region says it, from
        `change`, so it is said once and not again on every render.
      */}
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

      {loading && !locked && (
        <div className="filters-view__loading">
          {['a', 'b', 'c'].map((key) => (
            <Skeleton key={key} height="var(--ds-size-14)" />
          ))}
        </div>
      )}

      {/*
        The panel without facets: the key is missing and the server answers
        with an empty list, or the fetch failed (the alert above). In both, a
        filter stored on the thread still narrows every question, so it is
        shown here and can be removed — and so is a value of a dimension the
        facets came back without.

        One region around both, rendered permanently and focusable without
        being in the tab order — the pattern ErrorState uses. With no facets it
        is where focus lands when the last chip goes (see the layout effect
        above), and it holds «Filtrering er ikke tilgjengelig ennå» by then,
        which says what the panel is now. It has to exist before and after, so
        it cannot be one of the things that come and go inside it.
      */}
      <div ref={unavailableRef} tabIndex={-1} className="filters-view__unavailable ds-focus">
        {/*
          No facets is a normal state, not an error: nothing is narrowing the
          answer, and the user can still ask. Separate from the loading branch
          above, which tests !facets — an empty array is truthy.

          The description goes while a filter is in force: «uten å avgrense»
          is not true then, and the block under it says what is.
        */}
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
          /* Behind `year-ranges` (#115): the year field takes periods. */
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

      {/*
        The line, and everything under it is about documents: which corpus,
        the ones behind the answer, and the reader's own. Everything over it
        narrows the search. The filters come first, as the design has it
        (issue 76, 30.09), and the line is the break between the two — the
        one place in the panel with more air than between two fields. See
        `.filters-view__divider`.
      */}
      <Divider className="filters-view__divider" />

      {/*
        What the answers are built on. «Kudos» used to appear nowhere the
        first-time user could see it, and nothing said how much there is or
        which years it covers (brukerreiser, punkt 11).

        Read off the UNCONDITIONAL facets — see `corpus` above — so it follows
        the corpus rather than the user's own narrowing, and it says
        «Dokumenter fra Kudos» on its own while they load and in live mode,
        where there is no facet aggregation to read.

        No longer pinned in the head. It was, so that «3 av 6 valgt» said
        three of six of what (brukerblikk runde 2, funn 4); the design moved
        it down with the documents, and the fields still say what they narrow
        in their own labels.
      */}
      <div className="filters-view__documents">
        <CorpusLine facets={corpus} corpus={option} />

        {/*
          The documents the answer builds on, under the corpus they come
          from and over the reader's own.

          This reverses brukerblikk runde 2, funn 4, and on purpose: that put
          the list above the facets so its first row was visible in a 900 px
          window with nothing scrolled. The sketch of 30.09 puts the
          filters first, and after an answer the first row now starts at
          y = 919 in a 1440 × 900 window (mock, with the corpus chooser), so
          the reader scrolls to it.

          Answer 2 still holds: the facets keep their full size, since this
          panel is the only place filtering lives.
        */}
        <KudosDocuments documents={documents} />
      </div>

      {/*
        Last: upload does not exist anywhere in the stack yet (API-bestilling
        A3), so nothing in it changes with the answer.
      */}
      <OwnDocuments />
    </div>
  );
}
