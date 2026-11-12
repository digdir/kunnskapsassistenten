import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from './i18n.js';
import { widthStep, widthStride, type ShellSide, type WidthRange } from './layout.js';

/** Pointer travel still counted as a click; 4 px is where Windows starts a drag (`SM_CXDRAG`). */
const clickSlop = 4;

/** How far back past the fold line a drag must come to reopen; also the arrow key's step. */
const reopenMargin = 16;

export interface SeparatorProps {
  side: ShellSide;
  /** The panel's name, lower-cased, for «Endre bredde på …». */
  name: string;
  /** What the panel is DRAWN at, which is what the reader moves. */
  width: number;
  range: WidthRange;
  /** `+1` when the panel grows toward the inline end. */
  direction: 1 | -1;
  /** True when floor, ceiling and width are one number: there is no edge to move. */
  fixed: boolean;
  folded: boolean;
  onResize: (width: number) => void;
  /** Back to the design's width. */
  onReset: () => void;
  /** A drag folded the panel, or brought it back. */
  onFold: (folded: boolean) => void;
  /** A drag that folds the panel keeps this element and its pointer capture until let go. */
  onDraggingChange: (dragging: boolean) => void;
}

/** The movable edge between a panel and the main column: drag, click (WCAG 2.5.7) or keys. */
export const Separator = ({
  side,
  name,
  width,
  range,
  direction,
  fixed,
  folded,
  onResize,
  onReset,
  onFold,
  onDraggingChange,
}: SeparatorProps) => {
  const t = useT();
  const [dragging, setDraggingState] = useState(false);
  /** Where the press started, the width then, and whether it travelled far enough to be a drag. */
  const origin = useRef({ x: 0, width: 0, moved: false });

  const setDragging = (next: boolean) => {
    setDraggingState(next);
    onDraggingChange(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // The main button, a touch or a pen; a right click is a menu, not a drag.
    if (event.button !== 0) return;
    // No text selection while dragging, so focus is moved here by hand for the arrow keys.
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { x: event.clientX, width, moved: false };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const travel = event.clientX - origin.current.x;
    if (Math.abs(travel) > clickSlop) origin.current.moved = true;
    const wanted = origin.current.width + direction * travel;
    // Past half its floor the panel folds instead of stopping there, as in VS Code.
    const line = range.min / 2;

    // The drag goes on after folding; back past the line it reopens at the floor.
    if (folded) {
      if (wanted < line + reopenMargin) return;
      onFold(false);
      onResize(wanted);
      return;
    }
    // Folded at the width the drag began with, so the panel reopens as the reader left it.
    if (wanted < line) {
      onResize(origin.current.width);
      onFold(true);
      return;
    }
    onResize(wanted);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  // A press that did not travel toggles between the widest allowed and the design's width.
  const onClick = () => {
    if (origin.current.moved) return;
    if (width < range.max) onResize(range.max);
    else onReset();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? widthStride : widthStep;
    // Home and End are about the value: Home is the narrowest the panel may be.
    const next = (() => {
      switch (event.key) {
        case 'ArrowLeft':
          return width - direction * step;
        case 'ArrowRight':
          return width + direction * step;
        case 'Home':
          return range.min;
        case 'End':
          return range.max;
        case 'Enter':
          event.preventDefault();
          onReset();
          return undefined;
        default:
          return undefined;
      }
    })();
    if (next === undefined) return;
    // Otherwise the arrows scroll and Home and End jump to the ends of the page.
    event.preventDefault();
    onResize(next);
  };

  // Not drawn with no edge to move, and never removed mid-drag.
  if (fixed && !dragging) return null;

  return (
    // A focusable separator is ARIA's splitter; an `<hr>` cannot take focus.
    <div
      aria-label={t('shell.resizePanel', { panel: name })}
      aria-orientation="vertical"
      aria-valuemax={range.max}
      aria-valuemin={range.min}
      // Folded mid-drag, the panel is a rail: hold the floor, and say it is hidden.
      aria-valuenow={folded ? range.min : width}
      aria-valuetext={folded ? t('shell.hidden') : t('shell.width', { width: String(width) })}
      className="uib-shell-separator ds-focus"
      data-dragging={dragging || undefined}
      data-side={side}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onLostPointerCapture={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      role="separator"
      // Always a tab stop: it is only there while there is something to do.
      tabIndex={0}
    />
  );
};
