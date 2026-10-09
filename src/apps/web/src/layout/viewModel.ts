// The layout's view model. Slots are fixed places named after position; views
// are content and can move between slots, so a slot's accessible name comes
// from its views (`slotLabel()`). LayoutProvider holds the state.

/** A place in the layout. Named after position, never after content. */
export type Slot = 'primary-sidebar' | 'main' | 'secondary-sidebar';

/** Content that can be moved between slots. Named after content. */
export type ViewId = 'threads' | 'filters' | 'chat' | 'sources';

export type View = {
  id: ViewId;
  /** Norwegian; the slot's heading and accessible name. Never hardcode it in markup. */
  label: string;
};

/** Every view in the product, with its Norwegian label. */
export const views: Record<ViewId, View> = {
  threads: { id: 'threads', label: 'Tråder' },
  filters: { id: 'filters', label: 'Filter' },
  chat: { id: 'chat', label: 'Chat' },
  sources: { id: 'sources', label: 'Kilder' },
};

/**
 * How wide a slot is, in CSS pixels it OCCUPIES (padding included). Numbers,
 * not `--ds-size-*` tokens: they come from the page template, off the scale.
 */
export type SlotSizing =
  // Both sidebars. `minWidth`/`maxWidth` bound a drag, and the floor is how far
  // the window may squeeze it; which one gives first is in `fittedWidths`.
  | { mode: 'sized'; width: number; minWidth: number; maxWidth: number; collapsedWidth: number }
  /** Takes what is left, between bounds. The answer column, and only it. */
  | { mode: 'flexible'; minWidth: number; maxWidth: number };

/** The narrowest a slot can be drawn while open; the breakpoints sum these. */
export function slotFloor(sizing: SlotSizing): number {
  return sizing.minWidth;
}

/** What a slot takes up folded (the rail); the answer column answers its floor. */
export function slotRail(sizing: SlotSizing): number {
  return sizing.mode === 'flexible' ? slotFloor(sizing) : sizing.collapsedWidth;
}

/** What the shell hands a view. The same for every view, so any view fits any slot. */
export type SlotViewProps = {
  /** Which view the shell is rendering. A view may ignore it. */
  view: ViewId;
  /** Whether the slot this view sits in is collapsed. */
  collapsed: boolean;
  /** Ask the slot to collapse or open; the slot owns it, so its button never lies. */
  onCollapsedChange: (collapsed: boolean) => void;
  /** The citation last asked for; undefined until a `[n]` marker is activated. */
  activeCitationNumber?: number;
  /** Counts up on every request, so asking twice for one citation still reacts. */
  activeCitationNonce?: number;
  /** The other views in this slot, in declared order: what this view can switch to. */
  siblingViews: ViewId[];
  /** Switch the slot to another view it holds. */
  onShowView: (view: ViewId) => void;
  /** True when the user switched here: take focus on mount only then, not on page load. */
  switchedByUser: boolean;
};

export type SlotState = {
  slot: Slot;
  /** More than one means the user switches between them; never two shown at once. */
  views: ViewId[];
  /** The view currently shown. Must be one of `views`. */
  activeView: ViewId;
  /** Collapsed to a single button? */
  collapsed: boolean;
  sizing: SlotSizing;
  /** Draw every view at once, each with its own pinned head (`withFiltersBesideSources`). */
  stacked?: boolean;
};

export type Layout = {
  id: string;
  /** Norwegian, for a future layout switcher. */
  label: string;
  slots: Record<Slot, SlotState>;
};

/**
 * A collapsed sidebar: its toggle button and nothing else, to give the space
 * back. 42 (icon-only `sm` Button, as drawn) + 2 × 12 (`--ds-size-3`) + 1
 * (border, outside the border-box content) = 67. global.css has to agree.
 */
export const railWidth = 67;

