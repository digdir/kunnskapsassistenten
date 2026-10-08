import corpus from './kudos-korpus.json' with { type: 'json' };
import { WIKIPEDIA_MOCK_KEY, wikipediaDocuments } from './wikipedia';

/**
 * One document in the mock corpus.
 *
 * Everything in it is real: the title, the type, the organisation, the year
 * and the summary Kudos publishes. Nothing is generated. The answers and the
 * thinking steps in the scripted conversations are ours and live elsewhere.
 *
 * Fetched by scripts/fetch-mock-corpus.mjs; see the header in that file and
 * the metadata at the top of the JSON.
 */
export type CorpusDocument = {
  /** The Kudos uuid, and the id an excerpt points back to. */
  id: string;
  title: string;
  /** «Årsrapport», «Evaluering», «Tildelingsbrev», «Statusrapport», «Strategi/plan». */
  type: string;
  /** The organisation that owns the document, under the name it goes by. */
  organisation: string;
  /** The year the document is ABOUT, not the year it was published. */
  year: number;
  /** Kudos's own summary. This is what excerpts are quoted from. */
  summary: string;
  /**
   * The document's page on Kudos, for «Les dokumentet på Kudos». Absent for
   * a document whose page Kudos no longer has; `urlMissing` says why, and the
   * sources panel says «ingen offentlig lenke» rather than send the reader to
   * a 404.
   */
  url?: string;
  /** Why there is no `url`, written by the fetch script from `DEAD_LINKS`. */
  urlMissing?: string;
};

type Corpus = {
  source: string;
  fetched: string;
  note: string;
  counts: { total: number; byType: Record<string, number> };
  documents: CorpusDocument[];
};

const loaded = corpus as Corpus;

/**
 * Summaries with their whitespace tidied, and nothing else changed.
 *
 * Kudos publishes them with newlines and long runs of spaces in the middle of
 * sentences — the API returns the abstract as it sits in their database. The
 * words are untouched; only the gaps between them are collapsed, so a quote
 * taken from a summary matches the summary it was taken from.
 *
 * It happens here rather than in the fetch script so the committed JSON stays
 * exactly what Kudos served. What we display is our business; what we fetched
 * is the record.
 */
export const corpusDocuments: CorpusDocument[] = loaded.documents.map((document) => ({
  ...document,
  summary: document.summary.replace(/\s+/g, ' ').trim(),
}));

/** Where the corpus came from and when, for the README and for the console. */
export const corpusSource = { source: loaded.source, fetched: loaded.fetched };

/** Lookup by Kudos uuid, for the scripted conversations' excerpts. */
const byId = new Map(corpusDocuments.map((document) => [document.id, document]));

export function corpusDocument(id: string): CorpusDocument | undefined {
  return byId.get(id);
}

/**
 * The documents behind whichever corpus is selected.
 *
 * The facets are counted from this, so a switch changes what the filter
 * panel offers — which is half of what makes a corpus switch visible at all.
 * Anything that is not the Wikipedia mock answers with Kudos, including an
 * unset key: Kudos is what mock mode opens on.
 */
export function corpusDocumentsFor(key: string | undefined): CorpusDocument[] {
  return key === WIKIPEDIA_MOCK_KEY ? wikipediaDocuments : corpusDocuments;
}
