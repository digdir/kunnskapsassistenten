import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFlag } from '../flags';
import {
  emptyFilterSelection,
  type AnswerSources,
  type FilterSelection,
  type SourceDocument,
} from '../model';
import { AnswerSourcesContext } from './answerSourcesContext';
import { CitationContext, type ActiveCitation } from './citationContext';
import { askedSelection, FilterContext, sameKnownValues, type KnownValues } from './filterContext';
import { LayoutContext } from './layoutContext';
import {
  readStoredFilter,
  readStoredLayout,
  withStoredCollapse,
  withStoredWidths,
  writeStoredFilter,
  writeStoredLayout,
} from './persistence';
import { useDrawerMode } from './useDrawerMode';
import { useNarrowViewport } from './useNarrowViewport';
import {
  defaultLayout,
  otherSidebar,
  withActiveView,
  withCollapsed,
  withAllSidebarsCollapsed,
  withFiltersBesideSources,
  withOneSidebarOpen,
  withViewMoved,
  withWidth,
  yieldingSidebar,
  type Layout,
  type Slot,
  type ViewId,
} from './viewModel';

/**
 * Holds the layout (restored on reload unless `initialLayout` is given) and the state two views
 * share: citation, filter, answer sources. Also the one-sidebar rule below
 * `bothSidebarsMinViewport`, here and not in CSS because the buttons report collapsed state.
 */
