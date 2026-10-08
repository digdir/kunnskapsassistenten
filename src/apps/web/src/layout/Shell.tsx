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
import { useCompactMode } from './useCompactMode';
import { useDrawerMode } from './useDrawerMode';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { ViewHeadContext, type ViewHeadContextValue } from './viewHeadContext';
import { viewComponents } from './viewComponents';
import './stackedView.css';
import {
  drawerPlacement,
  layoutStyle,
  slotLabel,
  views,
  type SlotViewProps,
  type ViewId,
} from './viewModel';

export type ShellProps = {
  /** The route draws main itself and the slot's view stands down; see NotFound.tsx. */
  routeOwnsMain?: boolean;
};

/**
 * The shell: three slots on one row, named after position, never after a
 * side or content, because a view and its accessible name (slotLabel()) can
 * move between slots. Widths arrive as CSS custom properties; see viewModel.ts.
 */
export function Shell({ routeOwnsMain = false }: ShellProps) {
  const { layout } = useLayout();
  // A panel dragged wider than the window is drawn at what fits (`fittedWidths`).
  const viewport = useViewportWidth();
  // Asked once here and handed down, rather than one media query per slot.
  const drawer = useDrawerMode();
  const compact = useCompactMode();
  // The main slot owns the scroll, so the element is handed to the views
  // rather than looked up from inside them.
  const mainScroll = useRef<HTMLElement | null>(null);

  // A tab stop when nothing inside can take the keyboard (WCAG 2.1.1). No
  // `role` or `aria-label`, unlike the sidebars: `main` is already named.
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

  // Nothing will report sources on this page, and the panel would otherwise
  // draw skeletons for an answer that is not coming.
  useNoAnswers(routeOwnsMain);

  // Held per shell, not in `LayoutProvider`: the two layout routes mount
  // separate shells, and a shared count would carry a compose field over.
  const composerPresence = useComposerRegistry();

  // Per shell for the same reason; see openThreadContext.ts.
  const openThread = useOpenThreadRegistry();

  // Held here because the box is drawn inside `<main>` and the provider has to
  // wrap what comes after it.
  const [mainHead, mainHeadRef] = useViewHeadBox(mainScroll);

  return (
    <MainScrollContext value={mainScroll}>
      <SkipLink href="#main-content">Hopp til hovedinnhold</SkipLink>
      {/* The compose field is many tab stops down; linked only while one is mounted. */}
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
            data-compact={compact || undefined}
            style={layoutStyle(layout, viewport, drawer, compact)}
          >
            <Sidebar slot="primary-sidebar" element="nav" drawer={drawer} />

            {/* The focus pair below only observes; nothing here is clickable. */}
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <main
              id="main-content"
              className={mainFocusable ? 'main ds-focus--inset' : 'main'}
              ref={setMain}
              // Only while the region cannot be scrolled any other way.
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={mainFocusable ? 0 : undefined}
              // Kept a stop while it holds the focus, or the focus falls to
              // `<body>`, above the skip link (WCAG 2.4.3).
              onFocus={(event) => {
                if (event.target === event.currentTarget) setMainHoldsFocus(true);
              }}
              onBlur={(event) => {
                if (event.target === event.currentTarget) setMainHoldsFocus(false);
              }}
            >
              {/* Inside the scroller, so the wheel works anywhere between the panels. */}
              <div className="main-column">
                {/* First in the region, so nothing reachable ends up under it once pinned. */}
                <div className="view-head" ref={mainHeadRef} />

                {/* The route adds only the h1; the view is looked up, so chat can move too. */}
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

// A box the shell offers and a view fills. State, not a ref: the view must
// render again once the box exists, which costs a render, not a frame.
function useHeadBox(): [HTMLElement | null, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return [element, setElement];
}

// The shell's end of the view head. Why the shell holds it: viewHeadContext.ts.
function useViewHeadBox(
  scroller: RefObject<HTMLElement | null>,
): [ViewHeadContextValue, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useHeadBox();
  const value = useMemo(() => ({ element }), [element]);

  // Scroll padding as tall as the head, or scrolling into view and focus land
  // under it (WCAG 2.4.11). Observed, because the head changes with the view.
  useEffect(() => {
    const region = scroller.current;
    if (element === null || region === null) return;
    // jsdom has no ResizeObserver, and nothing there scrolls or paints.
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

// Per slot, not per view: the glyph shows which edge the panel sits at.
const slotIcons = {
  'primary-sidebar': PrimarySidebarIcon,
  'secondary-sidebar': SecondarySidebarIcon,
} as const;

/** The view in the main slot. No collapse button: that would leave a blank page. */
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

// One view of a stacked slot, with its own pinned head (a shared one would pin
// both titles at once). The slot sets `scroll-padding` from the height reported.
function StackedView({
  id,
  onHeadHeight,
  ...props
}: Omit<SlotViewProps, 'view'> & {
  id: ViewId;
  onHeadHeight: (id: ViewId, height: number) => void;
}) {
  const [element, setElement] = useHeadBox();
  const head = useMemo(() => ({ element }), [element]);
  const View = viewComponents[id];

  useEffect(() => {
    // jsdom has no ResizeObserver, and nothing there scrolls or paints.
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => onHeadHeight(id, element.offsetHeight));
    observer.observe(element);
    return () => {
      observer.disconnect();
      onHeadHeight(id, 0);
    };
  }, [element, id, onHeadHeight]);

  return (
    <div className="stacked-view" data-view={id}>
      <div className="view-head" ref={setElement} />
      <ViewHeadContext value={head}>
        <View view={id} {...props} />
      </ViewHeadContext>
    </div>
  );
}

// One sidebar slot. Collapsed content stays in the DOM (`hidden`), so the
// button's `aria-controls` always resolves.
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

  // A tab stop only when the region scrolls with no control in it (WCAG 2.1.1),
  // kept while focused (2.4.3). A group, not a region: the slot is already a
  // landmark with this name. Inset ring, because the panel clips.
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

  // Outside `ActiveView`, so switching views keeps the box in place.
  const [viewHead, viewHeadRef] = useViewHeadBox(content);

  // Plain box state: the panel head neither pins nor scrolls.
  const [panelHeadElement, panelHeadRef] = useHeadBox();
  const panelHead = useMemo(() => ({ element: panelHeadElement }), [panelHeadElement]);

  // One scrolling region for several pinned heads: pad for the tallest, so
  // focus is never hidden under any of them (WCAG 2.4.11).
  const headHeights = useRef<Partial<Record<ViewId, number>>>({});
  const setHeadHeight = useCallback((id: ViewId, height: number) => {
    headHeights.current[id] = height;
    const region = content.current;
    if (!region) return;
    const tallest = Math.max(0, ...Object.values(headHeights.current).map((h) => h ?? 0));
    region.style.scrollPaddingBlockStart = tallest > 0 ? `${Math.round(tallest)}px` : '';
  }, []);

  // State, not a ref: the repair below needs the value from BEFORE the change.
  // A null `relatedTarget` counts as leaving, or a resize would steal focus.
  const [hasFocus, setHasFocus] = useState(false);

  // A drag that folds the panel goes on until let go, so the separator stays
  // over the rail meanwhile. Dropped in drawer mode, where the separator goes
  // and would never hear the drag end.
  const [resizing, setResizing] = useState(false);
  if (resizing && drawer) setResizing(false);

  // Don't drop the focus on `<body>` (WCAG 2.4.3) when this slot collapses, the
  // toggle button remounts or the dragged separator goes; send it to the toggle.
  // In the slot, since only the slot knows whether it held the focus.
  useLayoutEffect(() => {
    if (!hasFocus) return;

    // Focus is gone if it is nowhere, on a detached node (some browsers keep
    // reporting one), or still in the collapsed content: a layout effect runs
    // before style recalculation moves it to `<body>`.
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      !active.isConnected ||
      (state.collapsed && (content.current?.contains(active) ?? false));
    if (!lost) return;

    toggle.current?.focus();
  }, [hasFocus, state.collapsed, resizing]);

  // From the slot's name, so a moved view keeps its wording. No count: a number
  // reads as a notification (issue 87). Must equal the tooltip, which
  // @digdir/designsystemet-web otherwise writes over `aria-label`.
  const toggleLabel = `${state.collapsed ? 'Vis' : 'Skjul'} ${(label ?? views[state.activeView].label).toLocaleLowerCase('nb-NO')}`;

  // A rail on the ROW (collapsed, or any drawer mode) is not a closed panel;
  // mixing the two draws the full button text in a 67 px rail.
  const railed = state.collapsed || drawer;

  // Only the word: the whole name does not fit beside «Tråder». The name starts
  // with it, so a voice user can say what they see (WCAG 2.5.3).
  const showsWord = slot === 'primary-sidebar' && !railed;
  /** The button stands at the panel's edge towards the answer column. */
  const toggleLast = slot === 'primary-sidebar';

  // The slot's, not a view's, so it stays when the panel switches view. Not on
  // a rail: it does not fit in one button's width.
  const foot = slot === 'primary-sidebar' ? <SidebarFooter /> : null;

  // Warning: switching mode remounts the foot and loses its state, which is
  // harmless only while the switch sits in a modal dialog.
  // See digdir/kunnskapsassistenten#123 and footerMode.ts.
  const footerMode = useFooterMode();
  const footScrolls = footerMode === 'scrolls' && foot !== null;

  // One definition for the row and the drawer, so the view keeps its state
  // across the breakpoint. A closed `<dialog>` hides it without `hidden`.
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
      {/* View head first: a pinned head covers what is above it, focus included. */}
      {state.stacked ? (
        // No switching between stacked views: all are on screen already.
        <PanelHeadContext value={panelHead}>
          {state.views.map((id) => (
            <StackedView
              key={id}
              id={id}
              onHeadHeight={setHeadHeight}
              collapsed={state.collapsed}
              onCollapsedChange={(collapsed) => setCollapsed(slot, collapsed)}
              activeCitationNumber={activeCitation?.number}
              activeCitationNonce={activeCitation?.nonce}
              siblingViews={[]}
              onShowView={(view) => setActiveView(slot, view)}
              switchedByUser={false}
            />
          ))}
        </PanelHeadContext>
      ) : (
        <>
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
        </>
      )}

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

  // Same string as `aria-label`, or @digdir/designsystemet-web rewrites the
  // name. Sources: not `top`, which flips over the view when open and, on the
  // rail at the window's edge, overflows the window when the text grows.
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
      // What stands HERE: a drawer leaves a rail on the row, open or shut.
      data-collapsed={state.collapsed || drawer || undefined}
      data-drawer={drawer || undefined}
      // React's focus events bubble; this only observes whether the focus is
      // inside.
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!element.current?.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      {/* The separator is in the landmark (axe `region`) but outside the clipping box. */}
      <div className="panel">
        {/* Outside the scroller, so the close button never scrolls out of sight. */}
        <div className="sidebar-header">
          {toggleLast ? null : toggleWithTooltip}
          {/* Not on a rail; in drawer mode the box is in the drawer (one ref). */}
          {railed ? null : <div className="panel-head-slot" ref={panelHeadRef} />}
          {/* Three fixed places keep the button the same element across a collapse. */}
          {toggleLast ? toggleWithTooltip : null}
        </div>

        {drawer ? null : panelContent}
        {railed || footScrolls ? null : foot}
      </div>

      {/* A native modal: focus trap, `inert`, Escape and focus return. `onClose`
        fires only when the USER closes it, so it cannot loop. Kept mounted so
        the view keeps its state. */}
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
            {/* Panel-head controls (like «Tråder») go here; the dialog has its own close. */}
            <div className="sidebar-header">
              <div className="panel-head-slot" ref={panelHeadRef} />
            </div>
            {panelContent}
            {footScrolls ? null : foot}
          </div>
        </Dialog>
      ) : null}

      {/* Not on a rail (a useless tab stop), except while the drag that folded the
        panel is held, so that drag can reopen it. */}
      {railed && !resizing ? null : <PanelSeparator slot={slot} onDraggingChange={setResizing} />}
    </Element>
  );
}
