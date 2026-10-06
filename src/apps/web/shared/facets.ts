/**
 * Facets in the generic format from src/decisions/0004, which is also the
 * one Nikolai's BFF answers `GET /api/facets` with (src/api/bff/contract.ts).
 *
 * The contract between whoever counts the facets and the client that draws
 * them. Today our own server counts them from Typesense (server/facets.ts);
 * the day the backend can, the source changes behind this shape and the
 * client does not.
 */

export interface FacetOption {
  value: string;
  count: number;
}

export interface Facet {
  /** The corpus's own field name, as in `VITE_KA_FILTER_FIELDS`. */
  field: string;
  /** Norwegian noun in lower case, for a sentence: «dokumenttyper», «år». */
  label: string;
  options: FacetOption[];
}
