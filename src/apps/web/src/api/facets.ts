import type { Facet } from '../../shared/facets.ts';
import { filterDimensions } from '../model';
import type { FacetValue, FilterFacet, FilterSelection } from '../model';
import type { DatasetFilterFields } from './filterFields';

/** «dokumenttyper» → «Dokumenttyper». The labels are nouns for a sentence. */
function capitalised(label: string): string {
  return label.charAt(0).toLocaleUpperCase('nb-NO') + label.slice(1);
}

/**
 * Facets in the generic format as the filter panel's dropdowns. The format is
 * the BFF's, and our own server answers in it too (server/facets.ts), so
 * bff and live both come through here.
 *
 * A facet whose field no dimension is mapped to is left out: the reader could
 * tick it, and nothing would carry the tick to the backend.
 *
 * The counts are the whole corpus's, from the BFF and from our server alike.
 * That is the right number for a dimension as long as nothing is ticked in
 * the OTHERS —
 * a dimension never narrows its own counts (`ChatClient.listFacets`). Once
 * something is, the whole-corpus number is not the answer to the question the
 * panel asks, so the count is left out and the panel draws none. Unknown is
 * honest; «Årsrapport (2874)» under a filter that leaves twelve is not.
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
