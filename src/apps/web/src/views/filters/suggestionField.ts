/**
 * What the two filter fields share: `FacetField` and, behind the
 * `year-ranges` flag, `YearRangeField`. Here and not in either component file,
 * so each file only exports components.
 */

/**
 * Norwegian screen reader strings for the multi-select.
 *
 * Measured, not guessed: with `lang="nb"` and Designsystemet 1.21.0, only the
 * clear and toggle buttons get Norwegian names. Everything u-combobox writes
 * for the selected values stays English — the chip container is announced as
 * «Selected», the input's `aria-description` as «No selected», and a chip as
 * «…, Press to remove». In a service that has to be Norwegian all the way
 * into the accessible names, that is a defect, not a detail.
 *
 * `data-sr-*` is u-combobox's own override: the keys are its observed
 * attributes, and an empty value falls back to the English default. See
 * @u-elements/u-combobox, `TEXTS` and `observedAttributes`.
 */
export const SCREEN_READER_TEXTS = {
  'data-sr-items': 'Valgte verdier',
  'data-sr-empty': 'Ingen verdier er valgt',
  'data-sr-found': '%d valgt, naviger bakover for å endre',
  'data-sr-added': 'Lagt til',
  'data-sr-removed': 'Fjernet',
  'data-sr-invalid': 'Ugyldig verdi',
  'data-sr-of': 'av',
};

/**
 * The most values one field can be narrowed to.
 *
 * The backend's rule and not ours: headless-rag #15 takes 1 to 100 values per
 * field, and the BFF answers more with `400 filter-too-many-values` instead of
 * cutting the list without a word, as it used to
 * (design/_briefs/bygg/form-d16-filtre-2026-09-29.md). The reader is told
 * here, before the question, rather than by an error after it.
 */
export const MAX_VALUES_PER_FIELD = 100;
