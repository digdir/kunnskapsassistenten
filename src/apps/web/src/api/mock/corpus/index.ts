import corpus from './kudos-korpus.json' with { type: 'json' };
import { WIKIPEDIA_MOCK_KEY, wikipediaDocuments } from './wikipedia';

/**
 * One document in the mock corpus. All real Kudos metadata and summaries,
 * nothing generated. Fetched by scripts/fetch-mock-corpus.mjs; see its header
 * and the metadata at the top of the JSON.
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
  /** The page on Kudos. Absent when Kudos lost it (`urlMissing` says why); never link a 404. */
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
 * Summaries with whitespace runs collapsed, so a quote matches its summary. Done here, not in the
 * fetch script, so the committed JSON stays exactly what Kudos served.
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
 * The documents behind the selected corpus. The facets are counted from this,
 * so a switch changes what the filter panel offers. Anything but the Wikipedia
 * mock, including an unset key, is Kudos.
 */
export function corpusDocumentsFor(key: string | undefined): CorpusDocument[] {
  return key === WIKIPEDIA_MOCK_KEY ? wikipediaDocuments : corpusDocuments;
}
