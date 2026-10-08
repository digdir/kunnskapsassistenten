import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePanelHead } from './usePanelHead';

export type PanelHeadProps = {
  /** What belongs on the panel's own row, beside the collapse button. */
  children: ReactNode;
};

/**
 * What this view wants on the panel's head row, beside «Skjul …»: controls that belong to the
 * PANEL, not its content (content goes in `ViewHead`). Draws nothing outside a shell or on a
 * rail, because this is the shell's chrome and has no place in a preview. One per view.
 */
export function PanelHead({ children }: PanelHeadProps) {
  const place = usePanelHead();

  if (place?.element == null) return null;

  return createPortal(children, place.element);
}
