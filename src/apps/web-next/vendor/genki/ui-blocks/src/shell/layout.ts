// The shell's model, pure: two panels that fold, resize and become drawers beside a main column.

/** A side panel. `primary` stands before the main column, `secondary` after it. */
export type ShellSide = 'primary' | 'secondary';

export const shellSides = ['primary', 'secondary'] as const satisfies readonly ShellSide[];

export interface ShellPanelSize {
  /** The width the design draws, in CSS pixels, padding and border included. */
  width: number;
  /** The narrowest it is drawn open. A drag past half of it folds the panel instead. */
  minWidth: number;
  /** The widest it may be dragged. No ceiling by default: the main column's floor is the limit. */
  maxWidth?: number | undefined;
}

/** A panel's size with every number given; no ceiling is `Infinity`. */
export type PanelSize = { [K in keyof ShellPanelSize]-?: number };

export interface ShellMainSize {
  /** The main column's floor, so it stays readable beside the panels. */
  minWidth: number;
  /** The reading width; the main column is centred in what is left. */
  maxWidth: number;
}

/** What the reader changes, as the host stores it and hands it back. Every field may be missing. */
export interface ShellLayout {
  /** Folded to a rail, per panel. */
  collapsed?: Partial<Record<ShellSide, boolean>> | undefined;
  /** Widths the reader dragged. A panel at the design's width is left out. */
  widths?: Partial<Record<ShellSide, number>> | undefined;
  /** The reader shut this panel themselves, so an offer does not open it again. */
  dismissed?: Partial<Record<ShellSide, boolean>> | undefined;
}

/** The state the shell keeps. */
export interface ShellState {
  collapsed: Record<ShellSide, boolean>;
  /** The width asked for. What is drawn is `fittedWidths`. */
  widths: Record<ShellSide, number>;
  dismissed: Record<ShellSide, boolean>;
  /** Open panels the window folded, not the reader: they open again when it has room. Not stored. */
  foldedByWindow?: Partial<Record<ShellSide, boolean>>;
}

/** Fixed for a page: which panels there are, and every size the sums need. */
export interface ShellGeometry {
  panels: Partial<Record<ShellSide, PanelSize>>;
  main: ShellMainSize;
  /** The gap beside an open panel; a rail sits flush. Must match `--genai-shell-gap`. */
  gap: number;
  /** A folded panel's width: the button and the rail's padding and border. */
  rail: number;
  /** The frame's margin on each side of the row, inside the window: 0 when flush. */
  inset?: number | undefined;
  /** A rail keeps the gap beside it too, as a card of its own does; flush, it meets the main column. */
  railGap?: boolean | undefined;
}

/** Kunnskapsassistenten's sizes; no ceiling, so a panel can take about half the window. */
export const defaultPanelSizes: Record<ShellSide, PanelSize> = {
  primary: { width: 400, minWidth: 400, maxWidth: Number.POSITIVE_INFINITY },
  secondary: { width: 432, minWidth: 336, maxWidth: Number.POSITIVE_INFINITY },
};

/** The main column: 640 so the sources can be read beside the answer, 800 to read. */
export const defaultMainSize: ShellMainSize = { minWidth: 640, maxWidth: 800 };

/** `--ds-size-8` at the default size mode. */
export const defaultGap = 32;

/** A small icon button, 42, plus 2 × 12 (`--ds-size-3`) padding and a 1 px border. */
export const defaultRail = 67;

/**
 * The cards frame's sums, the design's dev-navbar board at the default size mode: 16 from the
 * window (`--ds-size-4`), 12 between the cards (`--ds-size-3`), and a rail that is a 44 button
 * (`--ds-size-11`) with 16 on each side.
 */
export const cardsInset = 16;
export const cardsGap = 12;
export const cardsRail = 76;

/** Kunnskapsassistenten starts with the primary panel open and the secondary one on its rail. */
export const defaultCollapsed: Record<ShellSide, boolean> = { primary: false, secondary: true };

export const otherSide = (side: ShellSide): ShellSide =>
  side === 'primary' ? 'secondary' : 'primary';

/** The panel that gives way when only one fits: the secondary one, opened to check something. */
export const yieldingSide = (geometry: ShellGeometry): ShellSide =>
  geometry.panels.secondary ? 'secondary' : 'primary';

const present = (geometry: ShellGeometry) => shellSides.filter((side) => geometry.panels[side]);

/** What a rail takes on the row: its width, and the gap beside it where a rail keeps one. */
const railOf = (geometry: ShellGeometry, side: ShellSide) =>
  geometry.panels[side] ? geometry.rail + (geometry.railGap ? geometry.gap : 0) : 0;

/** The frame's margins on both sides of the row. */
const edges = (geometry: ShellGeometry) => 2 * (geometry.inset ?? 0);

/** The row's room in a window: what the frame's margins leave. */
const roomIn = (geometry: ShellGeometry, viewport: number) => viewport - edges(geometry);

