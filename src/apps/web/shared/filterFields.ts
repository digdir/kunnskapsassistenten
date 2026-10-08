/**
 * The grammar of `VITE_KA_FILTER_FIELDS`, shared by the client and the server.
 *
 * Shared and not copied: the client reads the variable to put a filter on the
 * wire, and the server reads the same variable to count the facets
 * (server/facets.ts). Two parsers would be two grammars, and the day they
 * disagreed a dataset would filter on one field and count another.
 *
 * No imports and nothing from either environment, because both run it: the
 * client through Vite, the server as plain Node in the container, which has
 * `shared/` and `server/` and no `src/` (Dockerfile). Why the translation is
 * configuration and not code is in src/api/filterFields.ts.
 */

/**
 * The three filter dimensions the design draws, as three multi-select
 * dropdowns: «Dokumenttyper», «Virksomheter», «År».
 */
export type FilterDimension = 'documentType' | 'organisation' | 'year';

/**
 * The three, in the order the design draws them.
 *
 * A `Record<FilterDimension, …>` has whatever key order the object was built
 * with, and anything that walks a selection to put it on the wire would then
 * send the dimensions in one order here and another there. One list, so the
 * order is a stated thing rather than a side effect of how a test wrote its
 * literal.
 */
export const filterDimensions: readonly FilterDimension[] = [
  'documentType',
  'organisation',
  'year',
];

/** One dimension, as one corpus names it. */
export type FilterFieldMapping = {
  /** The corpus's own field name, spelled as the backend's filter expects it. */
  field: string;
  /**
   * `value-type` on the wire, for a field that is not text.
   *
   * Measured by the conductor against the whole Kudos corpus 2026-09-24:
   * `concerned_years = 2024` WITHOUT it gives 0 hits, because Typesense
   * refuses a quoted number on a numeric field. So it is required for year,
   * not decoration.
   *
   * One of `KNOWN_VALUE_TYPES`, and nothing else gets through.
   */
  valueType?: string;
};

/** One dataset's field names. A missing dimension is one that is not sent. */
export type DatasetFilterFields = Partial<Record<FilterDimension, FilterFieldMapping>>;

/** Every dataset this deployment knows the field names of, by dataset key. */
export type FilterFieldConfig = Record<string, DatasetFilterFields>;

/** The dimensions, as a set, for telling a name from a typo. */
const KNOWN_DIMENSIONS = new Set<string>(filterDimensions);

/**
 * The value types the backend actually tells apart, and the reason there are
 * only two.
 *
 * `format-filter-value` in server/src/digdir/rag/filters.cljc compares the
 * type BY NAME against the one string `"integer"`; everything else — a type
 * it has never heard of as much as `string` itself — falls through to
 * backtick-quoting the value, which is string behaviour.
 *
 * So a misspelt `integr` is not rejected over there. It is quietly treated as
 * a string, Typesense is handed a quoted number on a numeric field, and the
 * reader gets 0 hits for a question the corpus can answer — the exact silent
 * failure this whole round has been about (KA CC on #164). The typo has to be
 * caught here, because the only place downstream that could catch it does
 * not.
 *
 * Exact spelling, lower case, as the backend compares it. A type in the wrong
 * case is a typo too, and the honest thing is to say so rather than to repair
 * it and hope.
 */
const KNOWN_VALUE_TYPES = new Set(['integer', 'string']);

/**
 * `"kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer"`
 *
 * Semicolons between datasets and the first `=` after the dataset key, as in
 * `VITE_KA_DATASETS` — the two variables describe the same datasets and
 * should not need two grammars learnt. Inside one dataset: `|` between
 * dimensions, and `:` inside a dimension, as
 * `dimension:field` or `dimension:field:value-type`.
 *
 * Neither a dataset key, a dimension name, a field name nor a value type has
 * ever held any of those four characters: the first two are ours, and the
 * last two are Typesense identifiers and type names. Unlike the corpus label,
 * none of this is a human sentence, so there is nothing here to protect from
 * the separators.
 *
 * Whitespace around every part is trimmed, so the variable can be written
 * across lines in a compose file.
 *
 * Dropped rather than thrown, one warning for the lot:
 * - a dataset with no `=`, or an empty key
 * - a dimension that is not one of the three (a typo would otherwise be a
 *   filter that silently never reached the backend)
 * - a mapping with no field name
 * - a value type the backend does not tell apart — see `KNOWN_VALUE_TYPES`
 * - a dataset key, or a dimension inside one dataset, written twice
 * - a dataset left with no valid dimension at all, which says nothing that
 *   an absent entry does not
 *
 * First wins for a repeat, for the reason corpus.ts gives: one thing written
 * twice is a mistake, and picking the later one silently is not more right
 * than picking the earlier one loudly. The one written second is what the
 * warning names, because it is the one that did not take effect.
 */
export function parseFilterFields(raw: string | undefined): FilterFieldConfig {
  if (!raw?.trim()) return {};

  const config: FilterFieldConfig = {};
  const dropped: string[] = [];

  for (const entry of raw.split(';')) {
    if (!entry.trim()) continue;

    const split = entry.indexOf('=');
    const key = (split === -1 ? entry : entry.slice(0, split)).trim();
    const rest = split === -1 ? '' : entry.slice(split + 1);

    if (!key || split === -1) {
      dropped.push(entry.trim());
      continue;
    }
    if (config[key]) {
      dropped.push(entry.trim());
      continue;
    }

    const fields: DatasetFilterFields = {};
    for (const mapping of rest.split('|')) {
      if (!mapping.trim()) continue;

      const [dimension = '', field = '', valueType = ''] = mapping.split(':').map((p) => p.trim());
      if (!KNOWN_DIMENSIONS.has(dimension) || !field) {
        dropped.push(mapping.trim());
        continue;
      }
      // Dropped whole rather than kept without the type: a mapping stripped
      // of its `integer` is a filter that quietly finds nothing, which is
      // the failure being guarded against. Not filtering on that dimension
      // is the wrong answer too, but it is a loud one.
      if (valueType && !KNOWN_VALUE_TYPES.has(valueType)) {
        dropped.push(mapping.trim());
        continue;
      }

      const named = dimension as FilterDimension;
      if (fields[named]) {
        dropped.push(mapping.trim());
        continue;
      }
      fields[named] = { field, ...(valueType ? { valueType } : {}) };
    }

    // A dataset whose every mapping was dropped is the same as no dataset:
    // keeping the empty shell would only make `filterFieldsFor` answer with
    // an object that translates nothing.
    if (Object.keys(fields).length === 0) {
      dropped.push(key);
      continue;
    }

    config[key] = fields;
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) eller gjentatt(e) oppføring(er) ` +
        `i VITE_KA_FILTER_FIELDS. ` +
        `Formatet er "datasett=dimensjon:felt|dimensjon:felt:verditype;…", ` +
        `der dimensjonen er ${filterDimensions.join(', ')} ` +
        `og verditypen ${[...KNOWN_VALUE_TYPES].join(' eller ')}. ` +
        `Hoppet over: ${dropped.join(', ')}`,
    );
  }

  return config;
}
