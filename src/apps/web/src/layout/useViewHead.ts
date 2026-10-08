import { use } from 'react';
import { ViewHeadContext, type ViewHeadContextValue } from './viewHeadContext';

/**
 * The shell's view-head place for this slot, or undefined when this view is
 * mounted outside a shell — a preview page, most unit tests.
 *
 * No throw when the provider is missing, unlike `useCitation` and
 * `useFilterSelection`. Those are state a view is wrong to be without; this
 * is somewhere to draw, and a view standing on its own is right to have
 * nowhere. `ViewHead` is what views use; this is for a view that needs to
 * know whether the place is there at all.
 */
export function useViewHead(): ViewHeadContextValue | undefined {
  return use(ViewHeadContext);
}
