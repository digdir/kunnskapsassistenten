import type { FilterDimension } from '../../shared/filterFields.ts';

// In shared/ because the server counts facets by them too (server/facets.ts). Re-exported so
// every view still reads them from the model.
export { filterDimensions, type FilterDimension } from '../../shared/filterFields.ts';

/** One selectable value inside a dimension. */
export interface FacetValue {
  /** Stable key sent to the backend. Not shown to the user. */
  value: string;
  /** Norwegian, shown to the user: «Årsrapport», «Advokattilsynet», «2024». */
  label: string;
  /** Matches given the other selections: «Årsrapport (1032)». Undefined: unknown, not shown. */
  count?: number;
}

/** One dropdown: a dimension with its values. */
export interface FilterFacet {
  dimension: FilterDimension;
  /** Norwegian, the field label. */
  label: string;
  values: FacetValue[];
}

/**
 * What the user has selected, per dimension. Values are {@link FacetValue.value}.
 * An empty array means «no restriction on this dimension», never «nothing».
 */
export type FilterSelection = Record<FilterDimension, string[]>;

export const emptyFilterSelection: FilterSelection = {
  documentType: [],
  organisation: [],
  year: [],
};

/** True when nothing is selected in any dimension. */
export function isEmptySelection(selection: FilterSelection): boolean {
  return Object.values(selection).every((values) => values.length === 0);
}
