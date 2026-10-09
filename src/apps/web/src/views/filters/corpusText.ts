import { corpusDisplayName, type CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';

// One line on what the corpus behind the answers is, read off the unconditional facets so a
// ticked box cannot shrink it. A clause drops out when its data is missing; live mode has no
// facet aggregation, so there the line is the corpus's description or name.

/* Norwegian plurals; no generic rule gets «tildelingsbrev» or «proposisjoner til Stortinget»
   right. Other types keep the facet's label, lowercased. Extend when the corpus grows a type. */
const PLURAL_NB: Record<string, string> = {
  Evaluering: 'evalueringer',
  'Proposisjon til Stortinget': 'proposisjoner til Stortinget',
  Statusrapport: 'statusrapporter',
  Tildelingsbrev: 'tildelingsbrev',
  Årsrapport: 'årsrapporter',
};

/** Types named before «med flere». One over is named too: «med flere» would say less. */
const MAX_TYPES = 5;

function plural(label: string): string {
  return PLURAL_NB[label] ?? label.toLocaleLowerCase('nb-NO');
}

/** «a, b og c». Norwegian has no serial comma. */
function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} og ${parts.at(-1)}`;
}

/** Summed over one dimension, as every document has one type and one year (`documentType` is
    likelier complete). Undefined when any count is missing: a partial sum is wrong. */
function totalDocuments(facets: FilterFacet[]): number | undefined {
  for (const dimension of ['documentType', 'year'] as const) {
    const facet = facets.find((candidate) => candidate.dimension === dimension);
    if (!facet || facet.values.length === 0) continue;
    if (facet.values.some((value) => value.count === undefined)) continue;
    return facet.values.reduce((sum, value) => sum + (value.count ?? 0), 0);
  }
  return undefined;
}

/** «årsrapporter, evalueringer og tildelingsbrev», biggest first. */
function documentTypes(facets: FilterFacet[]): string {
  const facet = facets.find((candidate) => candidate.dimension === 'documentType');
  if (!facet || facet.values.length === 0) return '';

  // Biggest first, so the cut keeps the types that make up the corpus.
  const ordered = [...facet.values].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  const truncated = ordered.length > MAX_TYPES + 1;
  const named = (truncated ? ordered.slice(0, MAX_TYPES) : ordered).map((value) =>
    plural(value.label),
  );

  return truncated ? `${list(named)} med flere` : list(named);
}

/** «2020–2027», or «2024» when the corpus is one year wide. */
function yearRange(facets: FilterFacet[]): string {
  const facet = facets.find((candidate) => candidate.dimension === 'year');
  const years = (facet?.values ?? [])
    .map((value) => Number.parseInt(value.label, 10))
    .filter((year) => Number.isFinite(year));
  if (years.length === 0) return '';

  const first = Math.min(...years);
  const last = Math.max(...years);
  return first === last ? String(first) : `${first}–${last}`;
}

/** The line in two parts: `source` stays on screen, `detail` is behind «Vis mer». */
export type CorpusLine = {
  /** «Dokumenter fra Wikipedia (NorQuAD)». Never empty. */
  source: string;
  /** «351 artikler …» or the counted clauses. Absent when nothing is known. */
  detail?: string;
};

export function corpusLine(facets?: FilterFacet[], corpus?: CorpusOption): CorpusLine {
  const total = facets ? totalDocuments(facets) : undefined;
  const clauses = (
    facets
      ? [
          total === undefined ? '' : `${total.toLocaleString('nb-NO')} dokumenter`,
          documentTypes(facets),
          yearRange(facets),
        ]
      : []
  ).filter((clause) => clause !== '');

  const source = `Dokumenter fra ${corpusDisplayName(corpus)}`;
  if (clauses.length > 0) return { source, detail: clauses.join(', ') };

  // Nothing to count (live mode): the corpus's own description. `source` stays, since a
  // description may say what is inside but not where it comes from.
  return corpus?.description ? { source, detail: corpus.description } : { source };
}
