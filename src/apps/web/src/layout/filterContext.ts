import { createContext } from 'react';
import { filterDimensions, type FilterDimension, type FilterSelection } from '../model';

/** Every value a field has, by dimension, as the filter panel was given them. */
export type KnownValues = Partial<Record<FilterDimension, string[]>>;

/**
 * The document filter, held above the views.
 *
 * The filter view writes it and the chat view reads it — a question is asked
 * against the documents the user has narrowed to — so neither can own it. The
 * shell does, for the same reason it owns the active citation: two views that
 * must agree may never import each other.
 */
export type FilterContextValue = {
  /**
   * What questions are asked with: the lock while the thread on screen is
   * locked (see `locked`), and otherwise the reader's own choice without the
   * fields where every value is ticked (see `askedSelection`).
   */
  selection: FilterSelection;
  /** Sets the reader's own choice, which `chosen` then says. */
  setSelection: (selection: FilterSelection) => void;
  /**
   * What the reader has ticked, as the panel shows it: every tick, with no
   * lock in it. Differs from `selection` while a thread is locked and where
   * a field has every value ticked. Optional, so a test that builds the
   * context by hand need not say it; the panel falls back on `selection`.
   */
  chosen?: FilterSelection;
  /**
   * Said by the filter panel when its fields arrive: every value each field
   * has. Without it no field is known to be complete, and nothing is left out.
   */
  setKnownValues?: (known: KnownValues) => void;
  /**
   * The filter the thread on screen is locked to, when it is.
   *
   * The BFF keeps the filter a conversation was started with and asks every
   * later question in it with that, whatever the client sends
   * (`threadFilters` in its server.ts). A panel that let the reader change
   * the filter there would change nothing but the words on screen, so while
   * this is set the panel shows the lock instead, and `selection` above IS
   * the lock — which makes the question and the «Avgrenset til» line over its
   * answer right without either having to know.
   *
   * The reader's own choice is kept apart, untouched, and is back when they
   * leave the thread. Optional, so a test that builds the context by hand
   * need not say it.
   */
  locked?: FilterSelection;
  /** Said by the view holding a thread: what it is locked to, or undefined. */
  setLocked?: (filter: FilterSelection | undefined) => void;
};

export const FilterContext = createContext<FilterContextValue | undefined>(undefined);

/**
 * Whether two sets of known values say the same thing, dimension by dimension
 * and value by value, in order.
 */
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
 * The reader's choice as a question is asked with it: a field where every
 * value is ticked is left out.
 *
 * Every value is no narrowing at all, and sending it is worse than nothing.
 * KA CC measured it through the BFF: all 457 organisations went with the
 * question, and ten minutes later the answer was a 400 — headless-rag #15
 * takes 1 to 100 values per field. Left out, the question is asked of the
 * whole corpus, which is what «Alle 457 valgt, altså ingen avgrensning» in
 * the panel says it is.
 *
 * «Every value» is every value the panel was given for the field, compared
 * value by value and not by count, so a stale value from somewhere else
 * cannot make a field look complete. A field the panel has not been given is
 * never complete.
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