/** The layout as designed. The sources panel opens once there are sources to cite. */
export const defaultLayout: Layout = {
  id: 'default',
  label: 'Standard',
  slots: {
    'primary-sidebar': {
      slot: 'primary-sidebar',
      // Order matters: `views` is the declared set, and slotLabel() joins the
      // labels in this order, so this is what produces «Tråder og filter».
      // Which one is shown is `activeView`, not the array order.
      views: ['threads', 'filters'],
      // A first-time user lands on filters, not on the thread list.
      activeView: 'filters',
      collapsed: false,
      // 400 = 328 inner (what the filter controls were drawn for) + 36 px padding
      // each side, so it is the floor too. No ceiling, so a panel can take at
      // least half the window (issue 80); `widthRange` in resize.ts bounds it.
      sizing: {
        mode: 'sized',
        width: 400,
        minWidth: 400,
        maxWidth: Number.POSITIVE_INFINITY,
        collapsedWidth: railWidth,
      },
    },
    main: {
      slot: 'main',
      views: ['chat'],
      activeView: 'chat',
      collapsed: false,
      // A hard floor: the sources must be readable beside the answer.
      sizing: { mode: 'flexible', minWidth: 640, maxWidth: 800 },
    },
    'secondary-sidebar': {
      slot: 'secondary-sidebar',
      views: ['sources'],
      activeView: 'sources',
      collapsed: true,
      // The slot that gives way. 432 fits the Figma organism frames and makes
      // 1536 (laptop width) with all three open; 336 is what 1440 leaves. Not
      // Figma's 514, from an unused frame. No ceiling (issue 80).
      sizing: {
        mode: 'sized',
        width: 432,
        minWidth: 336,
        maxWidth: Number.POSITIVE_INFINITY,
        collapsedWidth: railWidth,
      },
    },
  },
};

/** Slots in the order the layout wants to render them. */
export const slotOrder: Slot[] = ['primary-sidebar', 'main', 'secondary-sidebar'];

/**
 * The gap beside an OPEN panel (a rail sits flush, or it reads as a hole).
 * Mirrors `--ka-slot-gap` in global.css for the breakpoint sums;
 * tests/e2e/layout.spec.ts fails if the two drift apart.
 */
export const slotGap = 32;

/**
 * The narrowest window with both sidebars open: 400 + 32 + 640 + 32 + 336 =
 * 1440. Summed from `defaultLayout`, so it moves when a width does.
 */
export const bothSidebarsMinViewport =
  slotFloor(defaultLayout.slots['primary-sidebar'].sizing) +
  slotGap +
  slotFloor(defaultLayout.slots.main.sizing) +
  slotGap +
  slotFloor(defaultLayout.slots['secondary-sidebar'].sizing);

/** Range syntax: `max-width: 1439px` misses the fractional widths of a zoomed window. */
export const narrowViewportQuery = `(width < ${bothSidebarsMinViewport}px)`;

/**
 * The narrowest window where an open sidebar fits BESIDE the answer column,
 * from the widest one-sidebar state: 400 + 32 + 640 + 67 = 1139. Below it,
 * drawers.
 */
export const drawerMaxViewport =
  slotFloor(defaultLayout.slots['primary-sidebar'].sizing) +
  slotGap +
  slotFloor(defaultLayout.slots.main.sizing) +
  slotRail(defaultLayout.slots['secondary-sidebar'].sizing);

/** Range syntax as above; zoom, and so fractional widths, is what this one is for. */
export const drawerViewportQuery = `(width < ${drawerMaxViewport}px)`;

/**
 * Below 67 + 640 + 67 = 774 the rails eat an answer column already under its
 * floor, so with `mobile-top-row` (digdir/kunnskapsassistenten#120) they move
 * to a bar above it.
 */
export const compactMaxViewport =
  slotRail(defaultLayout.slots['primary-sidebar'].sizing) +
  slotFloor(defaultLayout.slots.main.sizing) +
  slotRail(defaultLayout.slots['secondary-sidebar'].sizing);

/** True while the window is narrow enough for the bar, flag or not. */
export const compactViewportQuery = `(width < ${compactMaxViewport}px)`;

/**
 * `Dialog`'s `placement` for a drawer: vendor words, the one exception to the
 * no-sides naming rule, read off `slotOrder` so a moved panel follows.
 */
export function drawerPlacement(slot: SidebarSlot): 'left' | 'right' {
  return slotOrder.indexOf(slot) < slotOrder.indexOf('main') ? 'left' : 'right';
}

/**
 * A drawer's width, from `defaultLayout` and capped by the window: a dragged
 * width is meant for a column beside the answer, not over it.
 */
export function drawerWidth(slot: SidebarSlot, viewport: number): number {
  const sizing = defaultLayout.slots[slot].sizing;
  const wanted = sizing.mode === 'flexible' ? sizing.minWidth : sizing.width;
  return Math.min(wanted, viewport);
}

/** The two slots that can be collapsed, in layout order. */
export const sidebarSlots = ['primary-sidebar', 'secondary-sidebar'] as const;

export type SidebarSlot = (typeof sidebarSlots)[number];

/**
 * The sidebar that gives way when only one fits: the sources panel, opened
 * briefly to check a citation, while the navigation panel steers.
 */
export const yieldingSidebar: SidebarSlot = 'secondary-sidebar';

