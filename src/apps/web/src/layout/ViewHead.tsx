import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useViewHead } from './useViewHead';

export type ViewHeadProps = {
  /** What stays put while the rest of the region scrolls. */
  children: ReactNode;
};

/**
 * What this view wants pinned to the top of its scrolling region, portalled into the shell's box
 * so nothing focusable sits above the pinned head. Write it first in the view, so the tab order
 * (which follows the DOM) does not change. Outside a shell it is drawn in place. One per view.
 */
export function ViewHead({ children }: ViewHeadProps) {
  const place = useViewHead();

  if (place === undefined) return <div className="view-head">{children}</div>;

  // A shell whose box is not mounted yet: draw nothing for this one render (the box is filled in
  // the same commit, before paint). The fallback here would briefly add a second `.view-head`.
  if (place.element === null) return null;

  return createPortal(children, place.element);
}
