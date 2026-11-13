import { Button, Dialog, Heading, SkipLink, Tooltip } from '@digdir/designsystemet-react';
import { SidebarLeftIcon, SidebarRightIcon } from '@navikt/aksel-icons';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { classes } from '../dom.js';
import { useMedia, useScrollPadding, useScrollTabStop, useViewportWidth } from './hooks.js';
import { useT } from './i18n.js';
import {
  breakpoints,
  cardsGap,
  cardsInset,
  cardsRail,
  clampWidth,
  defaultCollapsed,
  defaultGap,
  defaultMainSize,
  defaultPanelSizes,
  defaultRail,
  drawerPlacement,
  fittedWidths,
  growthDirection,
  initialState,
  layoutStyle,
  narrowerThan,
  otherSide,
  shellSides,
  storedLayout,
  widthRange,
  withChosen,
  withCollapsed,
  withDismissed,
  withOneOpen,
  withWidth,
  withWindowFold,
  withWindowRoom,
  yieldingSide,
  type ShellGeometry,
  type ShellLayout,
  type ShellMainSize,
  type ShellPanelSize,
  type ShellSide,
  type ShellState,
} from './layout.js';
import { Separator } from './Separator.js';

export interface ShellPanel {
  /** The panel's name after what is in it, «Tråder og filter»: the landmark's and its buttons'. */
  label: string;
  /**
   * The panel's visible title, an `h2` on its head row, «Tråder» or «Verktøy». Every title the
   * shell draws looks alike and stands on one line with the main column's (`mainTitle`).
   */
  title?: string | undefined;
  /** What the panel holds. It scrolls; the head and a pinned foot stay put. */
  children?: ReactNode;
  /** Controls that belong to the panel, on its head row beside «Skjul». Not on a rail. */
  head?: ReactNode;
  /** Pinned to the top of the panel's scrolling region, such as the view's heading. */
  pinned?: ReactNode;
  /** Hands the host the pinned region's element, `null` when it goes; pass a stable function. */
  pinnedRef?: ((element: HTMLDivElement | null) => void) | undefined;
  /** The panel's foot, such as its links. Not on a rail. */
  foot?: ReactNode;
  /** Keep the foot at the panel's bottom instead of at the end of what scrolls. */
  footPinned?: boolean | undefined;
  /** What the folded panel shows at its bottom, such as the reader's avatar. Not in the top row. */
  railFoot?: ReactNode;
  /**
   * What the folded panel shows under its button, such as «Ny tråd» (dev-navbar), on a drawer's
   * rail as well. Not in the top row.
   */
  rail?: ReactNode;
  /** The design's width, the floor and the ceiling, in CSS pixels. */
  size?: Partial<ShellPanelSize> | undefined;
  /** Folded when the page opens, until the reader chooses. Primary open, secondary folded. */
  defaultCollapsed?: boolean | undefined;
  /** The landmark: `nav` for the primary panel and `aside` for the secondary one by default. */
  landmark?: 'nav' | 'aside' | undefined;
  /**
   * A second column in the panel's card, towards the main column, with a title of its own and the
   * panel's button: the design's filter beside the threads (dev-filter-panel). It folds with the
   * panel, and stands under the panel's own column in a drawer.
   */
  companion?: ShellCompanion | undefined;
}

/** The second column of a panel (`ShellPanel.companion`). */
export interface ShellCompanion {
  /** Its region's name, «Filter for tråden». */
  label: string;
  /** Its title, alike the panel's, «Filter». */
  title?: string | undefined;
  /** A line under the title, «Gjelder neste spørsmål». */
  subtitle?: ReactNode;
  /** What it holds. It scrolls on its own. */
  children?: ReactNode;
  /**
   * Its width when the panel has its design width, in CSS pixels. The panel's `size` counts both
   * columns; the panel's own column keeps the rest, and a narrower panel narrows the companion.
   */
  width: number;
  /** Keeps `width` whatever the panel's width, so the panel's own column takes every change. */
  keepWidth?: boolean | undefined;
}

/** Something the host asks of a panel, once per object: `open`, `offer` or `close-drawers`. */
export type ShellRequest =
  { action: 'open' | 'offer'; side: ShellSide } | { action: 'close-drawers' };

