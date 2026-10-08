// Shared by `FacetField` and `YearRangeField`, so each component file only exports components.

/** Norwegian screen reader texts: Designsystemet 1.21.0 leaves u-combobox's texts for the
    selected values in English even with `lang="nb"`. Keys are u-combobox's observed attributes
    (`TEXTS` in @u-elements/u-combobox); an empty value falls back to English. */
export const SCREEN_READER_TEXTS = {
  'data-sr-items': 'Valgte verdier',
  'data-sr-empty': 'Ingen verdier er valgt',
  'data-sr-found': '%d valgt, naviger bakover for å endre',
  'data-sr-added': 'Lagt til',
  'data-sr-removed': 'Fjernet',
  'data-sr-invalid': 'Ugyldig verdi',
  'data-sr-of': 'av',
};

/** The most values per field: headless-rag takes 1 to 100, and the BFF answers more with
    `400 filter-too-many-values`. Told before the question rather than as an error after it. */
export const MAX_VALUES_PER_FIELD = 100;
