import { Button, Dialog, SkipLink, Tooltip } from '@digdir/designsystemet-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Outlet } from 'react-router';
import { PrimarySidebarIcon, SecondarySidebarIcon } from '../components/icons';
import { ComposerContext } from './composerContext';
import { COMPOSER_ID } from './ids';
import { PanelSeparator } from './PanelSeparator';
import { SidebarFooter } from './SidebarFooter';
import { useFooterMode } from './footerMode';
import { OpenThreadContext } from './openThreadContext';
import { PanelHeadContext } from './panelHeadContext';
import { MainScrollContext } from './scrollContext';
import { shortcutModifier } from './shortcutModifier';
import { useNoAnswers } from './useNoAnswers';
import { useScrollTabStop } from './useScrollTabStop';
import { useOpenThreadRegistry } from './useOpenThread';
import { useCitation } from './useCitation';
import { useComposerRegistry } from './useComposerPresence';
import { useDrawerMode } from './useDrawerMode';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { ViewHeadContext, type ViewHeadContextValue } from './viewHeadContext';
import { viewComponents } from './viewComponents';
import { drawerPlacement, layoutStyle, slotLabel, views } from './viewModel';

export type ShellProps = {
  /**
   * The route draws the main slot itself, and the view that normally sits
   * there stands down. For pages that are not a conversation at all; see
   * src/routes/NotFound.tsx.
   */
  routeOwnsMain?: boolean;
};

/**
 * The shell: three slots on one row.
 *
 * Slots are named after position — `primary-sidebar`, `main`,
 * `secondary-sidebar` — and never after the content that happens to sit in
 * them today. Views are named after content and can move between slots. Same
 * split VS Code makes, and the rule set on 2026-09-11.
 *
 * Two reasons the slots are not named after the side they sit on today:
 *
 *   1. Screen readers. The accessible name comes from the view in the slot,
 *      via slotLabel(), so moving a view moves its name with it. A name tied
 *      to a side lies the day the panel is moved, and a screen reader user
 *      has no sides to navigate by anyway.
 *   2. The user will be able to choose what sits where. A name tied to
 *      position cannot survive that.
 *
 * Widths come from the layout as CSS custom properties, so CSS never needs to
 * know whether a slot is collapsed. See viewModel.ts and LayoutProvider.tsx.
 */