/** Where the layout changes, summed from the sizes: `both` 1440, `drawer` 1139, `compact` 774. */
export const breakpoints = (geometry: ShellGeometry) => {
  const { primary, secondary } = geometry.panels;
  const { gap, main } = geometry;
  const edge = edges(geometry);
  return {
    both:
      primary && secondary
        ? edge + primary.minWidth + gap + main.minWidth + gap + secondary.minWidth
        : 0,
    drawer: Math.max(
      0,
      ...present(geometry).map(
        (side) =>
          edge +
          (geometry.panels[side]?.minWidth ?? 0) +
          gap +
          main.minWidth +
          railOf(geometry, otherSide(side)),
      ),
    ),
    compact: present(geometry).length
      ? edge + railOf(geometry, 'primary') + main.minWidth + railOf(geometry, 'secondary')
      : 0,
  };
};

/** Range syntax: `max-width: 1439px` misses the fractional widths of a zoomed window. */
export const narrowerThan = (width: number) => `(width < ${width}px)`;

/** The state to start from: the host's stored layout over the panels' defaults. */
export const initialState = (
  geometry: ShellGeometry,
  collapsedByDefault: Record<ShellSide, boolean>,
  stored: ShellLayout | undefined,
): ShellState => {
  const state: ShellState = {
    collapsed: { ...collapsedByDefault },
    widths: {
      primary: geometry.panels.primary?.width ?? 0,
      secondary: geometry.panels.secondary?.width ?? 0,
    },
    dismissed: { primary: false, secondary: false },
  };
  for (const side of shellSides) {
    const collapsed = stored?.collapsed?.[side];
    if (typeof collapsed === 'boolean') state.collapsed[side] = collapsed;
    if (stored?.dismissed?.[side] === true) state.dismissed[side] = true;
  }
  let next = state;
  for (const side of shellSides) {
    // Finite numbers only: `Infinity` and `NaN` pass `typeof` and break CSS.
    const width = stored?.widths?.[side];
    if (typeof width === 'number' && Number.isFinite(width))
      next = withWidth(geometry, next, side, width);
  }
  return next;
};

/**
 * A panel's width within its floor and ceiling as they are now. The host may change a panel's size
 * while the reader is on the page, as the next look's primary panel does between the threads with
 * their filter (660) and the settings menu (220): the width asked for before still stands, but is
 * drawn within the new size.
 */
const heldWidth = (geometry: ShellGeometry, state: ShellState, side: ShellSide) => {
  const size = geometry.panels[side];
  const width = state.widths[side];
  return size ? Math.min(Math.max(width, size.minWidth), size.maxWidth) : width;
};

/** The layout worth storing: a width only when the reader moved it. */
export const storedLayout = (geometry: ShellGeometry, state: ShellState): ShellLayout => {
  const layout: Required<{ [K in keyof ShellLayout]: NonNullable<ShellLayout[K]> }> = {
    collapsed: {},
    widths: {},
    dismissed: {},
  };
  for (const side of present(geometry)) {
    layout.collapsed[side] = state.collapsed[side];
    layout.dismissed[side] = state.dismissed[side];
    const width = heldWidth(geometry, state, side);
    if (width !== geometry.panels[side]?.width) layout.widths[side] = width;
  }
  return layout;
};

export const withCollapsed = (state: ShellState, side: ShellSide, collapsed: boolean) =>
  state.collapsed[side] === collapsed
    ? state
    : { ...state, collapsed: { ...state.collapsed, [side]: collapsed } };

/** Keep at most one panel open, `keep` if a choice must be made. A no-op unless both are open. */
export const withOneOpen = (state: ShellState, keep: ShellSide) =>
  state.collapsed[keep] ? state : withCollapsed(state, otherSide(keep), true);

/** Fold both, on entering drawer mode: an open drawer is modal and would cover the main column. */
export const withAllCollapsed = (state: ShellState) =>
  shellSides.reduce((next, side) => withCollapsed(next, side, true), state);

/** Fold `side` for want of room, remembered if it was open, so it opens again with room. */
export const withWindowFold = (state: ShellState, side: ShellSide): ShellState =>
  state.collapsed[side]
    ? state
    : {
        ...withCollapsed(state, side, true),
        foldedByWindow: { ...state.foldedByWindow, [side]: true },
      };

/** The reader or the host chose for `side`: the window no longer opens it by itself. */
export const withChosen = (state: ShellState, side: ShellSide): ShellState => {
  if (!state.foldedByWindow?.[side]) return state;
  return { ...state, foldedByWindow: { ...state.foldedByWindow, [side]: false } };
};

/** Open `side` again if the window folded it. */
export const withWindowRoom = (state: ShellState, side: ShellSide): ShellState =>
  state.foldedByWindow?.[side] ? withChosen(withCollapsed(state, side, false), side) : state;

/** A collapse or an open the reader asked for, which also says whether they shut it themselves. */
export const withDismissed = (state: ShellState, side: ShellSide, dismissed: boolean) =>
  state.dismissed[side] === dismissed
    ? state
    : { ...state, dismissed: { ...state.dismissed, [side]: dismissed } };