export interface ShellProps {
  /** The panel before the main column. Left out, there is none. */
  primary?: ShellPanel | undefined;
  /** The panel after the main column. Left out, there is none. */
  secondary?: ShellPanel | undefined;
  /** The main column. */
  children?: ReactNode;
  /** Pinned to the top of the main column while it scrolls. */
  mainPinned?: ReactNode;
  /**
   * The page's `h1`, at the top of the main column with a line under it and always in sight, such
   * as the thread's title. It looks like the panels' titles and stands on one line with them.
   */
  mainTitle?: string | undefined;
  /**
   * `flush`, the default: the panels meet the window's edges and the main column, divided by lines.
   * `cards`: each panel and the main column is a card on the page's ground, `inset` from the
   * window and `gap` apart, a rail too (the design's dev-navbar board).
   */
  frame?: 'flush' | 'cards' | undefined;
  /** The cards frame's margin from the window in CSS pixels, 16. Must match `--genai-shell-inset`. */
  inset?: number | undefined;
  /** The main column's floor and reading width, 640 and 800 by default. */
  mainSize?: Partial<ShellMainSize> | undefined;
  /** The `id` of `<main>`, the target of «Hopp til hovedinnhold». */
  mainId?: string | undefined;
  /** The layout to start from, as stored from `onLayoutChange`. Read once. */
  initialLayout?: ShellLayout | undefined;
  /** The reader changed the layout. The host stores it, and passes it back as `initialLayout`. */
  onLayoutChange?: ((layout: ShellLayout) => void) | undefined;
  request?: ShellRequest | undefined;
  /** Below 774 by default the rails stand in a row above the main column; `false` keeps them. */
  compactBar?: boolean | undefined;
  /** More skip links, after «Hopp til hovedinnhold». */
  skipLinks?: ReactNode;
  /** The gap beside an open panel in CSS pixels, 32, or 12 for cards. Must match `--genai-shell-gap`. */
  gap?: number | undefined;
  /** A folded panel's width in CSS pixels, 67, or 76 for cards. Must match its button and padding. */
  rail?: number | undefined;
  /** Designsystemet's `data-color` for the shell, set only when given. */
  color?: string | undefined;
  className?: string | undefined;
}

const colored = (color: string | undefined) => (color ? { 'data-color': color } : {});

const sized = (side: ShellSide, size: Partial<ShellPanelSize> | undefined) => ({
  width: size?.width ?? defaultPanelSizes[side].width,
  minWidth: size?.minWidth ?? defaultPanelSizes[side].minWidth,
  maxWidth: size?.maxWidth ?? defaultPanelSizes[side].maxWidth,
});

