import type { FilterDimension, FilterSelection } from '../../model';

// A facet value IS the word the reader ticked today, so there is nothing to
// look up. The day the backend hands out ids of its own (API-bestilling A2),
// the lookup goes here and the line will need the facets to do it.

/** Dimensions in the order the filter panel lists them. */
const DIMENSION_ORDER: FilterDimension[] = ['documentType', 'organisation', 'year'];

/** The line over an answer, or undefined when nothing was narrowed. */
export function filterSummaryText(selection: FilterSelection): string | undefined {
  const chosen = DIMENSION_ORDER.flatMap((dimension) => selection[dimension]);
  return chosen.length === 0 ? undefined : chosen.join(' · ');
}

/** The line over one answer, with the corpus and the facets as two facts: in
    one list, «Kudos · Årsrapport · 2023» reads as three things the reader
    chose. `answerCorpusName` comes from the ANSWER's key. */
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
