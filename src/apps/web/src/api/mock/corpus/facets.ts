import { currentYear } from '../../../../shared/years.ts';
import type { FilterDimension, FilterFacet, FilterSelection } from '../../../model';
import { corpusDocuments, type CorpusDocument } from './index';

// Facet counts conditioned on the selection. A dimension's own selection does not narrow its own
// counts, so «Årsrapport (322)» keeps its number and the other types stay tickable; the other
// dimensions do narrow it.
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

// Years newest first; the rest by count, since the useful values have documents. Ties in
// Norwegian alphabetical order, so the list never shuffles.
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
      // No future years, as on the server (issue 75): the corpus has budget
      // proposals for next year. They stay searchable, and a ticked year is
      // still counted so it can be seen and undone.
      if (dimension === 'year' && document.year > thisYear && !selection.year.includes(value)) {
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    // A ticked value stays even when other dimensions narrow it to nothing,
    // or the control that can undo the selection would disappear.
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
