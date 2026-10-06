/*
 * `prefer-tag-over-role` wants an `<hr>` wherever `role="separator"` appears,
 * and an `<hr>` is the wrong element here twice over: it is a thematic break
 * between pieces of content, and it cannot hold a tab stop. ARIA 1.2 calls a
 * separator WITH a tab stop the splitter — the resizable one — and that is
 * the whole of what this file builds.
 *
 * The file rather than the line: the rule reports the `role` attribute, which
 * sits in the middle of a sorted attribute list, and a `disable-next-line`
 * pinned there stops working the next time an attribute is added above it.
 */
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

/**
 * How far the pointer may travel between press and release and still count
 * as a click. A hand on a trackpad moves a pixel or two without meaning to,
 * and 4 px is where Windows starts a drag (`SM_CXDRAG`).
 */
const CLICK_SLOP = 4;

/**
 * How far back past the fold line a drag has to come before a panel it folded
 * opens again. Issue 80, round 2: the drag goes on after the fold, and
 * dragging back toward the answer column opens the panel before the pointer is
 * let go.
 *
 * The same line both ways, so the panel is open whenever the pointer is on the
 * panel's side of it and folded whenever it is not, and the reader can tell
 * which from where their hand is. The 16 px are there only so a hand holding
 * still on the line does not make the panel blink. It is the arrow key's step,
 * and short beside the 200 px (navigation panel) and 168 px (sources panel)
 * from the floor to the line, so coming back is short too.
 */
const REOPEN_MARGIN = 16;

/**
 * The edge between an open panel and the answer column, which the reader can
 * move.
 *
 * Designsystemet has no splitter and no resize handle — checked against the
 * 1.21.0 export list, and written up in
 * design/designsystemet/behov-til-komponent.md — so this is our own, and it
 * gets semantics and a keyboard from the first commit rather than from a
 * follow-up. WCAG 2.5.7 asks that anything a pointer drags can be done
 * without dragging; WCAG 2.1.1 asks that it can be done from the keyboard at
 * all.
 *
 * The pointer path without a drag is a click on the edge itself: it moves the
 * edge between the width the design draws and the widest the window has room
 * for. It used to be two arrow buttons in the panel head, which were asked
 * removed (issue 81); a click here keeps 2.5.7 without them,
 * and without a second control for the same edge. The conductor's option A,
 * 30.09.
 *
 * `role="separator"` with a tab stop is the splitter role: a screen reader
 * announces it, reads `aria-valuenow` as the panel's width in pixels, and
 * says how far it can go. No live region — the value is the announcement, and
 * a second one saying the same thing on every arrow key would talk over the
 * reader.
 *
 * Both edges use one component and the direction is read off the model, in
 * `growthDirection`. A panel that sits before the answer column grows as the
 * pointer moves toward the inline end, one that sits after it shrinks, and
 * neither fact is written down per slot.
 */
