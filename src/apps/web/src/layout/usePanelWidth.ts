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
  /**
   * True when the window has nothing left to give: the floor, the ceiling and
   * the width on screen are one number, and no control can change anything.
   */
  fixed: boolean;
  /** Set an absolute width, clamped to `range`. */
  setWidth: (next: number) => void;
  /** Back to the width the design draws, which also forgets the stored one. */
  reset: () => void;
};

/**
 * One panel's width, and everything that can change it.
 *
 * The separator between the panel and the answer column is the one control
 * that moves the edge: by drag, by click and by key. The arithmetic is here
 * and not in it, so what it reports and what it can do are read from one
 * place, and the separator stays about input.
 *
 * WCAG 2.5.7 Dragging Movements (AA) asks that anything operated by a drag
 * can also be operated with a single pointer WITHOUT dragging, and a keyboard
 * does not answer that — that is 2.1.1's question. The people 2.5.7 is for
 * use a pointer and can click; a head pointer, a tremor, a joystick. Found by
 * KA CC reviewing PR #50. It was two buttons in the panel head until Simens
 * issue 81; it is a click on the edge now. See PanelSeparator.tsx.
 */
export function usePanelWidth(slot: SidebarSlot): PanelWidth {
  const { layout, setWidth: write } = useLayout();
  const viewport = useViewportWidth();

  // The range the panel has OPEN, also while it is folded. The one place a
  // folded panel has a live separator is a drag that folded it and is still
  // going, and what that drag needs to know is where the panel would stand if
  // it opened again. Folded, the slot puts no gap beside itself, so the range
  // read off the folded layout would be 32 px too wide. See PanelSeparator.tsx.
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
