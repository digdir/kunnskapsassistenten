import { createContext } from 'react';
import { filterDimensions, type FilterDimension, type FilterSelection } from '../model';

/** Every value a field has, by dimension, as the filter panel was given them. */
export type KnownValues = Partial<Record<FilterDimension, string[]>>;

/**
 * The document filter, held above the views. The filter view writes it and the chat view reads
 * it, and two views that must agree may not import each other, so the shell owns it.
 */
export type FilterContextValue = {
  /** What questions are asked with: the lock if any, otherwise `askedSelection` of `chosen`. */
  selection: FilterSelection;
  /** Sets the reader's own choice, which `chosen` then says. */
  setSelection: (selection: FilterSelection) => void;
  /** Every tick the reader made, without the lock; when unset the panel uses `selection`. */
  chosen?: FilterSelection;
  /** Every value each field has, from the panel; without it no field counts as complete. */
  setKnownValues?: (known: KnownValues) => void;
  // The filter the thread on screen is locked to. The BFF asks every later question in a thread
  // with its first filter (`threadFilters` in its server.ts), so the panel shows the lock and
  // `selection` IS the lock. The reader's own choice returns when they leave the thread.
  locked?: FilterSelection;
  /** Said by the view holding a thread: what it is locked to, or undefined. */
  setLocked?: (filter: FilterSelection | undefined) => void;
};

export const FilterContext = createContext<FilterContextValue | undefined>(undefined);

/** Whether two sets of known values match, dimension by dimension and value by value. */
export function sameKnownValues(a: KnownValues, b: KnownValues): boolean {
  return filterDimensions.every((dimension) => {
    const left = a[dimension];
    const right = b[dimension];
    if (left === right) return true;
    if (!left || !right || left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  });
}

/**
 * The reader's choice as a question is asked with it: a field with every value ticked is left
 * out, since it narrows nothing and headless-rag takes at most 100 values per field
 * (digdir/digdir-headless-rag#15). Compared value by value with what the panel was given.
 */
export function askedSelection(chosen: FilterSelection, known: KnownValues): FilterSelection {
  let changed = false;
  const asked = { ...chosen };
  for (const dimension of filterDimensions) {
    const all = known[dimension];
    if (!all || all.length === 0 || chosen[dimension].length === 0) continue;
    const ticked = new Set(chosen[dimension]);
    if (all.every((value) => ticked.has(value))) {
      asked[dimension] = [];
      changed = true;
    }
  }
  return changed ? asked : chosen;
}