export function otherSidebar(slot: SidebarSlot): SidebarSlot {
  return slot === 'primary-sidebar' ? 'secondary-sidebar' : 'primary-sidebar';
}

/**
 * Keep at most one sidebar open, `keepOpen` if a choice must be made. A no-op
 * unless both are open, so it is safe to run after every change.
 */
export function withOneSidebarOpen(layout: Layout, keepOpen: SidebarSlot): Layout {
  if (layout.slots[keepOpen].collapsed) return layout;
  return withCollapsed(layout, otherSidebar(keepOpen), true);
}

/**
 * Fold both sidebars, on entering drawer mode: an open drawer is modal and
 * would cover the answer unasked. Crossing back reopens nothing.
 */
export function withAllSidebarsCollapsed(layout: Layout): Layout {
  return sidebarSlots.reduce((next, slot) => withCollapsed(next, slot, true), layout);
}

/**
 * A slot's accessible name from its views, Norwegian style: «Tråder og filter».
 * Undefined for `main`, which is unique and would only add noise.
 */
export function slotLabel(layout: Layout, slot: Slot): string | undefined {
  if (slot === 'main') return undefined;

  const labels = layout.slots[slot].views.map((id) => views[id].label);
  if (labels.length === 0) return undefined;

  return labels
    .map((label, index) => (index === 0 ? label : label.toLocaleLowerCase('nb-NO')))
    .join(' og ');
}

/** The slot a view currently sits in, or undefined if it sits nowhere. */
export function slotOf(layout: Layout, view: ViewId): Slot | undefined {
  return slotOrder.find((slot) => layout.slots[slot].views.includes(view));
}

/** Show `view` in its slot. No-op if the view is not in that slot. */
export function withActiveView(layout: Layout, slot: Slot, view: ViewId): Layout {
  const state = layout.slots[slot];
  if (!state.views.includes(view) || state.activeView === view) return layout;
  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, activeView: view } },
  };
}

export function withCollapsed(layout: Layout, slot: Slot, collapsed: boolean): Layout {
  const state = layout.slots[slot];
  if (state.collapsed === collapsed) return layout;
  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, collapsed } },
  };
}

/** Resize a sidebar, never below its floor. The answer column has no width to set. */
export function withWidth(layout: Layout, slot: Slot, width: number): Layout {
  const state = layout.slots[slot];
  if (state.sizing.mode === 'flexible') return layout;

  // A backstop; `widthRange` in resize.ts decides what fits. The floor keeps an
  // impossible stored width (an old or hand-edited `ka.layout.v1`) out, and
  // `fittedWidths` draws a huge one at what the window holds.
  const clamped = Math.min(
    Math.max(Math.round(width), state.sizing.minWidth),
    state.sizing.maxWidth,
  );
  if (state.sizing.width === clamped) return layout;

  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, sizing: { ...state.sizing, width: clamped } } },
  };
}

/**
 * Move a view to another slot (no UI yet). A slot left empty collapses: it has
 * nothing to name itself after, and an unnamed landmark is worse than none.
 */
export function withViewMoved(layout: Layout, view: ViewId, target: Slot): Layout {
  const source = slotOf(layout, view);
  if (!source || source === target) return layout;

  const from = layout.slots[source];
  const remaining = from.views.filter((id) => id !== view);
  const to = layout.slots[target];

  return {
    ...layout,
    slots: {
      ...layout.slots,
      [source]: {
        ...from,
        views: remaining,
        activeView: remaining[0] ?? from.activeView,
        collapsed: remaining.length === 0 ? true : from.collapsed,
      },
      [target]: {
        ...to,
        views: [...to.views, view],
        activeView: view,
        collapsed: false,
      },
    },
  };
}

/**
 * The filters stacked over the sources, the threads alone in the primary
 * sidebar: the `filters-right-panel` trial (digdir/kunnskapsassistenten#84).
 */
export function withFiltersBesideSources(layout: Layout): Layout {
  const source = slotOf(layout, 'filters');
  if (source === undefined || source === 'secondary-sidebar') return layout;

  const from = layout.slots[source];
  const remaining: ViewId[] = from.views.filter((id) => id !== 'filters');
  const to = layout.slots['secondary-sidebar'];

  return {
    ...layout,
    slots: {
      ...layout.slots,
      [source]: {
        ...from,
        views: remaining,
        activeView: remaining.includes(from.activeView)
          ? from.activeView
          : (remaining[0] ?? from.activeView),
      },
      'secondary-sidebar': {
        ...to,
        // Filters first: drawn on top, and first in the name, «Filter og kilder».
        views: ['filters', ...to.views.filter((id) => id !== 'filters')],
        stacked: true,
      },
    },
  };
}