export function PanelSeparator({
  slot,
  onDraggingChange,
}: {
  slot: SidebarSlot;
  /**
   * Told when a drag starts and when it ends. The slot draws no separator on
   * a rail, and a drag that folds the panel has to keep this element, and the
   * pointer capture on it, until the pointer is let go. Shell.tsx.
   */
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const { layout, setCollapsed } = useLayout();
  const [dragging, setDraggingState] = useState(false);
  const folded = layout.slots[slot].collapsed;

  function setDragging(next: boolean) {
    setDraggingState(next);
    onDraggingChange?.(next);
  }
  /**
   * Where the press started, the width it started from, and whether the
   * pointer has travelled far enough since for it to be a drag rather than a
   * click.
   */
  const origin = useRef({ x: 0, width: 0, moved: false });

  // The edge, and everything that can move it. See usePanelWidth.ts.
  //
  // `width` is what the panel is DRAWN at, which is what the reader is
  // moving; the model may still be holding a wider number it asked for in a
  // wider window. See `fittedWidths`.
  const { width, range, direction, fixed, setWidth: resize, reset } = usePanelWidth(slot);
  const label = slotLabel(layout, slot) ?? '';

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Left button and touch and pen; a right-click is a menu, not a drag.
    if (event.button !== 0) return;

    // Stops the browser selecting the text on either side while the pointer
    // travels over it, and stops a touch drag from scrolling the page with
    // the `touch-action: none` in the stylesheet. Focus is then ours to move,
    // and it goes here: the reader has just taken hold of this control, and
    // the arrow keys should carry on from where they let go.
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

    /*
     * Dragged past the middle of its own floor, the panel folds away instead
     * of stopping at the floor. Issue 80: a panel narrower than its
     * content can be read in is a state nobody wants, so the edge does not
     * stop in one; it either holds the floor or the panel goes. Half the
     * floor is where VS Code's split view snaps a view shut, and it keeps
     * the two apart: the pointer has to go 200 px past the floor of the
     * navigation panel, and 168 past the sources panel's, so a drag that
     * only overshoots the floor a little still just stops there.
     *
     * The width goes back to what it was when the drag began, so the panel
     * opens again as the reader left it and not at the floor the drag was
     * pressed against on the way. The pointer path for this without a drag
     * is the collapse button, which is what WCAG 2.5.7 asks.
     *
     * The drag does not end there (issue 80, round 2). The slot keeps
     * this element while the pointer is held, over the rail, and the panel
     * opens again once the pointer is back REOPEN_MARGIN past the same line.
     * It opens where the pointer says, which is the floor, and follows the
     * pointer from there. Let go while folded, the element goes, and the
     * slot sends the focus to its toggle button (Shell.tsx).
     */
    const line = range.min / 2;

    if (folded) {
      if (wanted < line + REOPEN_MARGIN) return;
      setCollapsed(slot, false);
      resize(wanted);
      return;
    }

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

  /*
   * A press that did not travel: the edge goes to the widest this window has
   * room for, or back to the design's width if it is already there.
   *
   * Two widths and not a step, because a click is one decision and should
   * land somewhere the reader can predict — «as wide as it goes», «as it
   * was» — rather than 16 px along, which is the keyboard's job. `reset` is
   * the design's width, and also forgets the stored one.
   *
   * On `click` rather than on `pointerup`, so a press that slides off and is
   * cancelled does nothing. A drag ends in a click too, on the element with
   * the capture, which is what `moved` is for.
   */
  function onClick() {
    if (origin.current.moved) return;
    if (width < range.max) resize(range.max);
    else reset();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // `ArrowLeft` and `ArrowRight` are the platform's names for two keys on
    // the keyboard, like `padding-inline-start` is CSS's name for a side.
    // They are the vendor exception to the naming rule, not our own words for
    // a side of the screen: what they mean here is «move the edge that way»,
    // and which panel grows is `growthDirection`'s business.
    const step = event.shiftKey ? widthStride : widthStep;

    const next = (() => {
      switch (event.key) {
        case 'ArrowLeft':
          return width - direction * step;
        case 'ArrowRight':
          return width + direction * step;
        // Home and End are about the VALUE and not about the screen: Home is
        // the narrowest this panel may be, wherever on the row it sits. That
        // is what a screen reader reports, and it is the only one of the two
        // readings a reader who cannot see the edge can act on.
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
    // Arrow keys scroll and Home/End jump to the end of the document. The
    // reader is resizing a panel, not leaving it.
    event.preventDefault();
    resize(next);
  }

  /*
   * Not drawn at all when the window has nothing to give: floor, ceiling and
   * the width on screen are one number, so every key and every drag on this
   * edge does nothing.
   *
   * PR #50 kept it, out of the tab order and `aria-disabled`, on the argument
   * that the line is the edge and removing it would remove the boundary too.
   * The line is not this element: the panel's own `border-inline-end` draws
   * the edge, and `.panel-separator::before` only lights up under the pointer,
   * under focus and while dragging — none of which can happen here. So what
   * goes is the grip and the `col-resize` cursor over it, both of which
   * promised a drag this window cannot deliver. The boundary stays.
   *
   * Brukerblikk 3, funn 2, decision 9 option (c) on 17.09. It is the state
   * at 1440 × 900 with both sidebars open — the width every Figma frame is
   * drawn in — so it is not a corner case.
   *
   * It comes back when the window grows, through `useViewportWidth`.
   *
   * Never mid-drag: returning nothing would take the pointer capture with it
   * and leave the drag with no end.
   */
  if (fixed && !dragging) return null;

  return (
    // The rule wants an `<hr>` for anything with `role="separator"`, and an
    // `<hr>` is the wrong element here twice: it is a thematic break between
    // pieces of content, and it cannot be focused. ARIA 1.2 says a separator
    // WITH a tab stop is the splitter — the resizable one — and that is the
    // whole of what this element is.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div
      aria-label={`Endre bredde på ${label.toLocaleLowerCase('nb-NO')}`}
      aria-orientation="vertical"
      aria-valuemax={range.max}
      aria-valuemin={range.min}
      /*
        Folded mid-drag, the panel is drawn as a 67 px rail, below the floor
        the value may not leave. The value holds the floor and the text says
        what is true, which is that the panel is not there.
      */
      aria-valuenow={folded ? range.min : width}
      /*
        A separator carries no unit a screen reader can guess, so
        `aria-valuenow` on its own is read as a bare number. This is the one
        attribute that says what the number is. KA CC, reviewing PR #50.
      */
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
      /*
        Always a tab stop, because this element only exists while there is
        something to do with it. The window with no room in it takes the whole
        control away rather than leaving a silent one; see the `fixed` return
        above.
      */
      tabIndex={0}
    />
  );
}
