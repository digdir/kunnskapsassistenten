import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePanelHead } from './usePanelHead';

export type PanelHeadProps = {
  /** What belongs on the panel's own row, beside the collapse button. */
  children: ReactNode;
};

/**
 * What this view wants on the panel's head row, beside «Skjul …».
 *
 * For controls that belong to the PANEL rather than to what is in it — the
 * «Tråder» button is the one that asked for it. Anything that belongs to the
 * content goes in `ViewHead` instead, which pins to the top of the scrolling
 * region; see panelHeadContext.ts for why the two are different places.
 *
 * **Nothing is drawn when there is no place.** Unlike `ViewHead`, which falls
 * back to drawing itself where it stands, this one draws nothing outside a
 * shell and nothing on a rail. The fallback is right for the view head: a
 * preview page showing a panel without its pinned head would lie about the
 * panel. It is wrong here, because what this holds is the SHELL's chrome —
 * a «Tråder» button loose in the middle of a preview would be a control in a
 * place the real app never puts it.
 *
 * One `PanelHead` per view, for the reason `ViewHead` gives: two in one view
 * is a view putting two things in one place rather than one thing with two
 * children.
 */
export function PanelHead({ children }: PanelHeadProps) {
  const place = usePanelHead();

  // No shell, or a rail with no room for a second control. Both are «there is
  // nowhere to put this», and neither is a reason to put it somewhere else.
  if (place?.element == null) return null;

  return createPortal(children, place.element);
}
