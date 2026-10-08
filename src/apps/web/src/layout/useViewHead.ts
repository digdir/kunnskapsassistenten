import { use } from 'react';
import { ViewHeadContext, type ViewHeadContextValue } from './viewHeadContext';

/**
 * The shell's view-head place for this slot, or undefined outside a shell (a preview page, most
 * unit tests). Does not throw: this is somewhere to draw, not state a view needs. Views use
 * `ViewHead`; this is for one that needs to know whether the place exists.
 */
export function useViewHead(): ViewHeadContextValue | undefined {
  return use(ViewHeadContext);
}
