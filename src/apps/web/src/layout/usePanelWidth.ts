import { useCallback, useMemo } from 'react';
import { clampWidth, growthDirection, widthRange, type WidthRange } from './resize';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { defaultLayout, fittedWidths, withCollapsed, type SidebarSlot } from './viewModel';

export type PanelWidth = {
  /** What the panel is DRAWN at. See `fittedWidths`. */
  width: number;
  /** How narrow and how wide it may be right now, in this window. */
  range: WidthRange;
  /** `+1` when the panel grows toward the inline end. See `growthDirection`. */
  direction: 1 | -1;
  /** True when floor, ceiling and drawn width are one number, so no control can change it. */
  fixed: boolean;
  /** Set an absolute width, clamped to `range`. */
  setWidth: (next: number) => void;
  /** Back to the width the design draws, which also forgets the stored one. */
  reset: () => void;
};

/**
 * One panel's width and everything that can change it, so the separator only handles input.
 * WCAG 2.5.7 needs a way to resize with a single pointer and no drag (a keyboard does not count):
 * here, a click on the edge (see PanelSeparator.tsx).
 */
export function usePanelWidth(slot: SidebarSlot): PanelWidth {
  const { layout, setWidth: write } = useLayout();
  const viewport = useViewportWidth();

  // The range the panel has OPEN, also while folded: a drag that folded it and is still going
  // needs it. The folded layout has no gap beside the slot, so its range would be too wide.
  const range = widthRange(withCollapsed(layout, slot, false), slot, viewport);
  const width = fittedWidths(layout, viewport)[slot];
  const direction = growthDirection(slot);

  const setWidth = useCallback(
    (next: number) => write(slot, clampWidth(next, range)),
    [write, slot, range],
  );

  return useMemo(
    () => ({
      width,
      range,
      direction,
      fixed: range.min === range.max,
      setWidth,
      reset: () => {
        const sizing = defaultLayout.slots[slot].sizing;
        if (sizing.mode !== 'flexible') write(slot, sizing.width);
      },
    }),
    [width, range, direction, setWidth, write, slot],
  );
}