/** Three columns: a primary panel, the main column and a secondary panel, as in VS Code. */
export const Shell = ({
  primary,
  secondary,
  children,
  mainPinned,
  mainTitle,
  mainSize,
  mainId = 'main-content',
  initialLayout,
  onLayoutChange,
  request,
  compactBar = true,
  skipLinks,
  frame = 'flush',
  inset: givenInset,
  gap: givenGap,
  rail: givenRail,
  color,
  className,
}: ShellProps) => {
  const t = useT();
  const cards = frame === 'cards';
  const inset = cards ? (givenInset ?? cardsInset) : 0;
  const gap = givenGap ?? (cards ? cardsGap : defaultGap);
  const rail = givenRail ?? (cards ? cardsRail : defaultRail);
  const p = primary ? sized('primary', primary.size) : undefined;
  const s = secondary ? sized('secondary', secondary.size) : undefined;
  const mainMin = mainSize?.minWidth ?? defaultMainSize.minWidth;
  const mainMax = mainSize?.maxWidth ?? defaultMainSize.maxWidth;
  const geometry = useMemo<ShellGeometry>(
    () => ({
      panels: { ...(p ? { primary: p } : {}), ...(s ? { secondary: s } : {}) },
      main: { minWidth: mainMin, maxWidth: mainMax },
      gap,
      rail,
      ...(cards ? { inset, railGap: true } : {}),
    }),
    // The numbers, not the objects, which are new on every render.
    [
      p?.width,
      p?.minWidth,
      p?.maxWidth,
      s?.width,
      s?.minWidth,
      s?.maxWidth,
      mainMin,
      mainMax,
      gap,
      rail,
      cards,
      inset,
    ],
  );
  const points = breakpoints(geometry);

  const viewport = useViewportWidth();
  const narrow = useMedia(narrowerThan(points.both));
  const drawer = useMedia(narrowerThan(points.drawer));
  const compact = useMedia(narrowerThan(points.compact)) && compactBar;
  // In the top row the cards frame has no margins: the row and the main column take the window.
  const sums = useMemo(() => (compact ? { ...geometry, inset: 0 } : geometry), [compact, geometry]);

  const [state, setState] = useState<ShellState>(() =>
    initialState(
      geometry,
      {
        primary: primary?.defaultCollapsed ?? defaultCollapsed.primary,
        secondary: secondary?.defaultCollapsed ?? defaultCollapsed.secondary,
      },
      initialLayout,
    ),
  );

  // Open or fold a panel; where both do not fit, the one being opened wins.
  const fitted = (current: ShellState, side: ShellSide, collapsed: boolean) => {
    const next = withCollapsed(current, side, collapsed);
    return collapsed || !narrow ? next : withOneOpen(next, side);
  };
  // What the reader does by hand also says whether they shut the panel themselves.
  const byReader = (side: ShellSide, collapsed: (current: ShellState) => boolean) =>
    setState((current) => {
      const value = collapsed(current);
      return withChosen(withDismissed(fitted(current, side, value), side, value), side);
    });

  // The panel that stays where only one fits; the other yields.
  const keep = otherSide(yieldingSide(geometry));

  // Too narrow for both: the yielding panel folds on the crossing, during render. Growing back
  // opens again what the window folded, unless the reader chose for it meanwhile.
  const [appliedNarrow, setAppliedNarrow] = useState(false);
  if (narrow !== appliedNarrow) {
    setAppliedNarrow(narrow);
    setState((current) => {
      if (!narrow) return shellSides.reduce(withWindowRoom, current);
      return current.collapsed[keep] ? current : withWindowFold(current, otherSide(keep));
    });
  }

  // Entering drawer mode folds both, since a drawer is modal; leaving it opens again what it
  // folded, as far as the window has room: where only one fits, the one that does not yield.
  const [appliedDrawer, setAppliedDrawer] = useState(false);
  if (drawer !== appliedDrawer) {
    setAppliedDrawer(drawer);
    setState((current) => {
      if (drawer) return shellSides.reduce(withWindowFold, current);
      if (!narrow) return shellSides.reduce(withWindowRoom, current);
      // A drawer the reader left open keeps the one place; the other waits for a wider window.
      if (!current.collapsed[otherSide(keep)]) return current;
      const kept = withWindowRoom(current, keep);
      return kept.collapsed[keep] ? withWindowRoom(kept, otherSide(keep)) : kept;
    });
  }

  // The host's request, once per object, also one given on the first render.
  const [seenRequest, setSeenRequest] = useState<ShellRequest | undefined>(undefined);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (request?.action === 'open') {
      const { side } = request;
      setState((current) =>
        withChosen(withDismissed(fitted(current, side, false), side, false), side),
      );
    } else if (request?.action === 'offer') {
      const { side } = request;
      setState((current) => {
        // Never as a drawer, never over the reader's choice, never at the other panel's cost.
        const room = !narrow || current.collapsed[otherSide(side)];
        if (!current.collapsed[side] || current.dismissed[side] || drawer || !room) return current;
        return withChosen(fitted(current, side, false), side);
      });
    } else if (request?.action === 'close-drawers' && drawer) {
      setState((current) =>
        shellSides.reduce(
          (next, side) =>
            next.collapsed[side]
              ? next
              : withDismissed(withCollapsed(next, side, true), side, true),
          current,
        ),
      );
    }
  }

  // Reported once per commit from an effect, not on mount unless a rule changed the layout.
  const stored = storedLayout(geometry, state);
  const storedKey = JSON.stringify(stored);
  const [mountedKey] = useState(storedKey);
  const reported = useRef(mountedKey);
  const report = useRef(onLayoutChange);
  useEffect(() => {
    report.current = onLayoutChange;
  });
  useEffect(() => {
    if (storedKey === reported.current) return;
    reported.current = storedKey;
    report.current?.(stored);
    // `stored` is new on every render; its key says when it changed.
  }, [storedKey]);

  // `main` scrolls and fills the field between the panels, so the wheel works in the margins.
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);
  const [mainHead, setMainHead] = useState<HTMLDivElement | null>(null);
  useScrollPadding(mainElement, mainHead);
  // A tab stop while nothing inside takes the keyboard (WCAG 2.1.1), kept while focused.
  const [mainNeedsTabStop, measureMain] = useScrollTabStop();
  const [mainHoldsFocus, setMainHoldsFocus] = useState(false);
  const mainFocusable = mainNeedsTabStop || mainHoldsFocus;
  // Stable, or React would hand the region to a new ref on every render.
  const setMain = useCallback(
    (node: HTMLElement | null) => {
      setMainElement(node);
      measureMain(node);
    },
    [measureMain],
  );

  const sideProps = {
    geometry: sums,
    state,
    viewport,
    drawer,
    cards,
    onToggle: (side: ShellSide) => byReader(side, (current) => !current.collapsed[side]),
    onCollapse: (side: ShellSide, collapsed: boolean) => byReader(side, () => collapsed),
    onWidth: (side: ShellSide, width: number) =>
      setState((current) => withWidth(geometry, current, side, width)),
  };

  // First in the region, so nothing reachable ends up under it once pinned. In the cards frame it
  // spans the main card, its line from edge to edge; flush, it keeps to the reading width.
  const mainHeadRegion = (
    <div className="uib-shell-pinned" ref={setMainHead}>
      {mainTitle ? (
        <Heading className="uib-shell-title" data-size="xs" level={1}>
          {mainTitle}
        </Heading>
      ) : null}
      {mainPinned}
    </div>
  );

  return (
    <>
      <SkipLink href={`#${mainId}`}>{t('shell.skipToMain')}</SkipLink>
      {skipLinks}
      <div
        className={classes('uib-shell', className)}
        data-compact={compact || undefined}
        data-drawer={drawer || undefined}
        data-frame={cards ? 'cards' : undefined}
        style={layoutStyle(sums, state, viewport, drawer, compact) as CSSProperties}
        {...colored(color)}
      >
        {primary ? <Side side="primary" panel={primary} {...sideProps} /> : null}

        <main
          className={classes('uib-shell-main', mainFocusable && 'ds-focus--inset')}
          id={mainId}
          // Observes only whether the focus is on the region itself.
          onBlur={(event) => {
            if (event.target === event.currentTarget) setMainHoldsFocus(false);
          }}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setMainHoldsFocus(true);
          }}
          ref={setMain}
          tabIndex={mainFocusable ? 0 : undefined}
        >
          {cards ? mainHeadRegion : null}
          <div className="uib-shell-column">
            {cards ? null : mainHeadRegion}
            {children}
          </div>
        </main>

        {secondary ? <Side side="secondary" panel={secondary} {...sideProps} /> : null}
      </div>
    </>
  );
};

