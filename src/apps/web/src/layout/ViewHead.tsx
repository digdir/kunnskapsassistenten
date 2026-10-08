import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useViewHead } from './useViewHead';

export type ViewHeadProps = {
  /** What stays put while the rest of the region scrolls. */
  children: ReactNode;
};

/**
 * What this view wants pinned to the top of its scrolling region.
 *
 * The view writes it where it belongs in its own tree, and it is drawn in the
 * shell's box at the top of the region. Two things follow from the portal,
 * and both are the point:
 *
 *   1. **Nothing focusable ends up above the pinned head.** That is the whole
 *      reason the shell owns the place; see viewHeadContext.ts for the
 *      measurement. A view can put its own «Tråder» button in here and it
 *      stays reachable, because it is IN the head rather than under it.
 *   2. **The tab order does not move.** React sends events through the portal
 *      along the React tree, but the browser tabs the DOM — so a head written
 *      at the top of a view and drawn at the top of the region is in the same
 *      place both ways round. Write it anywhere else in the view and it is
 *      not; that is a reason to write it first, not a reason to avoid the
 *      portal.
 *
 * Outside a shell — the preview pages, most unit tests — the head is drawn
 * where it stands, in a box with the same class. Those have no scrolling
 * region to pin to, and a head that vanished when the view was mounted on its
 * own would make every preview lie about the panel.
 *
 * One head per slot. Two views in one slot are modes of one panel and only
 * one of them is mounted, so they cannot collide; two `ViewHead`s in the same
 * view would, and that is a view putting two things in one place rather than
 * one thing with two children.
 */
export function ViewHead({ children }: ViewHeadProps) {
  const place = useViewHead();

  // No shell around this view.
  if (place === undefined) return <div className="view-head">{children}</div>;

  /*
   * A shell, whose box has not been mounted yet. Nothing, for one render: the
   * ref callback that fills it in runs during the same commit and the state
   * it sets is flushed before the browser paints, so this is a render and not
   * a frame. Drawing the fallback here instead would put a second
   * `.view-head` in the panel for that render, which is one too many for
   * anything that counts them.
   */
  if (place.element === null) return null;

  return createPortal(children, place.element);
}
