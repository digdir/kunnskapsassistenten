import { use } from 'react';
import { PanelHeadContext, type PanelHeadContextValue } from './panelHeadContext';

/**
 * The shell's panel-head place for this slot, or undefined when the view is
 * mounted outside a shell — a preview page, most unit tests.
 *
 * No throw when the provider is missing, for the reason `useViewHead` gives:
 * this is somewhere to draw, not state a view is wrong to be without.
 */
export function usePanelHead(): PanelHeadContextValue | undefined {
  return use(PanelHeadContext);
}
