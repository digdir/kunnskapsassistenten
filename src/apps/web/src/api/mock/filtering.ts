import {
  isEmptySelection,
  type FilterDimension,
  type FilterSelection,
  type RetrievalDetails,
  type SourceDocument,
} from '../../model';

// The mock narrows by filter too, or a filter that only looks like it works would go untested.
// A facet value IS the ticked label (`facetsFor` sets both), so it is compared to the document
// field directly; if the backend ever hands out ids, look them up here.

/** The document field each dimension narrows on. */
function fieldOf(document: SourceDocument, dimension: FilterDimension): string | undefined {
  if (dimension === 'documentType') return document.documentType;
  if (dimension === 'organisation') return document.organisation;
  return document.year === undefined ? undefined : String(document.year);
}

/**
 * The documents a question may draw on. An empty dimension is no restriction;
 * across dimensions the selections are ANDed. A document that says nothing
 * about a narrowed dimension is left out, since it cannot be shown to belong.
 */
export function narrowToSelection(
  documents: SourceDocument[],
  selection: FilterSelection | undefined,
): SourceDocument[] {
  if (!selection || isEmptySelection(selection)) return documents;

  const dimensions: FilterDimension[] = ['documentType', 'organisation', 'year'];

  return documents.filter((document) =>
    dimensions.every((dimension) => {
      const wanted = selection[dimension];
      if (wanted.length === 0) return true;
      const actual = fieldOf(document, dimension);
      return actual !== undefined && wanted.includes(actual);
    }),
  );
}

/** «10 treff i 3 dokumenter», counted from what survived the filter. */
export function retrievalFor(
  documents: SourceDocument[],
  base: RetrievalDetails,
): RetrievalDetails {
  return {
    ...base,
    hitCount: documents.reduce((total, document) => total + document.excerpts.length, 0),
    documentCount: documents.length,
  };
}

/** The `[n]` numbers still answerable after the filter. */
export function citedNumbers(documents: SourceDocument[]): Set<number> {
  return new Set(
    documents
      .flatMap((document) => document.excerpts)
      .map((excerpt) => excerpt.citationNumber)
      .filter((number): number is number => number !== undefined),
  );
}

// A marker and the space before it, so «kvartalsvis [1].» does not become «kvartalsvis .».
const CITATION = /[ \t]?\[(\d{1,3})\]/g;

/**
 * Move every `[n]` along by `offset`, since documents put in front of the corpus shift every
 * number. One pass with a replacer: a loop of replaces would shift a marker twice.
 */
export function shiftCitations(markdown: string, offset: number): string {
  if (offset === 0) return markdown;
  return markdown.replace(CITATION, (match, number: string) =>
    match.replace(`[${number}]`, `[${Number(number) + offset}]`),
  );
}

/**
 * The canned answer without the markers the filter took away. Dead `[3]`s in
 * the prose would read as a broken frontend rather than «that document is
 * outside your selection».
 */
export function withOnlyCitations(markdown: string, keep: Set<number>): string {
  return markdown.replace(CITATION, (match, number: string) =>
    keep.has(Number(number)) ? match : '',
  );
}