export function Shell({ routeOwnsMain = false }: ShellProps) {
  const { layout } = useLayout();
  /*
   * A panel's drawn width depends on the window as well as on the layout: a
   * panel dragged wider than this window can hold is drawn at what fits. See
   * `fittedWidths` in viewModel.ts.
   */
  const viewport = useViewportWidth();
  /*
   * Below 1139 an open sidebar is drawn over the answer column instead of
   * beside it, so the row becomes rail + answer + rail. The shell asks once
   * and hands the answer down; two slots reading the same media query would
   * be two subscriptions to the same fact.
   */
  const drawer = useDrawerMode();
  // The main slot owns the scroll, so the element is handed to the views
  // rather than looked up from inside them. See scrollContext.ts.
  const mainScroll = useRef<HTMLElement | null>(null);

  /*
   * The answer column takes the keyboard when nothing inside it can (WCAG
   * 2.1.1; axe's `scrollable-region-focusable`). Same rule and same hook as
   * the sidebars, see `needsTabStop` in Sidebar below and useScrollTabStop.ts.
   *
   * It never came up while every page in here had a compose field or a link
   * to tab to. `/om-prosjektet` is the first that has neither: six paragraphs
   * of prose, 1073 px of them in a 900 px window at 1440, and no way to
   * scroll it from the keyboard at all. Measured by #3 on issue 85d.
   *
   * No `role` and no `aria-label`, unlike the sidebars: `main` is already a
   * landmark and already named. The tab stop is the whole change.
   */
  const [mainNeedsTabStop, measureMainScroll] = useScrollTabStop();
  const [mainHoldsFocus, setMainHoldsFocus] = useState(false);
  const mainFocusable = mainNeedsTabStop || mainHoldsFocus;
  const setMain = useCallback(
    (node: HTMLElement | null) => {
      mainScroll.current = node;
      measureMainScroll(node);
    },
    [measureMainScroll],
  );

  // No conversation on this page, so nothing will ever report sources. The
  // panel has to be told, or it draws the skeletons for an answer that is not
  // coming. See useNoAnswers.ts.
  useNoAnswers(routeOwnsMain);

  /**
   * Whether the views below have a compose field on screen, for the second
   * skip link. See composerContext.ts for why the shell has to be told rather
   * than work it out from the route.
   *
   * Held here and not in `LayoutProvider`, because the question is about what
   * is on screen in THIS shell and the provider outlives it: the two layout
   * routes in App.tsx mount separate shells, and a count kept above them
   * would carry a field from the page being left over to the page being
   * entered.
   */
  const composerPresence = useComposerRegistry();

  /**
   * Which conversation is on screen, for the thread list's `aria-current`.
   *
   * Held here for the same reason as the compose field above: the question is
   * about what is on screen in THIS shell, and the two layout routes mount
   * separate shells. See openThreadContext.ts for why the router cannot
   * answer it.
   */
  const openThread = useOpenThreadRegistry();

  /**
   * The view head of the answer column. Held here rather than in a component
   * of its own, because the box is drawn inside `<main>` and the provider has
   * to wrap what comes after it.
   */
  const [mainHead, mainHeadRef] = useViewHeadBox(mainScroll);

  return (
    <MainScrollContext value={mainScroll}>
      <SkipLink href="#main-content">Hopp til hovedinnhold</SkipLink>
      {/*
        The second skip link, and the one that earns its keep every turn.
        «Hopp til hovedinnhold» lands at the top of the answer; the compose
        field is at the BOTTOM of it, and reaching it by keyboard was tab stop
        22 — for the thing a reader does more often than anything else. Reise
        7 and 15 in design/brukerreiser-2026-09-15.md, punkt 8 on the ranked
        list. #3 asked for it; #41 put the id where both sides can read it.

        Drawn only while a compose field is actually mounted, which is a
        question only the view holding the conversation can answer — it says
        so through `ComposerContext`. It used to be drawn whenever the route
        did not draw its own main, and those are different questions: on
        `/threads/<ukjent>` the chat view draws «Fant ikke tråden» in a main
        slot the route did not draw, and the link pointed at nothing.

        `COMPOSER_ID` comes from ids.ts rather than from the chat view, so the
        shell never imports a view to build its own chrome.

        The shortcut is named in the link because it is the one place a reader
        who tabs here will look for it, and because the hint by the field
        itself is going away — H3 in
        design/hoydebudsjett-forslag-2026-09-21.md buys 24 px of reading
        window by taking it out of the footer, and that was decided on 21.09. The
        modifier is the one this machine has; see shortcutModifier.ts.
      */}
      {composerPresence.hasComposer ? (
        <SkipLink href={`#${COMPOSER_ID}`}>
          Hopp til skrivefeltet ({shortcutModifier()} + /)
        </SkipLink>
      ) : null}

      <ComposerContext value={composerPresence}>
        <OpenThreadContext value={openThread}>
          <div
            className="shell"
            data-drawer={drawer || undefined}
            style={layoutStyle(layout, viewport, drawer)}
          >
            <Sidebar slot="primary-sidebar" element="nav" drawer={drawer} />

            {/*
              The focus pair below observes the landmark's own focus, to keep
              the tab stop while it holds it. It is not an interaction: nothing
              in here is clickable, which is what the rule is otherwise right
              to ask about.
            */}
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <main
              id="main-content"
              className={mainFocusable ? 'main ds-focus--inset' : 'main'}
              ref={setMain}
              /*
                The rule takes a tabIndex on a non-interactive element for a
                mistake. Here it is the fix, and only while the region cannot
                be scrolled any other way — same exception the scroll box
                around a wide table makes, see src/components/Markdown.tsx.
              */
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={mainFocusable ? 0 : undefined}
              /*
                Kept a stop while it holds the focus, even once it no longer
                needs to be one: an element that stops being focusable with
                the focus on it hands it to `<body>`, above the skip link
                (WCAG 2.4.3). Same pairing as the sidebars'.
              */
              onFocus={(event) => {
                if (event.target === event.currentTarget) setMainHoldsFocus(true);
              }}
              onBlur={(event) => {
                if (event.target === event.currentTarget) setMainHoldsFocus(false);
              }}
            >
              {/*
              The reading width, inside the scrolling region rather than being
              it. `main` fills the whole field between the panels so the wheel
              works anywhere in it; this box is the 800 px the text is set in.
              See `.main-column` in global.css for what the split is for.

              A plain `div` on purpose: one landmark per region, and `main` is
              already it.
            */}
              <div className="main-column">
                {/*
              The answer column's view head. First in the region, so nothing
              the reader can reach ends up underneath it when it pins — which
              is the whole reason the shell owns the place rather than the
              view. The search strip in the answer (#60) is what asked for it:
              it sits at the bottom of the answer card and scrolls out of
              sight exactly when a hit is found at the top.

              Empty until a view fills it, and an empty head draws no line.
            */}
                <div className="view-head" ref={mainHeadRef} />

                {/*
              The route contributes the page's level 1 heading and nothing
              else; the view in the slot is what draws the content, looked up
              in viewComponents like every other slot. Chat used to BE the
              outlet, and that made it the one view no reader could ever move.

              `routeOwnsMain` is the one exception, and it is about pages
              rather than about views: the catch-all route draws its own main,
              because «siden finnes ikke» with a working conversation under it
              would be two answers to one question. The sidebars stay: the
              thread list and the filter are still there to steer to somewhere
              that exists.
            */}
                <ViewHeadContext value={mainHead}>
                  <Outlet />
                  {routeOwnsMain ? null : <MainSlot />}
                </ViewHeadContext>
              </div>
            </main>

            <Sidebar slot="secondary-sidebar" element="aside" drawer={drawer} />
          </div>
        </OpenThreadContext>
      </ComposerContext>
    </MainScrollContext>
  );
}

