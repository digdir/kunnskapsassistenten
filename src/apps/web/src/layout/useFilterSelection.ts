import { use } from 'react';
import { FilterContext, type FilterContextValue } from './filterContext';

/** The document filter. See filterContext.ts for why the shell holds it. */
export function useFilterSelection(): FilterContextValue {
  const value = use(FilterContext);
  if (!value) {
    throw new Error('useFilterSelection må brukes inne i en LayoutProvider.');
  }
  return value;
}
