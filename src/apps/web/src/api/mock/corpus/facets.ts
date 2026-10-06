import { currentYear } from '../../../../shared/years.ts';
import type { FilterDimension, FilterFacet, FilterSelection } from '../../../model';
import { corpusDocuments, type CorpusDocument } from './index';

/**
 * Facet counts computed from the corpus, conditioned on what is already
 * selected — what API-bestilling A2 asks the backend to do one day.
 *
 * The rule is the one every faceted search uses and the one that makes the
 * numbers mean anything: **a dimension's own selection does not narrow its own
 * counts.** «Årsrapport (322)» has to keep saying 322 after you tick it, and
 * «Evaluering (42)» has to stay tickable beside it — count them under the
 * document-type filter and every unticked type would drop to zero the moment
 * the first one was ticked, which reads as «there is nothing else» when the
 * truth is «you have not asked for anything else yet».
 *
 * The other dimensions DO narrow it. Tick «Helsedirektoratet» and the years
 * show how many Helsedirektoratet documents each year has, which is the
 * question a user is asking when they look at the list.
 */
const DIMENSIONS: { dimension: FilterDimension; label: string }[] = [
  { dimension: 'documentType', label: 'Dokumenttyper' },
  { dimension: 'organisation', label: 'Virksomheter' },
  { dimension: 'year', label: 'År' },
];

function valueOf(document: CorpusDocument, dimension: FilterDimension): string {
  switch (dimension) {
    case 'documentType':
      return document.type;
    case 'organisation':
      return document.organisation;
    case 'year':
      return String(document.year);
  }
}

/** Does the document pass every dimension except the one being counted? */
function matches(
  document: CorpusDocument,
  selection: FilterSelection,
  except: FilterDimension,
): boolean {
  return DIMENSIONS.every(({ dimension }) => {
    if (dimension === except) return true;
    const chosen = selection[dimension];
    return chosen.length === 0 || chosen.includes(valueOf(document, dimension));
  });
}

/**
 * The documents a search would actually look in. Every dimension narrows, and
 * an empty dimension means «no restriction» rather than «nothing».
 */
export function documentsMatching(
  selection: FilterSelection,
  documents: CorpusDocument[] = corpusDocuments,
): CorpusDocument[] {
  return documents.filter((document) =>
    DIMENSIONS.every(({ dimension }) => {
      const chosen = selection[dimension];
      return chosen.length === 0 || chosen.includes(valueOf(document, dimension));
    }),
  );
}

/**
 * Sort order inside a dropdown. Years newest first, because that is how a
 * person reads a list of years; everything else by count, because the list is
 * 259 organisations long and the useful ones are the ones with documents.
 * Ties fall back to Norwegian alphabetical order so the list never shuffles.
 */
function sortValues(dimension: FilterDimension, counted: [string, number][]): [string, number][] {
  if (dimension === 'year') return counted.sort((a, b) => Number(b[0]) - Number(a[0]));
  return counted.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb-NO'));
}

export function facetsFor(
  selection: FilterSelection,
  documents: CorpusDocument[] = corpusDocuments,
  thisYear = currentYear(),
): FilterFacet[] {
  return DIMENSIONS.map(({ dimension, label }) => {
    const counts = new Map<string, number>();

    for (const document of documents) {
      if (!matches(document, selection, dimension)) continue;
      const value = valueOf(document, dimension);
      // No year that has not come yet, as the server's policy: two budget
      // proposals «for 2027» are in this corpus, and 2027 is nothing to narrow
      // to in 2026 (issue 75). The documents stay searchable, and a
      // year already ticked is still counted, so it can be seen and undone.
      if (dimension === 'year' && document.year > thisYear && !selection.year.includes(value)) {
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    // A value the user has ticked stays in the list even if the other
    // dimensions have narrowed it to nothing. Dropping it would take away the
    // only control that can undo the selection that emptied it.
    for (const value of selection[dimension]) {
      if (!counts.has(value)) counts.set(value, 0);
    }

    return {
      dimension,
      label,
      values: sortValues(dimension, [...counts.entries()]).map(([value, count]) => ({
        value,
        label: value,
        count,
      })),
    };
  });
}