/**
 * A box the shell offers and a view fills, as state rather than a ref.
 *
 * State and not a ref, because the view has to render again once the box
 * exists. React runs the ref callback during the commit and flushes the state
 * it sets before paint, so the extra render costs a render and not a frame.
 *
 * Both heads use it: the pinned one at the top of the scrolling region, and
 * the panel's own row beside the collapse button.
 */
function useHeadBox(): [HTMLElement | null, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return [element, setElement];
}

/**
 * The shell's end of the view head: the box, and the context a view renders
 * into it through.
 *
 * State and not a ref, because the view has to render again once the box
 * exists. React runs the ref callback during the commit and flushes the state
 * it sets before paint, so the extra render costs a render and not a frame.
 *
 * Why the shell holds the box at all, rather than each view pinning its own
 * head: viewHeadContext.ts, with the measurement from #55.
 */
function useViewHeadBox(
  scroller: RefObject<HTMLElement | null>,
): [ViewHeadContextValue, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useHeadBox();
  const value = useMemo(() => ({ element }), [element]);

  /*
   * Keep the region from scrolling things underneath its own head.
   *
   * `scrollIntoView` and the scroll the browser does when something takes
   * focus both stop at the top of the scrollport, which is exactly where the
   * head is pinned. So a `[n]` marker sent to an excerpt, or a Tab onto a
   * facet field further down, lands behind it: the reader is told they are
   * somewhere they cannot see, and the focus ring is invisible. WCAG 2.4.11.
   *
   * `scroll-padding-block-start` moves that stopping line down by the head's
   * height. Measured rather than written down, because the head is the view's
   * and changes with it — the sources panel grows an answer selector with the
   * second answer, the filter panel's corpus line wraps to two lines in a
   * narrow panel. Zero when the head is empty, since `.view-head:empty` is
   * `display: none` and an element that is not drawn has no height.
   *
   * The same repair the compose field makes at the other end of the same
   * element (`scrollPaddingBlockEnd` in views/chat/ChatView.tsx). Two
   * properties, no argument between them.
   */
  useEffect(() => {
    const region = scroller.current;
    if (element === null || region === null) return;
    // jsdom has no ResizeObserver, and nothing there scrolls or paints. The
    // stub belongs in the tests that need the views' own observers, not here.
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      region.style.scrollPaddingBlockStart = `${Math.round(element.offsetHeight)}px`;
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      region.style.scrollPaddingBlockStart = '';
    };
  }, [element, scroller]);

  return [value, setElement];
}

/**
 * One sidebar slot: a collapse button, and the active view under it.
 *
 * The content stays in the DOM when collapsed and is hidden with `hidden`, so
 * the button's `aria-controls` always points at something that exists and
 * `aria-expanded` means what it says.
 */
// The glyph shows which edge the panel sits at, so it is chosen per slot
// rather than per view. See src/components/icons.ts.
const slotIcons = {
  'primary-sidebar': PrimarySidebarIcon,
  'secondary-sidebar': SecondarySidebarIcon,
} as const;

/**
 * The view in the main slot. No collapse button: main is what the sidebars
 * sit beside, and a page with its content collapsed is a blank page.
 */
function MainSlot() {
  const { layout, setCollapsed, setActiveView, isSwitchedByUser } = useLayout();
  const { activeCitation } = useCitation();
  const state = layout.slots.main;
  const ActiveView = viewComponents[state.activeView];

  return (
    <ActiveView
      view={state.activeView}
      collapsed={state.collapsed}
      onCollapsedChange={(collapsed) => setCollapsed('main', collapsed)}
      activeCitationNumber={activeCitation?.number}
      activeCitationNonce={activeCitation?.nonce}
      siblingViews={state.views.filter((id) => id !== state.activeView)}
      onShowView={(view) => setActiveView('main', view)}
      switchedByUser={isSwitchedByUser('main')}
    />
  );
}

