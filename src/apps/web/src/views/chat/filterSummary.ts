import type { FilterDimension, FilterSelection } from '../../model';

/**
 * «Avgrenset til: Årsrapport · 2023» — what the answer above it was asked
 * against.
 *
 * A facet value is the word the reader ticked: `facetsFor` in
 * src/api/mock/corpus/facets.ts builds the dropdowns from the corpus and sets
 * `value` and `label` to the same string. So there is nothing to look up, and
 * this stays a pure function of the selection. The day the backend hands out
 * ids of its own (API-bestilling A2), this is where the lookup goes, and the
 * line will need the facets to do it.
 */

/** Dimensions in the order the filter panel lists them. */
const DIMENSION_ORDER: FilterDimension[] = ['documentType', 'organisation', 'year'];

/** The line over an answer, or undefined when nothing was narrowed. */
export function filterSummaryText(selection: FilterSelection): string | undefined {
  const chosen = DIMENSION_ORDER.flatMap((dimension) => selection[dimension]);
  return chosen.length === 0 ? undefined : chosen.join(' · ');
}

/**
 * The line over one answer: what it was narrowed to, and where it came from.
 *
 * Two different facts, so they are drawn as two: the facets are what the
 * READER ticked, the corpus is where the answer was retrieved. Running them
 * into one list made «Kudos · Årsrapport · 2023» read as three things the
 * reader had chosen, and one of them was not (KA CC kan 4 på #138).
 *
 * The chat column drew no corpus name at all until now, and for one corpus it
 * should not: a word that never varies over every answer is a word without
 * information in it. It is named in exactly one case, and that is the case
 * this exists for — an answer retrieved from somewhere other than where the
 * chooser stands now, which is what an old thread opened from the list is.
 *
 * `answerCorpusName` is looked up from the ANSWER's key, never from the
 * choice. A name read from the chooser would be the bug wearing the fix's
 * clothes.
 */
export function answerScopeText(
  selection: FilterSelection,
  answerCorpusName?: string,
): string | undefined {
  const narrowed = filterSummaryText(selection);
  if (narrowed && answerCorpusName) return `Avgrenset til: ${narrowed}, fra ${answerCorpusName}`;
  if (narrowed) return `Avgrenset til: ${narrowed}`;
  // Nothing was narrowed, so «avgrenset» would be the wrong word: the answer
  // was asked of the whole of another corpus.
  return answerCorpusName ? `Hentet fra ${answerCorpusName}` : undefined;
}
