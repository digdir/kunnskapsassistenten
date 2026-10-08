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
 * How wide a panel may be dragged, right now, in this window.
 *
 * Two limits, and both are real:
 *
 *   the model's own floors — 400 for the navigation panel, 336 for the
 *   sources panel — which are the widths the design was drawn for. Neither
 *   has a ceiling of its own since issue 80;
 *
 *   and what is left in the window once the OTHER panel and the answer
 *   column's 640 px floor have had theirs. A drag takes its room from the
 *   answer column and from nothing else. It could take it from the other
 *   panel instead — `fittedWidths` gives the sources panel away first when
 *   the WINDOW runs short — but a reader dragging one edge and watching the
 *   opposite edge move would be watching the app do something they did not
 *   ask for. Widening the navigation panel past what is free means narrowing
 *   the sources panel first, by hand, which is a second deliberate act.
 *
 * The two can cross: at 1440 with both panels open, everything is already on
 * its floor and there is nothing to drag. `min` wins then, and the separator
 * reports a value it cannot move away from, which is the truth.
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
 * Which way the pointer has to travel to make this panel wider: away from the
 * answer column.
 *
 * `+1` means «toward the inline end», so a panel that sits before the answer
 * column grows with a rising x and one that sits after it shrinks. Read off
 * `slotOrder` rather than written down per slot, so a layout that puts the
 * sources panel first is not a second place to remember.
 */
export function growthDirection(slot: SidebarSlot): 1 | -1 {
  return slotOrder.indexOf(slot) < slotOrder.indexOf('main') ? 1 : -1;
}

/** Arrow keys move the edge this far; Shift makes it a stride. */
export const widthStep = 16;
export const widthStride = 64;
