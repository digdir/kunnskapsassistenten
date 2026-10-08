import {
  filterDimensions,
  type FilterDimension,
  type FilterFacet,
  type FilterSelection,
} from '../../model';

/** One chosen value, and the dimension it narrows. */
export type ChosenValue = { dimension: FilterDimension; value: string };

/**
 * The chosen values that no field on screen can show.
 *
 * Every one of them while there are no facets — the list came back empty, or
 * the fetch failed before any arrived — and otherwise those of a dimension the
 * facets left out: the server drops a field with nothing in it
 * (server/facets.ts), and a filter stored on a thread may hold values in it
 * all the same. A field shows its own values as chips, so these are exactly
 * the ones that would otherwise be in force and out of sight.
 *
 * In the panel's dimension order, which is also the order of the «Avgrenset
 * til» line over an answer.
 */
export function valuesWithoutField(
  selection: FilterSelection,
  facets: FilterFacet[] | undefined,
): ChosenValue[] {
  return filterDimensions.flatMap((dimension) =>
    facets?.some((facet) => facet.dimension === dimension)
      ? []
      : selection[dimension].map((value) => ({ dimension, value })),
  );
}
