// Layout and filter state kept across reloads, under versioned keys: bump the filter key when the
// corpus changes (its values are backend filter keys), the layout key when the slots change.
// Every read is validated, because storage can throw and the reader can edit it.

import { emptyFilterSelection, type FilterDimension, type FilterSelection } from '../model';
import {
  defaultLayout,
  sidebarSlots,
  withCollapsed,
  withWidth,
  type Layout,
  type SidebarSlot,
} from './viewModel';

export const LAYOUT_STORAGE_KEY = 'ka.layout.v1';
export const FILTER_STORAGE_KEY = 'ka.filter.v1';

/** The layout state worth remembering. Everything else is derived or fixed. */
export type StoredLayout = {
  /** Per sidebar. A slot missing here simply keeps whatever the default says. */
  collapsed: Partial<Record<SidebarSlot, boolean>>;
  /** Per sidebar, in CSS pixels, only for a panel the reader has moved. */
  widths: Partial<Record<SidebarSlot, number>>;
  /** The reader shut the sources panel. Stored, since `collapsed` alone is also the default. */
  sourcesDismissed: boolean;
};

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    // Unreadable or not JSON at all. Either way there is nothing to restore.
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignored on purpose: the choice still holds for this page load.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The remembered layout, or undefined. Every field is checked, since the reader can edit it. */
export function readStoredLayout(): StoredLayout | undefined {
  const value = readJson(LAYOUT_STORAGE_KEY);
  if (!isRecord(value)) return undefined;

  const stored = isRecord(value.collapsed) ? value.collapsed : {};
  const collapsed: Partial<Record<SidebarSlot, boolean>> = {};
  for (const slot of sidebarSlots) {
    if (typeof stored[slot] === 'boolean') collapsed[slot] = stored[slot];
  }

  // Finite numbers only: `Infinity` and `NaN` pass `typeof` and break CSS. `withWidth` applies
  // the bounds later.
  const storedWidths = isRecord(value.widths) ? value.widths : {};
  const widths: Partial<Record<SidebarSlot, number>> = {};
  for (const slot of sidebarSlots) {
    const width = storedWidths[slot];
    if (typeof width === 'number' && Number.isFinite(width)) widths[slot] = width;
  }

  return { collapsed, widths, sourcesDismissed: value.sourcesDismissed === true };
}

export function writeStoredLayout(layout: Layout, sourcesDismissed: boolean): void {
  const collapsed: Partial<Record<SidebarSlot, boolean>> = {};
  for (const slot of sidebarSlots) collapsed[slot] = layout.slots[slot].collapsed;

  // Only a width the reader has moved. Storing the default too would make «reset» and «never
  // touched» differ, and a changed default would not reach browsers that had merely opened the
  // app once.
  const widths: Partial<Record<SidebarSlot, number>> = {};
  for (const slot of sidebarSlots) {
    const sizing = layout.slots[slot].sizing;
    const fallback = defaultLayout.slots[slot].sizing;
    if (sizing.mode === 'flexible' || fallback.mode === 'flexible') continue;
    if (sizing.width !== fallback.width) widths[slot] = sizing.width;
  }

  writeJson(LAYOUT_STORAGE_KEY, { collapsed, widths, sourcesDismissed });
}

/**
 * Apply the remembered collapse state to the stored slots only, so a removed slot cannot come
 * back. May leave both sidebars open in a narrow window; `LayoutProvider` fixes that.
 */
export function withStoredCollapse(layout: Layout, stored: StoredLayout | undefined): Layout {
  if (!stored) return layout;

  let next = layout;
  for (const slot of sidebarSlots) {
    const collapsed = stored.collapsed[slot];
    if (collapsed !== undefined) next = withCollapsed(next, slot, collapsed);
  }
  return next;
}

/** Apply the remembered widths, clamped by `withWidth`; what fits the window is `fittedWidths`. */
export function withStoredWidths(layout: Layout, stored: StoredLayout | undefined): Layout {
  if (!stored) return layout;

  let next = layout;
  for (const slot of sidebarSlots) {
    const width = stored.widths[slot];
    if (width !== undefined) next = withWidth(next, slot, width);
  }
  return next;
}

/** The dimensions, from the empty selection, so there is one list of them. */
const dimensions = Object.keys(emptyFilterSelection) as FilterDimension[];

/**
 * The remembered filter; a missing or malformed dimension comes back empty. Values are not checked
 * against the corpus, but '' («Ingen treff») is dropped, since it would match nothing.
 */
export function readStoredFilter(): FilterSelection | undefined {
  const value = readJson(FILTER_STORAGE_KEY);
  if (!isRecord(value)) return undefined;

  const selection: FilterSelection = { ...emptyFilterSelection };
  for (const dimension of dimensions) {
    const values = value[dimension];
    if (Array.isArray(values) && values.every((entry) => typeof entry === 'string')) {
      selection[dimension] = values.filter((entry) => entry !== '');
    }
  }
  return selection;
}

export function writeStoredFilter(selection: FilterSelection): void {
  writeJson(FILTER_STORAGE_KEY, selection);
}

/** For «Logg ut» (`beforeLogout` in session.ts): the filter is per browser, not per user. */
export function forgetStoredFilter(): void {
  try {
    localStorage.removeItem(FILTER_STORAGE_KEY);
  } catch {
    // Not writable. The page is about to leave anyway.
  }
}