function Sidebar({
  slot,
  element: Element,
  drawer,
}: {
  slot: 'primary-sidebar' | 'secondary-sidebar';
  element: 'nav' | 'aside';
  /** Draw an open panel over the answer column rather than beside it. */
  drawer: boolean;
}) {
  const { layout, toggleCollapsed, setCollapsed, setActiveView, isSwitchedByUser } = useLayout();
  const { activeCitation } = useCitation();
  const state = layout.slots[slot];
  const contentId = useId();
  const label = slotLabel(layout, slot);
  const ActiveView = viewComponents[state.activeView];
  const Icon = slotIcons[slot];

  const toggle = useRef<HTMLButtonElement>(null);
  const element = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);

  /*
   * The scrolling region takes the keyboard when nothing else can reach it
   * (WCAG 2.1.1; axe's `scrollable-region-focusable`, found by KA CC). The
   * filter panel waiting for the BFF scrolls with nothing in it but
   * skeletons, and the way out is on the panel's own row, outside the
   * region. Measured at 1280 × 720, 786 px of content in a 592 px window.
   *
   * Only when it scrolls AND has no control in it — Chromium's rule since
   * 130, and axe's. A region with a control in it is already scrolled from
   * the keyboard, and the filter panel always scrolls at 1440 and 1280: an
   * extra stop there, between «Tråder» and the corpus chooser, was what the
   * first version cost every keyboard user (KA CC on #211). See
   * useScrollTabStop.ts.
   *
   * Kept while it has focus, even when it no longer needs to be a stop: an
   * element that stops being focusable while it holds the focus hands it to
   * `<body>`, above the skip link (WCAG 2.4.3).
   *
   * A group and not a region: the slot is already a landmark with the same
   * name, and a second landmark inside it would say it twice in every
   * landmark list. The name is what says why the focus stopped there.
   *
   * The ring is Designsystemet's inset one: the panel clips what reaches past
   * its edge, and an outer ring would be cut away on three sides.
   */
  const [needsTabStop, measureScroll] = useScrollTabStop();
  const [holdsFocus, setHoldsFocus] = useState(false);
  const focusable = needsTabStop || holdsFocus;
  const setContent = useCallback(
    (node: HTMLDivElement | null) => {
      content.current = node;
      measureScroll(node);
    },
    [measureScroll],
  );

  /**
   * This slot's view head. Outside `ActiveView`, so switching between the two
   * views in a slot does not take the box away and put a new one back — the
   * view that mounts finds the place already there.
   */
  const [viewHead, viewHeadRef] = useViewHeadBox(content);

  /**
   * This slot's panel-head place. Plain box state: it neither pins nor
   * scrolls, so it needs none of what `useViewHeadBox` adds on top.
   */
  const [panelHeadElement, panelHeadRef] = useHeadBox();
  const panelHead = useMemo(() => ({ element: panelHeadElement }), [panelHeadElement]);

  /**
   * Whether the keyboard focus is anywhere inside this slot — the toggle
   * button as well as the content.
   *
   * State rather than a ref, and that is the part that matters: the repair
   * below has to know whether the slot held focus BEFORE the change it is
   * reacting to, and an effect closes over the value from the render it
   * belongs to. A ref would be read after the commit, by which time a blur
   * fired by the browser's own tidying may already have cleared it — and
   * whether that blur fires at all is a browser detail this should not rest
   * on. `setHasFocus` with an unchanged value costs nothing; React bails out.
   *
   * Cleared only when focus actually leaves the slot. A null `relatedTarget`
   * means focus went nowhere, which counts as leaving: a programmatic `blur()`
   * or a click on dead space really does end with the slot holding nothing,
   * and treating that as «still ours» is what made an earlier version steal
   * focus on the next resize from a user who had not touched the panel.
   * Measured 2026-09-15.
   */
  const [hasFocus, setHasFocus] = useState(false);

  /**
   * Whether the pointer is holding this slot's separator. A drag that folds
   * the panel goes on until it is let go (issue 80, round 2), so the
   * separator is drawn over the rail for as long as this is true. See
   * PanelSeparator.tsx.
   *
   * Dropped when the window crosses into drawer mode: the separator goes then
   * whatever the pointer is doing, and a drag that never hears its own end
   * would leave one standing on the rail when the window grows back.
   */
  const [resizing, setResizing] = useState(false);
  if (resizing && drawer) setResizing(false);

  /**
   * Changing this slot must not drop the keyboard focus on the floor.
   *
   * Two different ways it happens, and one repair for both:
   *
   *   1. Collapsing hides the content with `hidden`, the browser blurs
   *      whatever was focused inside it, and focus lands on `<body>`. The
   *      slot can be collapsed without the user asking — below
   *      `bothSidebarsMinViewport` only one sidebar may be open, so shrinking
   *      or zooming the window past 1440 collapses one of them. Found by
   *      KA CC reviewing PR #14, measured at 1536 → 1439 with the focus in
   *      the sources panel's search field.
   *   2. The toggle button itself is REPLACED when the slot collapses or
   *      opens: collapsed it is wrapped in a Tooltip, and a wrapper appearing
   *      around an element is a different element to React, so the old button
   *      is unmounted and a new one mounted. The user pressed that button and
   *      the DOM node they were standing on stops existing. Measured
   *      2026-09-15, when the rail wrapped it for the first time.
   *   3. A drag folds the panel and is let go over the rail. The separator
   *      held the focus through the drag and goes when the pointer is let
   *      go, which is a change to `resizing` and not to `collapsed`.
   *
   * Either way the next Tab would start again at the skip link, a whole page
   * away from what the user was doing. WCAG 2.4.3.
   *
   * The repair is the move CONTRIBUTING asks of any control that disappears
   * by its own action: send focus to what the action left behind, which here
   * is the toggle button in its new state.
   *
   * This sits in the slot rather than in the provider on purpose. The provider
   * knows WHY a panel closed; only the slot knows whether it was holding the
   * focus, and that is the only question the repair turns on. Written this way
   * it covers every route into a collapse, including ones nobody has built
   * yet, rather than the one route review happened to find.
   */
  useLayoutEffect(() => {
    if (!hasFocus) return;

    // Four readings of the same thing — the focus this slot had is gone — and
    // which one is true depends on how far the browser has got.
    //
    //   null / body     focus is nowhere, the usual end state
    //   not connected   the replaced button: some browsers keep reporting a
    //                   detached node as active
    //   inside hidden   the browser has not recalculated style yet, so focus
    //                   is still sitting on an element that is now display:
    //                   none. This one is not belt and braces: a layout
    //                   effect runs before that recalculation, and without
    //                   this clause the repair measured BODY a moment too
    //                   late and did nothing. 2026-09-15.
    //
    // The last clause asks about the CONTENT, not the whole slot, and is
    // gated on `collapsed`. Asking about the slot would also be true of a
    // panel the user had simply tabbed into, and this effect now runs on
    // focus changes as well as on collapse.
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      !active.isConnected ||
      (state.collapsed && (content.current?.contains(active) ?? false));
    if (!lost) return;

    toggle.current?.focus();
  }, [hasFocus, state.collapsed, resizing]);

  /*
   * «Vis kilder» / «Skjul kilder», «Vis tråder og filter» / «Skjul tråder og
   * filter». Derived from the slot's own name so a moved view takes its
   * wording with it, rather than from a hardcoded string per slot.
   *
   * No count of what the panel holds, on the rail or in the name. The badge
   * that said how many documents stood behind a collapsed sources panel came
   * off on issue 87: a number on the button reads as a notification,
   * and nothing behind it is waiting to be dealt with. The retrieval step in
   * the answer still says «N treff i M dokumenter».
   *
   * One string for both the accessible name and the tooltip, which is not
   * tidiness: @digdir/designsystemet-web writes `data-tooltip` into
   * `aria-label` on an element with no text of its own, so a tooltip saying
   * something shorter would quietly replace the name a moment after render.
   */
  const toggleLabel = `${state.collapsed ? 'Vis' : 'Skjul'} ${(label ?? views[state.activeView].label).toLocaleLowerCase('nb-NO')}`;

  /**
   * Whether what stands on the ROW here is a rail.
   *
   * True when the panel is collapsed, and true in drawer mode whether the
   * drawer is open or not — an open drawer is drawn over the answer column and
   * leaves a rail behind.
   *
   * This is the question every DRAWN thing beside the panel turns on: the
   * separator, and how the toggle button itself is drawn.
   * `state.collapsed` is a different question — whether the panel is OPEN —
   * and it is the one `aria-expanded` and the «Vis»/«Skjul» wording answer.
   * The two were the same thing until drawer mode, and telling them apart is
   * most of what this file had to learn.
   *
   * Measured the day they were confused: with the sources drawer open at
   * 1024, the button in its 67 px rail was still drawn with its full text,
   * came out 100 px wide, and pushed the page 46 px past the window — a
   * horizontal scrollbar from the very rule that was meant to remove one.
   */
  const railed = state.collapsed || drawer;

  /*
   * «Skjul» on screen before the icon, in the navigation panel while it is
   * open, and the button at the end of the row (decided 06.10).
   *
   * The word and not the whole name. «Skjul tråder og filter» is 209 px, and
   * beside «Tråder» it pushed the row past the panel (KA CC on #119). The word
   * is how the name starts, so what a sighted reader sees is what a voice
   * user says (WCAG 2.5.3), and a screen reader user hears the same name as
   * before, drawn or not.
   *
   * Not on a rail, which is one button wide. Not in the sources panel either:
   * its button already stood at the edge towards the answer column, which is
   * where this one moves to, so the two heads mirror each other and differ
   * only by the word.
   */
  const showsWord = slot === 'primary-sidebar' && !railed;
  /** The button stands at the panel's edge towards the answer column. */
  const toggleLast = slot === 'primary-sidebar';

  /*
   * The foot of the navigation panel: the pages about Kunnskapsassistenten
   * and the app's own settings (issue 85). What is in it is
   * SidebarFooter's business.
   *
   * The slot's and not a view's, so it stays put when the panel switches
   * between «Tråder» and «Filtrering». The first slot and not the other,
   * because it is the one open by default on a desktop, and the one a phone
   * opens as a drawer to steer from. Not on a rail: three choices do not fit
   * in 67 px, and a rail is one button (railWidth).
   *
   * At the end of the scrolling region by default, or pinned below it when
   * that is chosen in #innstillinger; see `footScrolls` just below.
   */
  const foot = slot === 'primary-sidebar' ? <SidebarFooter /> : null;

  /*
   * At the end of the scrolling region and scrolling with the list, or pinned
   * below it (digdir/kunnskapsassistenten#123). A setting rather than a
   * rewrite, so both can be compared on the same page; see footerMode.ts.
   * Scrolling is the default (chosen 06.10).
   *
   * One DEFINITION for both places, so the two cannot drift apart. Not one
   * mounting: React gives a new parent a new mount, so switching tears the
   * foot down and builds it again. Measured by KA CC on #231 — a selection
   * inside the first link is gone after the switch.
   *
   * Nothing is lost by that today, because the switch happens inside a modal
   * dialog and the focus cannot be in the foot while it does. The day the
   * choice moves somewhere the foot is reachable from, that stops being true.
   */
  const footerMode = useFooterMode();
  const footScrolls = footerMode === 'scrolls' && foot !== null;

  /**
   * Everything below the head: the view head box and the view itself.
   *
   * One definition for both places it can be drawn — in the panel on the row,
   * or inside the drawer — so the view is the same element in both and keeps
   * its state when the window crosses the breakpoint.
   *
   * `hidden` only matters on the row. Inside a drawer the `<dialog>` is what
   * shows and hides it, and a closed one is `display: none` already.
   */
  const panelContent = (
    <div
      id={contentId}
      ref={setContent}
      hidden={(state.collapsed && !drawer) || undefined}
      className={focusable ? 'sidebar-content ds-focus--inset' : 'sidebar-content'}
      role={focusable ? 'group' : undefined}
      aria-label={focusable ? label : undefined}
      tabIndex={focusable ? 0 : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setHoldsFocus(true);
      }}
      onBlur={(event) => {
        if (event.target === event.currentTarget) setHoldsFocus(false);
      }}
    >
      {/*
        The view head, and it is FIRST in the scrolling region on purpose.

        A pinned head covers whatever is above it in the same scrolling
        box, and «above» includes the tab order: the browser scrolls a
        focused control into view at the top of the region, which is
        precisely where the head is. That is what #55 measured — a head
        pinned under the «Tråder» button took the clicks meant for it —
        and it is why the place is the shell's rather than each view's.
        Put the head first and there is nothing above it to cover; a view
        that wants its own button to stay put puts the button IN the head.

        Empty until a view fills it, and an empty head draws no line.
      */}
      <div className="view-head" ref={viewHeadRef} />

      <ViewHeadContext value={viewHead}>
        <PanelHeadContext value={panelHead}>
          <ActiveView
            view={state.activeView}
            collapsed={state.collapsed}
            onCollapsedChange={(collapsed) => setCollapsed(slot, collapsed)}
            activeCitationNumber={activeCitation?.number}
            activeCitationNonce={activeCitation?.nonce}
            siblingViews={state.views.filter((id) => id !== state.activeView)}
            onShowView={(view) => setActiveView(slot, view)}
            switchedByUser={isSwitchedByUser(slot)}
          />
        </PanelHeadContext>
      </ViewHeadContext>

      {/* Last in the scrolling region, so it follows the list down. */}
      {footScrolls ? foot : null}
    </div>
  );

  const toggleButton = (
    <Button
      ref={toggle}
      variant="tertiary"
      data-color="neutral"
      data-size="sm"
      /*
        The name is in `aria-label`, in every state, and the tooltip says the
        same string on hover and on focus. What is drawn is the icon, and in
        the open navigation panel also «Skjul» (see `showsWord`).

        The whole name was drawn beside the icon once, and came off on #119:
        «Skjul tråder og filter» (209 px) beside «Tråder» (123) and the two
        width buttons (88) is 420 px in a 400 px panel, and what fell off the
        end was the width buttons — a control the pointer could no longer reach
        at all. Measured by KA CC. The width buttons have since gone (#202),
        and the one word fits.
      */
      icon={!showsWord}
      className={showsWord ? 'sidebar-hide' : undefined}
      aria-label={toggleLabel}
      aria-expanded={!state.collapsed}
      aria-controls={contentId}
      onClick={() => toggleCollapsed(slot)}
    >
      {showsWord ? 'Skjul' : null}
      <Icon aria-hidden />
    </Button>
  );

  /*
   * One tooltip for the rail and the open panel, with the string the
   * button's `aria-label` has. @digdir/designsystemet-web writes
   * `data-tooltip` into `aria-label` on an element with no text of its
   * own, so the two have to agree — and they do, both `toggleLabel`.
   *
   * On an element WITH text, which «Skjul» makes this one, it would instead
   * remove `aria-label` and write the tooltip as `aria-description`, and a
   * screen reader would hear «Skjul» and then the whole string again. It
   * only writes when the tooltip differs from the `aria-label` already
   * there (`tooltip.js`), so the agreement is what keeps the name. Measured
   * 06.10 at 1440: `aria-label` stays, no `aria-description`.
   *
   * One element, not one per state, so the button is the same element
   * to React when the panel collapses under the user's focus.
   *
   * Placement, measured 2026-09-28 at 1440 and 1920: there is no room
   * above the button in an open panel, so `top` flips below it, over
   * whatever the view starts with. In the sources panel that was the
   * label «Søk i kildene». Further along the row there is nothing, and
   * a box placed there covers nothing. The navigation panel's button
   * ends its row: before it is «Tråder», below it «Filtrering», and
   * after it the separator and the answer column. It keeps `top`.
   *
   * The sources rail puts it before the button, towards the answer
   * column, and not on top. The box is placed once, when it appears,
   * and then stays put: measured 30.09, it did not follow the button
   * when the panel opened, not even after a resize event. Opening the
   * panel from the keyboard changes the text under a box that is still
   * showing, from «Vis kilder» to the longer «Skjul kilder», and a box
   * placed on top of a rail at the window's edge grew from its start
   * edge out past the end of the window: 1190–1289 at 1280 × 720, and
   * the page scrolled 9 px sideways until the focus moved (KA CC on
   * #224). Placed before the button, it ends where the button starts,
   * and the 14 px it grows stay inside the window: 1139–1238 at 1280,
   * with no sideways scroll at 1280, 1440 or 1512. The navigation rail
   * keeps `top`: its box starts at the window's own start edge and
   * grows away from it.
   */
  const toggleWithTooltip = (
    <Tooltip
      content={toggleLabel}
      placement={slot === 'secondary-sidebar' ? (railed ? 'left' : 'right') : 'top'}
    >
      {toggleButton}
    </Tooltip>
  );

  return (
    <Element
      ref={element}
      aria-label={label}
      className={slot}
      /*
        A drawer leaves a rail behind on the row, so the landmark is drawn as
        one whether the drawer is open or shut. `data-collapsed` is about what
        stands HERE; `aria-expanded` on the button below is still about
        whether the panel is open, and in drawer mode those stop being the
        same question.
      */
      data-collapsed={state.collapsed || drawer || undefined}
      data-drawer={drawer || undefined}
      /*
        React's focusin and focusout, which bubble, so this pair answers «does
        the focus sit anywhere inside me». Here to observe, not to handle an
        interaction: nothing about this landmark is clickable and no keyboard
        handler belongs on it.
      */
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!element.current?.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      {/*
        Designsystemet's Tooltip renders no box of its own: it sets
        `data-tooltip` on its child, and the custom element in
        @digdir/designsystemet-web draws it. See
        design/designsystemet/komponenter/tooltip.md.

        That package ALSO reads `data-tooltip` into an accessible name — it
        writes `aria-label` when the element has no text and `aria-description`
        when it has (`tooltip.ts:83-84`), so a collapsed rail button would get
        its name from the tooltip whether or not we set one.

        The explicit `aria-label` on the button stays anyway, and not as belt
        and braces: it is the name from first render, while the web package's
        MutationObserver only gets there a tick later, and it is the name even
        if that package never loads — it is an indirect dependency, pulled in
        by whichever Designsystemet component happens to import it. Both
        strings are the same, so the two never disagree.
      */}
      {/*
        The panel head does not scroll; the content under it does.

        Without that, the toggle button rides the panel's own scrolling. Click
        a `[n]` marker and the sources panel scrolls 987 px to the excerpt at
        1440, taking «Skjul kilder» to y = −955 — a screen above the top of the
        window — so the panel has no visible way to close itself and the user
        has to scroll back up to find out where it went. The navigation panel
        does the same at 991 px of content in a 900 px window. Finding 2 in
        docs/review/brukerblikk-2026-09-15.md.
      */}
      {/*
        The panel's own box. It carries the surface, the border, the padding
        and the clipping; the landmark around it carries the width and the
        separator.

        The separator has to be inside the landmark — content outside every
        landmark is an axe `region` violation, and a control a reader can
        reach is content (KA CC, measured on four routes after #50). It cannot
        be inside THIS box: `overflow: hidden` would cut its focus ring off,
        and the scrolling region below it puts a scrollbar exactly where the
        grip goes. So the landmark holds both, and this element is what makes
        that possible.
      */}
      {/*
        The rail head. In drawer mode this is ALL that stands on the row: the
        panel itself is drawn over the answer column, and what is left here is
        the button that opens it.
      */}
      <div className="panel">
        <div className="sidebar-header">
          {toggleLast ? null : toggleWithTooltip}
          {/*
            What the view wants on the panel's own row, beside the collapse
            button. Empty until a view fills it, and an empty slot draws
            nothing — `:empty` in global.css, so the row is exactly what it
            was before this existed.

            Not drawn on a rail: a rail is one button wide, and a second
            control there would have nowhere to go. In drawer mode this row IS
            a rail, and the place is inside the drawer instead — one box at a
            time, which is why one ref serves both. See panelHeadContext.ts.
          */}
          {railed ? null : <div className="panel-head-slot" ref={panelHeadRef} />}
          {/*
            Three places and not a reordered pair, so each child keeps its
            position for the slot's whole life and the button stays the same
            element when the panel collapses under the user's focus.
          */}
          {toggleLast ? toggleWithTooltip : null}
        </div>

        {drawer ? null : panelContent}
        {railed || footScrolls ? null : foot}
      </div>

      {/*
        The drawer, below 1139, where an open panel no longer fits beside the
        answer column.

        Designsystemet's own `Dialog` with `placement` set to the edge this
        slot stands at — the component has a drawer mode, checked against the
        1.21.0 export list and written up in
        design/designsystemet/behov-til-komponent.md. `modal` is its default,
        so this is a native `showModal()`: the browser traps the focus, makes
        everything outside it `inert`, answers Escape, and returns the focus
        to whatever opened it — the rail button. Four of the things this had
        to do, none of them ours to write. WCAG 2.4.3.

        `onClose` fires only when the USER closed it — Escape or the close
        button — and not when React closed it by setting `open` to false. So
        this is the one direction that has to be told back to the provider,
        and it cannot loop: the state it sets is the state the dialog is
        already in.

        Rendered whether open or shut, and a shut `<dialog>` is `display:
        none`, so nothing inside it is reachable or in the accessibility tree.
        It stays mounted so the view inside keeps its state across an open and
        a close.
      */}
      {drawer ? (
        <Dialog
          aria-label={label}
          className="drawer"
          closeButton={`Lukk ${(label ?? '').toLocaleLowerCase('nb-NO')}`}
          data-slot={slot}
          onClose={() => setCollapsed(slot, true)}
          open={!state.collapsed}
          placement={drawerPlacement(slot)}
        >
          <div className="panel">
            {/*
              The panel head row inside the drawer. A drawer is the whole
              panel, not a rail — the view is drawn in here, so the place it
              writes into has to be in here too. Without this the «Tråder»
              button simply vanished below 1139, which is where the reader
              needs it most: the thread list is the way back out of a filter.
              Found by KA CC on #116.

              No collapse button beside it: the drawer has Designsystemet's
              own close button, and two controls that both shut the panel
              would be one too many. So this row holds the slot alone.
            */}
            <div className="sidebar-header">
              <div className="panel-head-slot" ref={panelHeadRef} />
            </div>
            {panelContent}
            {footScrolls ? null : foot}
          </div>
        </Dialog>
      ) : null}

      {/*
        The edge this panel shares with the answer column. One per OPEN panel:
        a rail has a fixed width and nothing to drag, and a tab stop that
        cannot do anything is a tab stop in the way.

        An open panel is not on its own enough — the separator drops itself
        when the WINDOW has no room to give either, which is the state at
        1440 with both sidebars open. That test needs the width range, so it
        lives in the component rather than here. See PanelSeparator.tsx.

        A drawer has no edge to share: it lies over the answer column rather
        than beside it, and there is nothing between them to move.

        Inside the landmark, beside the panel box rather than in it. What it
        resizes is this slot, so this is where it belongs — and it is also
        what the `region` rule asks: a control outside every landmark is
        content nobody can navigate to by landmark.

        And over the rail while a drag that folded the panel is still held,
        so the drag can open it again (issue 80, round 2).
      */}
      {railed && !resizing ? null : <PanelSeparator slot={slot} onDraggingChange={setResizing} />}
    </Element>
  );
}
