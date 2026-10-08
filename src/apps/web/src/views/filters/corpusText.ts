import { corpusDisplayName, type CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';

/**
 * One line saying what the corpus behind the answers actually is.
 *
 * The word «Kudos» appeared nowhere a first-time user could see it — only
 * inside a collapsed panel — so nothing on screen said where the answers come
 * from, how much there is, or which years it covers (brukerreiser
 * 2026-09-15, punkt 11, retningslinje 6).
 *
 * Everything in the sentence is read off the facets, so it follows the corpus
 * instead of being a claim someone has to remember to update. The facets have
 * to be the unconditional ones for that to hold: a count narrowed by the
 * user's own selection would make the line say the corpus shrank when all
 * that happened was that they ticked a box.
 *
 * Every clause is optional and drops out when the data behind it is missing.
 * Live mode has no facet aggregation at all (API-bestilling A2), so there the
 * line is the corpus's own words: its description from the environment, or
 * its name when it has none. «Kudos» was the constant here until a reader
 * could choose the corpus (#106) — it is now whatever is being searched, and
 * «standardkorpuset» when nothing names it.
 */

/**
 * Norwegian plurals for the document types we have seen.
 *
 * A generic rule cannot do this: «tildelingsbrev» is a neuter noun and does
 * not change, and «proposisjon til Stortinget» pluralises in the middle. A
 * type that is not in the table keeps the facet's own label, lowercased —
 * the word the dropdown under it uses — rather than an invented plural.
 *
 * This is where the team's wording lives; extend it when the corpus grows a
 * type. Nothing breaks without it, the line just reads slightly stiffer.
 */
const PLURAL_NB: Record<string, string> = {
  Evaluering: 'evalueringer',
  'Proposisjon til Stortinget': 'proposisjoner til Stortinget',
  Statusrapport: 'statusrapporter',
  Tildelingsbrev: 'tildelingsbrev',
  Årsrapport: 'årsrapporter',
};

/**
 * How many types the sentence names before it gives up and says «med flere».
 *
 * The cut only happens when it actually saves something: with exactly one
 * type over the cap, «med flere» is longer than the type it replaces and says
 * less, so the last one is named too. See {@link documentTypes}.
 */
const MAX_TYPES = 5;

function plural(label: string): string {
  return PLURAL_NB[label] ?? label.toLocaleLowerCase('nb-NO');
}

/** «a, b og c». Norwegian has no serial comma. */
function list(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} og ${parts.at(-1)}`;
}

/**
 * How many documents there are.
 *
 * Summed over one dimension, not over all of them: every document has exactly
 * one type and one year, so either sum is the total, while summing both would
 * count everything twice. `documentType` first because it is the dimension
 * most likely to be complete; `year` is the fallback.
 *
 * Undefined when any value in the dimension is missing its count — a partial
 * sum is a wrong number, and a wrong number is worse than no number.
 */
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

  // Biggest first, so the types that actually make up the corpus are the ones
  // that survive the cut. Facet order is kept when there are no counts.
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

/**
 * The line, in the two parts the panel draws it in.
 *
 * `source` names the corpus and is always there; `detail` is what is in it,
 * and is what «Vis mer» holds. Split because the sentence whole is two lines
 * in a 327 px panel — 63 px of a filter head that was 179 (measured at 1440)
 * — and the panel is over its height budget (hoydebudsjett-forslag,
 * 2026-09-21, N2). The name is the half that changes when a reader switches
 * corpus (#103, #106), so it is the half that stays on screen.
 */
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

  /*
   * Nothing to count, so the corpus says what it is in its own words — the
   * description from the environment. The opening stays either way, because
   * it carries the one thing the description cannot be trusted to: where the
   * documents come from. That was the whole reason the line exists
   * (brukerreiser punkt 11), and a description written in a deployment's
   * environment may well name only what is inside.
   *
   * This is the live path — there is no facet aggregation there (A2).
   */
  return corpus?.description ? { source, detail: corpus.description } : { source };
}