interface SideProps {
  side: ShellSide;
  panel: ShellPanel;
  geometry: ShellGeometry;
  state: ShellState;
  viewport: number;
  /** Draw an open panel over the main column rather than beside it. */
  drawer: boolean;
  /** The cards frame: the panel is a card, its button an icon. */
  cards: boolean;
  onToggle: (side: ShellSide) => void;
  onCollapse: (side: ShellSide, collapsed: boolean) => void;
  onWidth: (side: ShellSide, width: number) => void;
}

/** One side panel: a rail when folded, a drawer in a narrow window. */
const Side = ({
  side,
  panel,
  geometry,
  state,
  viewport,
  drawer,
  cards,
  onToggle,
  onCollapse,
  onWidth,
}: SideProps) => {
  const t = useT();
  const collapsed = state.collapsed[side];
  const name = panel.label.toLocaleLowerCase(t.locale === 'nb' ? 'nb-NO' : 'en-GB');
  const contentId = useId();
  const { companion } = panel;
  const companionId = useId();
  const Landmark = panel.landmark ?? (side === 'primary' ? 'nav' : 'aside');
  const Icon = side === 'primary' ? SidebarLeftIcon : SidebarRightIcon;

  const toggle = useRef<HTMLButtonElement>(null);
  const element = useRef<HTMLElement>(null);
  const [content, setContentElement] = useState<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState<HTMLDivElement | null>(null);
  useScrollPadding(content, pinned, !collapsed);
  const onPinned = panel.pinnedRef;
  useEffect(() => {
    if (!onPinned || !pinned) return;
    onPinned(pinned);
    return () => onPinned(null);
  }, [onPinned, pinned]);

  // A tab stop while nothing in it is reachable, kept while focused; a group, not a region.
  const [needsTabStop, measureContent] = useScrollTabStop();
  const [holdsFocus, setHoldsFocus] = useState(false);
  const focusable = needsTabStop || holdsFocus;
  const setContent = useCallback(
    (node: HTMLDivElement | null) => {
      setContentElement(node);
      measureContent(node);
    },
    [measureContent],
  );

  // Whether focus is in the panel, as state, since the repair below needs the value before.
  const [hasFocus, setHasFocus] = useState(false);

  // A drag that folds the panel goes on until let go; dropped in drawer mode.
  const [resizing, setResizing] = useState(false);
  if (resizing && drawer) setResizing(false);

  // Focus that the folding panel held goes to its button, not `<body>` (WCAG 2.4.3).
  useLayoutEffect(() => {
    if (!hasFocus) return;
    // Lost if nowhere, detached, or in the folded content; this runs before the browser moves it.
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      !active.isConnected ||
      (collapsed && (content?.contains(active) ?? false));
    if (lost) toggle.current?.focus();
  }, [hasFocus, collapsed, resizing, content]);

  // Focus lent to a dialog comes back to the button if the panel folded meanwhile.
  const lentToDialog = useRef(false);
  useEffect(() => {
    const onClose = (event: Event) => {
      const lent = lentToDialog.current;
      lentToDialog.current = false;
      if (!lent) return;
      const active = document.activeElement;
      const lost =
        active === null ||
        active === document.body ||
        !active.isConnected ||
        (event.target instanceof Node && event.target.contains(active));
      if (lost) toggle.current?.focus();
    };
    document.addEventListener('close', onClose, true);
    return () => document.removeEventListener('close', onClose, true);
  }, []);

  // A rail on the row, folded or in drawer mode, is not a shut panel: the button is an icon.
  const railed = collapsed || drawer;
  // Only the word: the whole name does not fit beside the head's controls. A card's title names
  // the panel already, so its button is an icon, as the design draws the secondary one.
  const showsWord = side === 'primary' && !railed && !cards;
  // The button stands at the panel's edge towards the main column.
  const toggleLast = side === 'primary';
  // Must equal the tooltip, which Designsystemet otherwise writes over `aria-label`.
  const toggleLabel = t(collapsed ? 'shell.showPanel' : 'shell.hidePanel', { panel: name });

  const range = widthRange(geometry, state, side, viewport);
  const width = fittedWidths(geometry, state, viewport)[side];

  const footScrolls = !panel.footPinned && panel.foot != null;
  const foot = panel.foot == null ? null : <div className="uib-shell-foot">{panel.foot}</div>;

  // One definition for the row and the drawer. A closed `<dialog>` hides it without `hidden`.
  const panelContent = (
    <div
      aria-label={focusable ? panel.label : undefined}
      className={classes('uib-shell-content', focusable && 'ds-focus--inset')}
      hidden={(collapsed && !drawer) || undefined}
      id={contentId}
      onBlur={(event) => {
        if (event.target === event.currentTarget) setHoldsFocus(false);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) setHoldsFocus(true);
      }}
      ref={setContent}
      role={focusable ? 'group' : undefined}
      tabIndex={focusable ? 0 : undefined}
    >
      {/* First: a pinned head covers what is above it, focus included. */}
      <div className="uib-shell-pinned" ref={setPinned}>
        {panel.pinned}
      </div>
      {panel.children}
      {footScrolls ? foot : null}
    </div>
  );

  const toggleButton = (
    <Tooltip
      content={toggleLabel}
      // Not `top` for the secondary panel, which would flip over it or overflow the window.
      placement={side === 'secondary' ? (railed ? 'left' : 'right') : 'top'}
    >
      <Button
        aria-controls={companion && !collapsed ? `${contentId} ${companionId}` : contentId}
        aria-expanded={!collapsed}
        aria-label={toggleLabel}
        className={classes('uib-shell-toggle', showsWord && 'uib-shell-hide')}
        // Pinned to neutral, as kunnskapsassistenten draws it: the panel's own control.
        data-color="neutral"
        // A card's button is the design's 44, sized from the default size mode's tokens.
        data-size={cards ? 'md' : 'sm'}
        icon={!showsWord}
        onClick={() => onToggle(side)}
        ref={toggle}
        variant="tertiary"
      >
        {showsWord ? t('shell.hide') : null}
        <Icon aria-hidden />
      </Button>
    </Tooltip>
  );

  const title = panel.title ? (
    <Heading className="uib-shell-title" data-size="xs" level={2}>
      {panel.title}
    </Heading>
  ) : null;

  // The companion column takes the panel's button, at the card's edge towards the main column.
  const companionSection = (button: ReactNode) =>
    companion ? (
      <section aria-label={companion.label} className="uib-shell-companion" id={companionId}>
        <div className="uib-shell-header">
          <div className="uib-shell-companion-titles">
            {companion.title ? (
              <Heading className="uib-shell-title" data-size="xs" level={2}>
                {companion.title}
              </Heading>
            ) : null}
            {companion.subtitle ? (
              <p className="uib-shell-companion-subtitle">{companion.subtitle}</p>
            ) : null}
          </div>
          {button}
        </div>
        <div className="uib-shell-content">{companion.children}</div>
      </section>
    ) : null;
  const leadWidth = companion?.keepWidth
    ? `calc(100% - ${companion.width}px)`
    : companion
      ? `${Math.max((geometry.panels[side]?.width ?? width) - companion.width, 0)}px`
      : undefined;
  const withCompanion = companion !== undefined && !railed;

  return (
    <Landmark
      aria-label={panel.label}
      className="uib-shell-side"
      // What stands here on the row: a drawer leaves a rail, open or shut.
      data-collapsed={railed || undefined}
      data-drawer={drawer || undefined}
      data-side={side}
      onBlur={(event) => {
        const to = event.relatedTarget;
        const leaving = !element.current?.contains(to);
        if (leaving) setHasFocus(false);
        lentToDialog.current =
          leaving && to instanceof HTMLElement && to.closest('dialog[open]') !== null;
      }}
      onFocus={() => setHasFocus(true)}
      ref={element}
    >
      {/* The separator is in the landmark but outside this clipping box. */}
      <div
        className="uib-shell-box"
        data-companion={withCompanion || undefined}
        style={
          withCompanion ? ({ '--uib-shell-lead-width': leadWidth } as CSSProperties) : undefined
        }
      >
        {/* Outside the scroller, so the button never scrolls out of sight. */}
        <div className="uib-shell-header">
          {toggleLast || withCompanion ? null : toggleButton}
          {railed ? null : title}
          {railed ? null : <div className="uib-shell-head">{panel.head}</div>}
          {toggleLast && !withCompanion ? toggleButton : null}
        </div>
        {/* On the rail a drawer leaves too, so its parts are one click away in a narrow window. */}
        {railed && panel.rail != null ? <div className="uib-shell-rail">{panel.rail}</div> : null}
        {drawer ? null : panelContent}
        {railed || footScrolls ? null : foot}
        {railed && panel.railFoot != null ? (
          <div className="uib-shell-rail-foot">{panel.railFoot}</div>
        ) : null}
        {withCompanion ? companionSection(toggleButton) : null}
      </div>

      {/* A native modal dialog, kept mounted so what is in it keeps its state. */}
      {drawer ? (
        <Dialog
          aria-label={panel.label}
          className="uib-shell-drawer"
          closeButton={t('shell.closePanel', { panel: name })}
          data-side={side}
          onClose={() => onCollapse(side, true)}
          open={!collapsed}
          placement={drawerPlacement(side)}
        >
          <div className="uib-shell-box">
            <div className="uib-shell-header">
              {title}
              <div className="uib-shell-head">{panel.head}</div>
            </div>
            {panelContent}
            {footScrolls ? null : foot}
            {/* Under the panel's own column: a drawer is one column wide. */}
            {companionSection(null)}
          </div>
        </Dialog>
      ) : null}

      {/* Not on a rail, except while the drag that folded the panel is held, so it can reopen it. */}
      {railed && !resizing ? null : (
        <Separator
          direction={growthDirection(side)}
          fixed={range.min === range.max}
          folded={collapsed}
          name={name}
          onDraggingChange={setResizing}
          onFold={(folded) => onCollapse(side, folded)}
          onReset={() => onWidth(side, geometry.panels[side]?.width ?? width)}
          onResize={(next) => onWidth(side, clampWidth(next, range))}
          range={range}
          side={side}
          width={width}
        />
      )}
    </Landmark>
  );
};