export function LayoutProvider({
  children,
  initialLayout,
}: {
  children: ReactNode;
  initialLayout?: Layout;
}) {
  // Read once on mount; skipped when the caller hands in a layout, which it must get as given.
  const [restored] = useState(() => (initialLayout ? undefined : readStoredLayout()));
  const [layout, setLayout] = useState(() =>
    withStoredWidths(withStoredCollapse(initialLayout ?? defaultLayout, restored), restored),
  );
  const narrow = useNarrowViewport();
  // In drawer mode an open sidebar is a modal, so both start shut and an answer opens neither.
  const drawer = useDrawerMode();
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | undefined>(undefined);
  const [selection, setSelection] = useState<FilterSelection>(
    () => readStoredFilter() ?? emptyFilterSelection,
  );
  /** The open thread's lock, if any. See filterContext.ts, `locked`. */
  const [locked, setLocked] = useState<FilterSelection | undefined>(undefined);
  /** Every value each field has, from the filter panel. See `askedSelection`. */
  const [knownValues, setKnownValues] = useState<KnownValues>({});
  // Kept only when the values change, which stops a loop: the facets are fetched for a selection
  // derived from these, and a new object with equal values would fetch again. Returning the
  // previous state makes React bail out.
  const reportKnownValues = useCallback((next: KnownValues) => {
    setKnownValues((previous) => (sameKnownValues(previous, next) ? previous : next));
  }, []);
  const [answerDocuments, setAnswerDocuments] = useState<SourceDocument[] | undefined>(undefined);
  // Every answer's sources, oldest first; undefined («nothing known») until one is recorded.
  const [answers, setAnswers] = useState<AnswerSources[] | undefined>(undefined);
  // The user shut the sources panel. Only their own collapse counts, not the one-sidebar rule's,
  // or a resize would switch it off; opening clears it. Stored, since collapsed is the default.
  const [sourcesDismissed, setSourcesDismissed] = useState(restored?.sourcesDismissed ?? false);
  // The filters-over-sources trial (flag `filters-right-panel`, digdir/kunnskapsassistenten#84) is
  // derived, never stored. Starting it opens the panel the filters moved to, where both sidebars
  // fit, except on a page load where the reader had shut that panel.
  const filtersBeside = useFlag('filters-right-panel');
  const [appliedFiltersBeside, setAppliedFiltersBeside] = useState<boolean | null>(null);
  if (filtersBeside !== appliedFiltersBeside) {
    const firstRender = appliedFiltersBeside === null;
    setAppliedFiltersBeside(filtersBeside);
    if (filtersBeside && !narrow && !drawer && !(firstRender && sourcesDismissed)) {
      setLayout((current) => withCollapsed(current, 'secondary-sidebar', false));
    }
  }

  // The view the user last switched each slot to. Empty on page load on purpose: a view mounted
  // by the default layout must not take focus off the skip link.
  const [switchedTo, setSwitchedTo] = useState<Partial<Record<Slot, ViewId>>>({});

  const setActiveView = useCallback((slot: Slot, view: ViewId) => {
    setLayout((current) => withActiveView(current, slot, view));
    setSwitchedTo((current) => ({ ...current, [slot]: view }));
  }, []);
  // Collapse or open a slot, keeping the one-sidebar rule: the slot being opened wins.
  const fitted = useCallback(
    (current: Layout, slot: Slot, collapsed: boolean): Layout => {
      const next = withCollapsed(current, slot, collapsed);
      if (collapsed || !narrow || slot === 'main') return next;
      return withOneSidebarOpen(next, slot);
    },
    [narrow],
  );

  // Too narrow for both: the sources panel gives. During render, not in an effect, so it is never
  // painted open; only on the crossing, so the user may still open it. Starts false so a window
  // that is already narrow applies it too. Growing back reopens nothing.
  const [appliedForNarrow, setAppliedForNarrow] = useState(false);
  if (narrow !== appliedForNarrow) {
    setAppliedForNarrow(narrow);
    if (narrow) {
      setLayout((current) => withOneSidebarOpen(current, otherSidebar(yieldingSidebar)));
    }
  }

  // Entering drawer mode folds both sidebars, during render: a drawer is modal, so a panel carried
  // open across would be a dialog nobody asked for. Crossing back reopens nothing.
  const [appliedForDrawer, setAppliedForDrawer] = useState(false);
  if (drawer !== appliedForDrawer) {
    setAppliedForDrawer(drawer);
    if (drawer) setLayout(withAllSidebarsCollapsed);
  }

  /** A collapse or an open that the user asked for, by name. */
  const remember = useCallback((slot: Slot, collapsed: boolean) => {
    if (slot === yieldingSidebar) setSourcesDismissed(collapsed);
  }, []);

  const setCollapsed = useCallback(
    (slot: Slot, collapsed: boolean) => {
      remember(slot, collapsed);
      setLayout((current) => fitted(current, slot, collapsed));
    },
    [fitted, remember],
  );
  const toggleCollapsed = useCallback(
    (slot: Slot) => {
      // Read from render scope, not inside the updater: an updater must stay pure, and `remember`
      // sets a second piece of state.
      const collapsed = !layout.slots[slot].collapsed;
      remember(slot, collapsed);
      setLayout((current) => fitted(current, slot, collapsed));
    },
    [fitted, layout, remember],
  );
  // An answer with sources opens the sources panel, during render, when there is room: both fit,
  // or the navigation panel is already shut (an answer must not close it). `sourcesDismissed`
  // keeps it shut once the user has closed it.
  const [sourcesSeen, setSourcesSeen] = useState<SourceDocument[] | undefined>(undefined);
  if (answerDocuments !== sourcesSeen) {
    setSourcesSeen(answerDocuments);

    const roomForBoth = !narrow || layout.slots['primary-sidebar'].collapsed;
    // Never in drawer mode: the modal would cover the answer that just arrived.
    if (
      (answerDocuments?.length ?? 0) > 0 &&
      !sourcesDismissed &&
      layout.slots[yieldingSidebar].collapsed &&
      roomForBoth &&
      !drawer
    ) {
      setLayout((current) => fitted(current, yieldingSidebar, false));
    }
  }

  const setWidth = useCallback(
    (slot: Slot, width: number) => setLayout((current) => withWidth(current, slot, width)),
    [],
  );
  const moveView = useCallback(
    (view: ViewId, target: Slot) => setLayout((current) => withViewMoved(current, view, target)),
    [],
  );

  // An answer that reports twice (sources, then the settled status) replaces its earlier entry.
  const setAnswerSources = useCallback((answer: AnswerSources) => {
    setAnswers((current) => {
      const rest = (current ?? []).filter((other) => other.messageId !== answer.messageId);
      return [...rest, answer];
    });
  }, []);

  const clearAnswerSources = useCallback(() => setAnswers(undefined), []);

  // Asking to see a citation opens its panel; pointing at an excerpt behind a collapsed panel
  // gains nothing. Through `fitted` like every other opening, so a narrow window collapses the
  // navigation panel here too.
  const showCitation = useCallback(
    (number: number, messageId?: string) => {
      setActiveCitation((current) => ({
        number,
        nonce: (current?.nonce ?? 0) + 1,
        ...(messageId === undefined ? {} : { messageId }),
      }));
      // Asking for a citation is asking for the panel, so it undoes an earlier dismissal.
      setSourcesDismissed(false);
      setLayout((current) => fitted(current, 'secondary-sidebar', false));
    },
    [fitted],
  );

  // Compared against the active view, not just read: `withActiveView` ignores
  // a view that does not sit in the slot, and a request that changed nothing
  // must not claim focus.
  const isSwitchedByUser = useCallback(
    (slot: Slot) => switchedTo[slot] === layout.slots[slot].activeView,
    [switchedTo, layout],
  );

  // Written in an effect, not in each setter: the state changes from many places, and one write
  // per commit cannot miss any.
  useEffect(() => writeStoredLayout(layout, sourcesDismissed), [layout, sourcesDismissed]);
  useEffect(() => writeStoredFilter(selection), [selection]);

  const shown = useMemo(
    () => (filtersBeside ? withFiltersBesideSources(layout) : layout),
    [filtersBeside, layout],
  );

  const value = useMemo(
    () => ({
      layout: shown,
      setActiveView,
      setCollapsed,
      toggleCollapsed,
      setWidth,
      moveView,
      isSwitchedByUser,
    }),
    [shown, setActiveView, setCollapsed, toggleCollapsed, setWidth, moveView, isSwitchedByUser],
  );

  const citation = useMemo(
    () => ({ activeCitation, showCitation }),
    [activeCitation, showCitation],
  );

  // Asked with the lock if any, else the reader's choice minus fully ticked fields; the stored
  // selection stays the reader's own.
  const filter = useMemo(
    () => ({
      selection: locked ?? askedSelection(selection, knownValues),
      chosen: selection,
      setSelection,
      locked,
      setLocked,
      setKnownValues: reportKnownValues,
    }),
    [locked, selection, knownValues, reportKnownValues],
  );

  const answerSources = useMemo(
    () => ({
      answers,
      setAnswerSources,
      clearAnswerSources,
      // `answers` wins once it has anything, so the two ways of reporting sources cannot
      // disagree about which answer is newest.
      documents: answers?.at(-1)?.documents ?? answerDocuments,
      setDocuments: setAnswerDocuments,
    }),
    [answers, setAnswerSources, clearAnswerSources, answerDocuments],
  );

  return (
    <LayoutContext value={value}>
      <CitationContext value={citation}>
        <FilterContext value={filter}>
          <AnswerSourcesContext value={answerSources}>{children}</AnswerSourcesContext>
        </FilterContext>
      </CitationContext>
    </LayoutContext>
  );
}
