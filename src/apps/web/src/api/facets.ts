import type { Facet } from '../../shared/facets.ts';
import { filterDimensions } from '../model';
import type { FacetValue, FilterFacet, FilterSelection } from '../model';
import type { DatasetFilterFields } from './filterFields';

/** «dokumenttyper» → «Dokumenttyper». The labels are nouns for a sentence. */
function capitalised(label: string): string {
  return label.charAt(0).toLocaleUpperCase('nb-NO') + label.slice(1);
}

/**
 * Generic facets (the BFF's format, and server/facets.ts's) as dropdowns, mapped
 * dimensions only. Counts are whole-corpus, so they are dropped once another
 * dimension is narrowed: no count beats a wrong one.
 */
export function facetsFrom(
  facets: Facet[],
  fields: DatasetFilterFields | undefined,
  selection?: FilterSelection,
): FilterFacet[] {
  if (!fields) return [];

  return filterDimensions.flatMap((dimension) => {
    const field = fields[dimension]?.field;
    const facet = facets.find((candidate) => candidate.field === field);
    if (!facet) return [];

    const narrowedElsewhere = filterDimensions.some(
      (other) => other !== dimension && (selection?.[other]?.length ?? 0) > 0,
    );
    const values: FacetValue[] = facet.options.map((option) => ({
      value: option.value,
      label: option.value,
      ...(narrowedElsewhere ? {} : { count: option.count }),
    }));
    return [{ dimension, label: capitalised(facet.label), values }];
  });
}