/** What a slot takes up on the row right now, collapsed or open. */
export function slotOccupied(state: SlotState): number {
  const sizing = state.sizing;
  if (sizing.mode === 'flexible') return slotFloor(sizing);
  return state.collapsed ? sizing.collapsedWidth : sizing.width;
}

/** The gap this slot puts between itself and the answer column. A rail has none. */
export function slotGapFor(state: SlotState): number {
  return state.collapsed ? 0 : slotGap;
}

/**
 * The sidebar widths actually DRAWN in this window, which `aria-valuenow`
 * reports. When a dragged width does not fit, what gives, in order: the answer
 * column down to 640 (in CSS), any widening past the design width (sources
 * first, as a drag in resize.ts), the sources panel down to 336, then the
 * navigation panel down to 400.
 */
export function fittedWidths(layout: Layout, viewport: number): Record<SidebarSlot, number> {
  const fitted = {} as Record<SidebarSlot, number>;
  for (const slot of sidebarSlots) fitted[slot] = slotOccupied(layout.slots[slot]);

  let over =
    fitted['primary-sidebar'] +
    fitted['secondary-sidebar'] +
    slotGapFor(layout.slots['primary-sidebar']) +
    slotGapFor(layout.slots['secondary-sidebar']) +
    slotFloor(layout.slots.main.sizing) -
    viewport;

  // Two rounds, down to the design's width and then to the floor,
  // `yieldingSidebar` first in each.
  const order = [yieldingSidebar, otherSidebar(yieldingSidebar)];
  const designWidth = (slot: SidebarSlot) => {
    const sizing = defaultLayout.slots[slot].sizing;
    return sizing.mode === 'flexible' ? sizing.minWidth : sizing.width;
  };
  for (const floor of [designWidth, (slot: SidebarSlot) => layout.slots[slot].sizing.minWidth]) {
    for (const slot of order) {
      if (over <= 0) break;
      const state = layout.slots[slot];
      if (state.collapsed || state.sizing.mode === 'flexible') continue;

      const give = Math.min(over, fitted[slot] - Math.max(floor(slot), state.sizing.minWidth));
      if (give <= 0) continue;
      fitted[slot] -= give;
      over -= give;
    }
  }

  return fitted;
}

/**
 * Slot widths as CSS custom properties; a collapsed slot reports its rail
 * width, so CSS never needs the state. `viewport`: see `fittedWidths`.
 */
export function layoutStyle(
  layout: Layout,
  viewport: number,
  drawer = false,
  compact = false,
): Record<string, string> {
  const style: Record<string, string> = {};
  const fitted = fittedWidths(layout, viewport);

  // In drawer mode every sidebar is a rail on the row, open or not: an open
  // one is drawn over the answer column and takes no part in the widths.
  const railed = (state: SlotState) => drawer || state.collapsed;

  // The answer column apart from the sidebars, not one loop over `slotOrder`:
  // `flexible` is its mode and `sized` theirs, and one loop would make the
  // types lie about which slot can be collapsed.
  const main = layout.slots.main.sizing;
  if (main.mode === 'flexible') {
    // The 640 floor is for reading BESIDE the answer; in drawer mode it yields
    // to the window rather than scroll sideways (WCAG 1.4.10). In the bar the
    // rails stand above the column and take nothing from the row.
    const rails = compact
      ? 0
      : sidebarSlots.reduce((total, slot) => total + slotRail(layout.slots[slot].sizing), 0);
    const room = Math.max(0, viewport - rails);
    style['--ka-main-min-width'] = `${drawer ? Math.min(main.minWidth, room) : main.minWidth}px`;
    style['--ka-main-max-width'] = `${main.maxWidth}px`;
  }

  for (const slot of sidebarSlots) {
    const state = layout.slots[slot];
    const sizing = state.sizing;
    if (sizing.mode === 'flexible') continue;

    style[`--ka-${slot}-width`] = `${railed(state) ? sizing.collapsedWidth : fitted[slot]}px`;
    // A rail does not squeeze: its floor is its own width.
    style[`--ka-${slot}-min-width`] =
      `${railed(state) ? sizing.collapsedWidth : sizing.minWidth}px`;
    // Not the stored width; see `drawerWidth`.
    if (drawer) style[`--ka-${slot}-drawer-width`] = `${drawerWidth(slot, viewport)}px`;
  }

  return style;
}
