import {
  fittedWidths,
  otherSidebar,
  slotFloor,
  slotGapFor,
  slotOrder,
  type Layout,
  type SidebarSlot,
} from './viewModel';

/**
 * How wide a panel may be dragged in this window: from its floor up to what is left once the
 * OTHER panel and the answer column's floor have theirs. A drag takes room only from the answer
 * column, so the opposite edge never moves. If the limits cross, `min` wins.
 */
export type WidthRange = { min: number; max: number };

export function widthRange(layout: Layout, slot: SidebarSlot, viewport: number): WidthRange {
  const sizing = layout.slots[slot].sizing;
  if (sizing.mode === 'flexible') return { min: 0, max: 0 };

  const other = layout.slots[otherSidebar(slot)];
  const free =
    viewport -
    fittedWidths(layout, viewport)[otherSidebar(slot)] -
    slotGapFor(other) -
    slotGapFor(layout.slots[slot]) -
    slotFloor(layout.slots.main.sizing);

  return { min: sizing.minWidth, max: Math.max(sizing.minWidth, Math.min(sizing.maxWidth, free)) };
}

export function clampWidth(width: number, range: WidthRange): number {
  return Math.min(Math.max(Math.round(width), range.min), range.max);
}

/**
 * Which way the pointer travels to widen this panel: away from the answer column (`+1` is toward
 * the inline end). Read off `slotOrder`, so reordering the slots needs no change here.
 */
export function growthDirection(slot: SidebarSlot): 1 | -1 {
  return slotOrder.indexOf(slot) < slotOrder.indexOf('main') ? 1 : -1;
}

/** Arrow keys move the edge this far; Shift makes it a stride. */
export const widthStep = 16;
export const widthStride = 64;