/** Resize a panel within its floor and ceiling, in whole pixels. */
export const withWidth = (
  geometry: ShellGeometry,
  state: ShellState,
  side: ShellSide,
  width: number,
): ShellState => {
  const size = geometry.panels[side];
  if (!size) return state;
  const clamped = Math.min(Math.max(Math.round(width), size.minWidth), size.maxWidth);
  if (state.widths[side] === clamped) return state;
  return { ...state, widths: { ...state.widths, [side]: clamped } };
};

/** What a panel takes up on the row: its rail when folded. */
const occupied = (geometry: ShellGeometry, state: ShellState, side: ShellSide) => {
  if (!geometry.panels[side]) return 0;
  return state.collapsed[side] ? geometry.rail : heldWidth(geometry, state, side);
};

/** The gap a panel puts between itself and the main column. A rail has none, unless it keeps one. */
const gapOf = (geometry: ShellGeometry, state: ShellState, side: ShellSide) =>
  geometry.panels[side] && (!state.collapsed[side] || geometry.railGap) ? geometry.gap : 0;

/** The widths drawn in this window; what gives first is the main column, then any widening. */
export const fittedWidths = (
  geometry: ShellGeometry,
  state: ShellState,
  viewport: number,
): Record<ShellSide, number> => {
  const fitted = {
    primary: occupied(geometry, state, 'primary'),
    secondary: occupied(geometry, state, 'secondary'),
  };
  let over =
    fitted.primary +
    fitted.secondary +
    gapOf(geometry, state, 'primary') +
    gapOf(geometry, state, 'secondary') +
    geometry.main.minWidth -
    roomIn(geometry, viewport);

  const yielding = yieldingSide(geometry);
  const order = [yielding, otherSide(yielding)];
  const floors = [
    (side: ShellSide) => geometry.panels[side]?.width ?? 0,
    (side: ShellSide) => geometry.panels[side]?.minWidth ?? 0,
  ];
  for (const floor of floors) {
    for (const side of order) {
      const size = geometry.panels[side];
      if (over <= 0) break;
      if (!size || state.collapsed[side]) continue;
      const give = Math.min(over, fitted[side] - Math.max(floor(side), size.minWidth));
      if (give <= 0) continue;
      fitted[side] -= give;
      over -= give;
    }
  }
  return fitted;
};

export interface WidthRange {
  min: number;
  max: number;
}

/** How wide a panel may be dragged: up to what the other panel and the main column leave. */
export const widthRange = (
  geometry: ShellGeometry,
  state: ShellState,
  side: ShellSide,
  viewport: number,
): WidthRange => {
  const size = geometry.panels[side];
  if (!size) return { min: 0, max: 0 };
  const open = withCollapsed(state, side, false);
  const other = otherSide(side);
  const free =
    roomIn(geometry, viewport) -
    fittedWidths(geometry, open, viewport)[other] -
    gapOf(geometry, open, other) -
    gapOf(geometry, open, side) -
    geometry.main.minWidth;
  return { min: size.minWidth, max: Math.max(size.minWidth, Math.min(size.maxWidth, free)) };
};

export const clampWidth = (width: number, range: WidthRange) =>
  Math.min(Math.max(Math.round(width), range.min), range.max);

/** Which way the pointer travels to widen a panel: away from the main column. */
export const growthDirection = (side: ShellSide): 1 | -1 => (side === 'primary' ? 1 : -1);

/** Arrow keys move the edge this far; Shift makes it a stride. */
export const widthStep = 16;
export const widthStride = 64;

/** Designsystemet's `Dialog` placement for a drawer: in from the edge the panel stands at. */
export const drawerPlacement = (side: ShellSide): 'left' | 'right' =>
  side === 'primary' ? 'left' : 'right';

/** A drawer is drawn at the design's width, never a dragged one, and never wider than the window. */
export const drawerWidth = (geometry: ShellGeometry, side: ShellSide, viewport: number) =>
  Math.min(geometry.panels[side]?.width ?? 0, viewport);

/** The widths as custom properties on the shell, so the stylesheet never needs the state. */
export const layoutStyle = (
  geometry: ShellGeometry,
  state: ShellState,
  viewport: number,
  drawer: boolean,
  compact: boolean,
): Record<string, string> => {
  const fitted = fittedWidths(geometry, state, viewport);
  const rails = compact
    ? 0
    : present(geometry).reduce((total, side) => total + railOf(geometry, side), 0);
  const room = Math.max(0, roomIn(geometry, viewport) - rails);
  const style: Record<string, string> = {
    '--uib-shell-main-min-width': `${drawer ? Math.min(geometry.main.minWidth, room) : geometry.main.minWidth}px`,
    '--uib-shell-main-max-width': `${geometry.main.maxWidth}px`,
  };
  for (const side of present(geometry)) {
    const railed = drawer || state.collapsed[side];
    style[`--uib-shell-${side}-width`] = `${railed ? geometry.rail : fitted[side]}px`;
    // A rail does not squeeze: its floor is its own width.
    style[`--uib-shell-${side}-min-width`] =
      `${railed ? geometry.rail : (geometry.panels[side]?.minWidth ?? 0)}px`;
    if (drawer)
      style[`--uib-shell-${side}-drawer-width`] = `${drawerWidth(geometry, side, viewport)}px`;
  }
  return style;
};
