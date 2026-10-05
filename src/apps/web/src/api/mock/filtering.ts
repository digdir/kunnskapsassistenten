import {
  isEmptySelection,
  type FilterDimension,
  type FilterSelection,
  type RetrievalDetails,
  type SourceDocument,
} from '../../model';

/**
 * What the filter does to a search, as far as a backend that is not there can
 * show it.
 *
 * The real narrowing is the backend's and it does not do it yet
 * (API-bestilling A2). Until then the mock has to, or the control that is
 * hardest to trust — a filter that looks like it works — stays untested and
 * undesigned. Reise 8 in design/brukerreiser-2026-09-15.md: the first thing a
 * new user meets is a control with no effect.
 *
 * A facet value IS the word the reader ticked — `facetsFor` in corpus/facets
 * builds the dropdowns straight from the corpus and sets `value` and `label`
 * to the same string — so a selection is compared to the document field
 * directly, the way `documentsMatching` does it next door. The day the
 * backend hands out ids of its own, this is the one place that has to learn
 * to look them up.
 */

/** The document field each dimension narrows on. */
function fieldOf(document: SourceDocument, dimension: FilterDimension): string | undefined {
  if (dimension === 'documentType') return document.documentType;
  if (dimension === 'organisation') return document.organisation;
  return document.year === undefined ? undefined : String(document.year);
}

/**
 * The documents a question may draw on.
 *
 * A dimension with nothing selected is no restriction at all, not an empty
 * result — the same rule `FilterSelection` states. Across dimensions the
 * selections are ANDed: «Årsrapport» and «2023» means annual reports from
 * 2023, which is what the three dropdowns look like they mean.
 *
 * A document that says nothing about a dimension the reader narrowed on is
 * left out. It cannot be shown to belong in the selection, and quietly
 * including it would make the filter look broken in the other direction.
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

/*
 * A marker and the space in front of it, the same shape the clipboard strips.
 * The space goes with the marker so «kvartalsvis [1].» does not become
 * «kvartalsvis .»
 */
const CITATION = /[ \t]?\[(\d{1,3})\]/g;

/**
 * Move every `[n]` in the answer along by `offset`.
 *
 * A citation number IS the excerpt's position in the answer's flat list, so
 * putting documents in front of the corpus moves every later number — and the
 * markers in the TEXT have to move with them. Without this each claim pointed
 * one document too early and the last source had no marker at all. Found by
 * KA CC on #117.
 *
 * One pass with a replacer function, not a loop of replaces: `[1]` → `[2]`
 * followed by a pass for `[2]` would shift the same marker twice.
 */
export function shiftCitations(markdown: string, offset: number): string {
  if (offset === 0) return markdown;
  return markdown.replace(CITATION, (match, number: string) =>
    match.replace(`[${number}]`, `[${Number(number) + offset}]`),
  );
}

/**
 * The canned answer with the markers the filter took away removed.
 *
 * The mock's answer text is fixed and cites five excerpts; narrow the corpus
 * and some of them are no longer there. Leaving the markers would put dead
 * `[3]`s in the prose, which says «the frontend is broken» rather than «that
 * document is outside your selection». The text still claims more than the
 * remaining sources support — a canned answer cannot help that — but nothing
 * on screen contradicts anything else.
 */
export function withOnlyCitations(markdown: string, keep: Set<number>): string {
  return markdown.replace(CITATION, (match, number: string) =>
    keep.has(Number(number)) ? match : '',
  );
}
