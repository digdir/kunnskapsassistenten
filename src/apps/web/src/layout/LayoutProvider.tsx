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
 * Holds the layout: which view is active in each slot, whether a slot is
 * collapsed, and how wide the slots are.
 *
 * The operations are the ones a layout UI would need — switch view, collapse,
 * resize, move a view between slots — and they exist before that UI does, on
 * purpose (answers 10 and 48).
 *
 * Collapse and the document filter survive a reload, in `localStorage`. See
 * persistence.ts for what is kept and what is deliberately not. A caller that
 * hands in `initialLayout` is saying exactly what it wants to see, and is not
 * overruled by what the browser remembers.
 *
 * It also holds the pieces of state that two views have to agree on and
 * therefore neither can own: the active citation, the document filter, and
 * the sources behind the answer on screen. See citationContext.ts,
 * filterContext.ts and answerSourcesContext.ts.
 *
 * And it owns one rule about the window: below `bothSidebarsMinViewport` only
 * one sidebar can be open at a time, so opening one collapses the other.
 * Decision 2026-09-14, option B. It lives here rather than in CSS because it
 * changes collapsed state, which the buttons report; see useNarrowViewport.ts.
 */
export function LayoutProvider({
  children,
  initialLayout,
}: {
  children: ReactNode;
  initialLayout?: Layout;
}) {
  /**
   * What the browser remembered, read once on mount and never again. A
   * caller that hands in a layout skips it: a test or a preview that asks for
   * both sidebars open has to get both sidebars open.
   */
  const [restored] = useState(() => (initialLayout ? undefined : readStoredLayout()));
  const [layout, setLayout] = useState(() =>
    withStoredWidths(withStoredCollapse(initialLayout ?? defaultLayout, restored), restored),
  );
  const narrow = useNarrowViewport();
  /*
   * Below 1139 an open sidebar becomes a modal drawer over the answer
   * column. The provider needs to know, because two things about STATE
   * change down there and state is what it owns: both sidebars start shut,
   * and an arriving answer does not open one. See useDrawerMode.ts.
   */
  const drawer = useDrawerMode();
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | undefined>(undefined);
  const [selection, setSelection] = useState<FilterSelection>(
    () => readStoredFilter() ?? emptyFilterSelection,
  );
  /** The open thread's lock, if any. See filterContext.ts, `locked`. */
  const [locked, setLocked] = useState<FilterSelection | undefined>(undefined);
  /** Every value each field has, from the filter panel. See `askedSelection`. */
  const [knownValues, setKnownValues] = useState<KnownValues>({});
  /*
   * Kept only when the values have changed, and that is what stops a loop.
   * The panel reports them every time its facets arrive, and its facets are
   * fetched for the selection a question is asked with — which is worked out
   * from these. A new object for the same values gave a new selection, a new
   * fetch, new facets and a new object again: seven fetches every two
   * seconds with nobody touching anything (KA CC, blokkerende 1 on #183).
   * Handing React the previous state makes it bail out, and the round stops.
   */
  const reportKnownValues = useCallback((next: KnownValues) => {
    setKnownValues((previous) => (sameKnownValues(previous, next) ? previous : next));
  }, []);
  const [answerDocuments, setAnswerDocuments] = useState<SourceDocument[] | undefined>(undefined);
  /**
   * The sources of every answer in the thread, oldest first.
   *
   * Undefined until something is recorded: the sources panel reads undefined
   * as «nothing is known» and an empty list as «no answers», and while the
   * chat view still reports one flat list the honest answer is the first.
   */
  const [answers, setAnswers] = useState<AnswerSources[] | undefined>(undefined);
  /**
   * Has the user said, in so many words, that they do not want the sources
   * panel open?
   *
   * Only a collapse the USER asked for counts. The one-sidebar rule collapses
   * this panel too, and treating that as a preference would mean a window
   * resize silently switched the answer panel off for the rest of the session.
   *
   * Opening it again clears it: the last thing the user said about the panel
   * is what this holds, and they have just said «show me».
   *
   * Remembered across a reload, and that is the whole reason it is stored at
   * all: the panel starts collapsed by default, so a collapse restored on its
   * own is indistinguishable from a fresh page, and the first answer with
   * sources would open the panel in the face of somebody who had just shut it.
   */
  const [sourcesDismissed, setSourcesDismissed] = useState(restored?.sourcesDismissed ?? false);
  /*
   * The trial with the filters over the sources (flag `filters-right-panel`,
   * digdir/kunnskapsassistenten#84). What is shown is derived from the layout
   * and not stored in it, so turning the flag off puts everything back where
   * it was, and what is written to storage is the same either way.
   *
   * Starting the trial opens the panel the filters are now in, or nobody
   * finds them before the first question: on a page load unless the reader
   * has shut that panel themselves, and always when the flag is turned on
   * while the page is open. Only where both sidebars fit. In a narrower
   * window the navigation panel stays the one that is open, as it is
   * without the flag. Adjusted during render with a remembered previous
   * value, as the narrow rule below.
   */
  const filtersBeside = useFlag('filters-right-panel');
  const [appliedFiltersBeside, setAppliedFiltersBeside] = useState<boolean | null>(null);
  if (filtersBeside !== appliedFiltersBeside) {
    const firstRender = appliedFiltersBeside === null;
    setAppliedFiltersBeside(filtersBeside);
    if (filtersBeside && !narrow && !drawer && !(firstRender && sourcesDismissed)) {
      setLayout((current) => withCollapsed(current, 'secondary-sidebar', false));
    }
  }

  // The view the user last switched each slot to. Empty on a page load, which
  // is the whole point: a view that mounts because the default layout opened
  // on it must not take focus off the skip link.
  const [switchedTo, setSwitchedTo] = useState<Partial<Record<Slot, ViewId>>>({});

  const setActiveView = useCallback((slot: Slot, view: ViewId) => {
    setLayout((current) => withActiveView(current, slot, view));
    setSwitchedTo((current) => ({ ...current, [slot]: view }));
  }, []);
  /**
   * Collapse or open a slot, and keep the one-sidebar rule while doing it.
   *
   * Opening is the only direction that can break the rule, and the slot being
   * opened is the one that wins: the user asked for it, so the other sidebar
   * is what gives. `main` is not a sidebar and never takes part.
   */
  const fitted = useCallback(
    (current: Layout, slot: Slot, collapsed: boolean): Layout => {
      const next = withCollapsed(current, slot, collapsed);
      if (collapsed || !narrow || slot === 'main') return next;
      return withOneSidebarOpen(next, slot);
    },
    [narrow],
  );

  /**
   * The window just got too narrow for both. The sources panel is the one that
   * gives — it is opened to check a citation, while the navigation panel is
   * where the conversation is steered from.
   *
   * Adjusted during render with a remembered previous value, not in an effect.
   * React re-runs the component with the new state before it commits anything,
   * so the sidebar is never painted open in a window that cannot hold it; an
   * effect would have shown it for a frame and then taken it away.
   *
   * Only on the crossing, hence the guard. Running it on every render would
   * make the rule mean «below 1440 the sources panel cannot be open», which is
   * a different rule: the user is still allowed to open it down there, and
   * doing so collapses the navigation panel instead.
   *
   * Growing back is deliberately not the mirror image. The rule takes a panel
   * away when there is no room; it does not hand one back, because a panel
   * that opened itself would undo a choice the user made.
   */
  // Starts false rather than at `narrow`, so a first render in a window that
  // is ALREADY narrow applies the rule as well. `initialLayout` is an argument
  // and cannot be assumed to obey a rule about the window it will be drawn in.
  const [appliedForNarrow, setAppliedForNarrow] = useState(false);
  if (narrow !== appliedForNarrow) {
    setAppliedForNarrow(narrow);
    if (narrow) {
      setLayout((current) => withOneSidebarOpen(current, otherSidebar(yieldingSidebar)));
    }
  }

  /**
   * Entering drawer mode folds both sidebars away.
   *
   * The same shape as the rule above, and for the same reason it is not an
   * effect: a drawer is MODAL, so a panel carried across the breakpoint open
   * would be a dialog over the answer, holding the keyboard, that the reader
   * never asked for. Painting it for a frame and then closing it would be
   * worse than not painting it at all.
   *
   * Crossing back does not reopen anything, for the reason the one-sidebar
   * rule gives: a panel that opens itself undoes a choice the user made.
   */
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
      // Read from render scope, not from inside the updater: an updater has to
      // stay pure, and `remember` is a second piece of state being set.
      const collapsed = !layout.slots[slot].collapsed;
      remember(slot, collapsed);
      setLayout((current) => fitted(current, slot, collapsed));
    },
    [fitted, layout, remember],
  );
  /**
   * The sources panel opens itself when an answer brings sources, once there
   * is somewhere to put it.
   *
   * Adjusted during render with a remembered previous value, the same shape as
   * the narrow rule above and for the same reason: an effect would paint the
   * answer once with the panel shut and then open it a frame later.
   *
   * «Somewhere to put it» is the whole condition. Above the breakpoint both
   * sidebars fit, so it opens. Below it, only if the navigation panel is
   * already collapsed — the one-sidebar rule would otherwise close the
   * navigation panel to make room, and taking a panel away from the user is
   * something they have to ask for, not something an arriving answer does.
   *
   * It runs on every batch of sources, not only the first. A follow-up answer
   * finds the panel already open and changes nothing, and if the user closed
   * it in between, `sourcesDismissed` is what stops it coming back.
   */
  const [sourcesSeen, setSourcesSeen] = useState<SourceDocument[] | undefined>(undefined);
  if (answerDocuments !== sourcesSeen) {
    setSourcesSeen(answerDocuments);

    const roomForBoth = !narrow || layout.slots['primary-sidebar'].collapsed;
    /*
     * Never in drawer mode. Down there the panel is a modal: it would cover
     * the answer that just arrived and take the keyboard off the reader, in
     * the middle of them reading it. «Somewhere to put it» has no answer
     * below 1139 — there is no beside.
     */
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

  /**
   * Record one answer's sources. The newest wins its own slot; an answer that
   * reports twice — sources arriving, then the status settling — replaces its
   * earlier entry rather than appearing twice.
   */
  const setAnswerSources = useCallback((answer: AnswerSources) => {
    setAnswers((current) => {
      const rest = (current ?? []).filter((other) => other.messageId !== answer.messageId);
      return [...rest, answer];
    });
  }, []);

  const clearAnswerSources = useCallback(() => setAnswers(undefined), []);

  // Asking to see a citation opens the panel it lives in. Nothing is gained
  // by pointing at an excerpt behind a collapsed panel.
  //
  // Through `fitted` like every other opening, so a narrow window collapses
  // the navigation panel here too. A citation is a request to open a sidebar;
  // where the request came from changes nothing about whether it fits.
  const showCitation = useCallback(
    (number: number, messageId?: string) => {
      setActiveCitation((current) => ({
        number,
        nonce: (current?.nonce ?? 0) + 1,
        ...(messageId === undefined ? {} : { messageId }),
      }));
      // Asking to see a citation is asking for the panel, so it counts as the
      // user changing their mind about having closed it.
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

  /**
   * Write the two remembered things back whenever they change.
   *
   * In an effect rather than in the setters: this state is changed from six
   * places — both toggle buttons, rule B, a citation, the panel opening
   * itself, the filter view — and a write in each of them is five chances to
   * forget one. Here it runs once per commit, on what the state actually
   * settled at. The first run writes back what was just read, which costs one
   * `setItem` and keeps the rule to one sentence.
   */
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

  /*
   * What questions are asked with: the lock when there is one, and otherwise
   * the reader's choice without the fields they ticked every value of. The
   * stored selection above stays the reader's own, and so does what is
   * written back to `localStorage`.
   */
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
      // `answers` wins the moment it has anything, so the two ways of
      // reporting sources cannot disagree about which answer is newest.
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
