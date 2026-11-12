/** One value a field can take, as the platform's facets give it (`/api/facets`, `options[]`). */
export interface FilterOption {
  /** What the filter holds and sends. */
  value: string;
  /** What the reader sees. The value when absent. */
  label?: string | undefined;
  /** Documents with this value, given the other fields; not shown when absent. */
  count?: number | undefined;
}

/** One field: a dataset's filter field (`/api/datasets/{id}`, `filters[]`) with its facet values. */
export interface FilterField {
  /** The dataset's field id, as in `filters[].field`. */
  id: string;
  /** The field's name as a plural noun, «Dokumenttyper». It is lower-cased inside sentences. */
  label: string;
  /** The field's name over its row in the `panel` variant, in the singular: «Dokumenttype». */
  heading?: string | undefined;
  /** `year` lets `yearPeriods` draw the field as periods. */
  kind?: 'year' | undefined;
  options: readonly FilterOption[];
}

/** What the reader chose, per field id; an empty or absent list narrows nothing. */
export type FilterSelection = Readonly<Record<string, readonly string[]>>;
