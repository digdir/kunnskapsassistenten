// `prefer-tag-over-role` wants an `<hr>`, which is a thematic break and cannot take focus; a
// focusable separator is ARIA's splitter. Disabled for the file, because a `disable-next-line`
// at the sorted `role` attribute breaks once an attribute is added above it.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import { widthStep, widthStride } from './resize';
import { useLayout } from './useLayout';
import { usePanelWidth } from './usePanelWidth';
import { slotLabel, type SidebarSlot } from './viewModel';

/** Pointer travel still counted as a click; 4 px is where Windows starts a drag (`SM_CXDRAG`). */
const CLICK_SLOP = 4;

// How far back past the fold line a drag must come to reopen the panel it folded, so a hand held
// still on the line does not make it blink. The arrow key's step.
const REOPEN_MARGIN = 16;

/**
 * The movable edge between an open panel and the answer column (Designsystemet has no splitter).
 * Drag, click (WCAG 2.5.7: no drag needed) or keys (2.1.1). A screen reader reads `aria-valuenow`
 * as the width; no live region, which would talk over it on every key.
 */
export function PanelSeparator({
  slot,
  onDraggingChange,
}: {
  slot: SidebarSlot;
  // Told when a drag starts and ends: a drag that folds the panel must keep this element and its
  // pointer capture until release, although a rail has no separator (Shell.tsx).
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const { layout, setCollapsed } = useLayout();
  const [dragging, setDraggingState] = useState(false);
  const folded = layout.slots[slot].collapsed;

  function setDragging(next: boolean) {
    setDraggingState(next);
    onDraggingChange?.(next);
  }
  /** Press start, its width, and whether the pointer moved far enough to be a drag. */
  const origin = useRef({ x: 0, width: 0, moved: false });

  // `width` is what the panel is DRAWN at, which is what the reader moves; the model may still
  // hold a wider number from a wider window (see `fittedWidths`).
  const { width, range, direction, fixed, setWidth: resize, reset } = usePanelWidth(slot);
  const label = slotLabel(layout, slot) ?? '';

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Left button and touch and pen; a right-click is a menu, not a drag.
    if (event.button !== 0) return;

    // Stops text selection on either side while the pointer travels (touch scrolling is stopped
    // by `touch-action: none` in the stylesheet). That also stops the default focus, so focus is
    // moved here by hand: the arrow keys should carry on from where the pointer let go.
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);

    origin.current = { x: event.clientX, width, moved: false };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const travel = event.clientX - origin.current.x;
    if (Math.abs(travel) > CLICK_SLOP) origin.current.moved = true;
    const wanted = origin.current.width + direction * travel;

    // Past half its floor the panel folds instead of stopping there, as in VS Code's split view:
    // too narrow to read is a state nobody wants (digdir/kunnskapsassistenten#80).
    const line = range.min / 2;

    // The drag goes on after folding; back past the line it reopens at the floor.
    if (folded) {
      if (wanted < line + REOPEN_MARGIN) return;
      setCollapsed(slot, false);
      resize(wanted);
      return;
    }

    // Fold at the width the drag began with, so the panel reopens as the reader left it.
    if (wanted < line) {
      resize(origin.current.width);
      setCollapsed(slot, true);
      return;
    }

    resize(wanted);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  // A press that did not travel toggles between the widest the window allows and the design's
  // width. On `click`, so a cancelled press does nothing; a drag also ends in a click, hence
  // `moved`.
  function onClick() {
    if (origin.current.moved) return;
    if (width < range.max) resize(range.max);
    else reset();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // `ArrowLeft`/`ArrowRight` are the platform's key names, the vendor exception to the naming
    // rule, not our words for a side; which panel grows is `growthDirection`'s business.
    const step = event.shiftKey ? widthStride : widthStep;

    const next = (() => {
      switch (event.key) {
        case 'ArrowLeft':
          return width - direction * step;
        case 'ArrowRight':
          return width + direction * step;
        // Home and End are about the VALUE, not the screen: Home is the narrowest this panel may
        // be, wherever it sits. That is what a screen reader reports and can act on.
        case 'Home':
          return range.min;
        case 'End':
          return range.max;
        case 'Enter':
          reset();
          event.preventDefault();
          return undefined;
        default:
          return undefined;
      }
    })();

    if (next === undefined) return;
    // Otherwise arrow keys scroll and Home/End jump to the end of the document.
    event.preventDefault();
    resize(next);
  }

  // Not drawn when floor, ceiling and width are one number: the grip and cursor would promise a
  // drag that cannot happen (the panel's own border still draws the edge). Never mid-drag, which
  // would drop the pointer capture and leave the drag with no end.
  if (fixed && !dragging) return null;

  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div
      aria-label={`Endre bredde på ${label.toLocaleLowerCase('nb-NO')}`}
      aria-orientation="vertical"
      aria-valuemax={range.max}
      aria-valuemin={range.min}
      /* Folded mid-drag the panel is a rail: hold the floor, and say it is hidden. */
      aria-valuenow={folded ? range.min : width}
      /* Without it `aria-valuenow` is read as a bare number. */
      aria-valuetext={folded ? 'Skjult' : `${width} piksler`}
      className="panel-separator ds-focus"
      data-before-main={direction === 1 || undefined}
      data-dragging={dragging || undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onLostPointerCapture={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      role="separator"
      /* Always a tab stop: the element only exists while there is something to do. */
      tabIndex={0}
    />
  );
}
