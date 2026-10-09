import {
  filterDimensions,
  type FilterDimension,
  type FilterFacet,
  type FilterSelection,
} from '../../model';

/** One chosen value, and the dimension it narrows. */
export type ChosenValue = { dimension: FilterDimension; value: string };

/** The chosen values no field on screen can show, in the panel's dimension order: all of them
    without facets, else those of a dimension the server dropped for being empty
    (server/facets.ts), which a stored filter may still hold. */
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
