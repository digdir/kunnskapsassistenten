import type { MessageStatus } from './message';
/**
 * How relevant an excerpt is to the question. Three levels, because the
 * design draws three tags: «Mest relevant», «Relevant», «Minst relevant».
 *
 * backend: mangler, se API-bestilling A1 — the MCP answer ranks chunks by
 * order only, it carries no relevance score.
 */
export type RelevanceLevel = 'high' | 'medium' | 'low';

/**
 * The Norwegian tag text for each level. Shared so the sources panel, the
 * answer and any future filtering agree on the wording.
 */
export const relevanceLabels: Record<RelevanceLevel, string> = {
  high: 'Mest relevant',
  medium: 'Relevant',
  low: 'Minst relevant',
};

/**
 * One excerpt — a chunk — from a source document. A «treff» in
 * «Fremgangsmåte» is exactly one of these (answer 12).
 */
export interface Excerpt {
  id: string;
  /**
   * The quoted passage. Everything the user reads in the sources panel is a
   * literal quote from the document, never generated text.
   * backend: mangler, se API-bestilling A1 — `structuredContent.chunks`
   * carries id, title and length, not the text itself. Only `/v1` has it.
   */
  text: string;
  /**
   * Heading path inside the document, e.g. «Ressursbruk og måloppnåelse».
   * The backend ships it as a Clojure map in a string, so it needs parsing.
   */
  heading?: string;
  /** Page in the source document, when the corpus has pages. */
  page?: number;
  relevance: RelevanceLevel;
  /**
   * «Les dokumentet på Kudos». Absent for folder-based corpora, where the
   * backend returns `url: null` — never render a link without checking.
   */
  kudosUrl?: string;
  /**
   * True when the passage itself could not be fetched, though the chunk was
   * retrieved and the answer may well cite it.
   *
   * Not the same as an empty document: the excerpt exists, its text is what
   * is missing. The BFF looks the passages up in Typesense separately from
   * the answer, so the lookup can fail on its own — measured 2026-09-29 with
   * Typesense unreachable, where every source arrived with its title and its
   * Kudos link and no `excerpt` at all.
   *
   * A flag and not an empty `text`, so the panel can say so in words. Drawing
   * the heading, «Mest relevant» and «Utdrag 1» around a blank space tells
   * the reader nothing, and reads as a rendering fault rather than as what it
   * is.
   */
  textUnavailable?: boolean;
  /**
   * 1-indexed position in the answer's flat excerpt list, which is what a
   * `[n]` marker in the answer text points at. See {@link Citation}.
   *
   * Undefined when the excerpt was retrieved but the answer never cited it.
   * The search finds more than the answer uses, so the sources panel can show
   * an excerpt that carries no number.
   */
  citationNumber?: number;
}

/**
 * A source document with the excerpts the answer used. Excerpts are grouped
 * per document so the title is not repeated per excerpt (answer 57).
 */
export interface SourceDocument {
  id: string;
  title: string;
  /** Public URL, when the corpus has one. Absent is normal, not an error. */
  url?: string;
  /** «Årsrapport», «Tildelingsbrev», … Same vocabulary as the filter facets. */
  documentType?: string;
  /** The organisation that published the document. */
  organisation?: string;
  year?: number;
  /**
   * Where the document came from: the corpus, or the reader's own upload.
   *
   * On the MODEL and not read off the title, which is what #4 asked for: a
   * document called «Årsrapport 2025.pdf» that the reader uploaded is not the
   * corpus's «Årsrapport Nasjonal kommunikasjonsmyndighet 2025», and the
   * panel has to be able to say so — an uploaded document has no Kudos link
   * and nobody else can open it.
   *
   * Optional, and absent means `corpus`. Every document that existed before
   * uploads did came from the corpus, so a default keeps the sources panel
   * and every fixture working without a field they have no opinion about.
   */
  origin?: 'corpus' | 'user';
  excerpts: Excerpt[];
}

/**
 * The sources behind ONE answer in a thread.
 *
 * A thread has several answers, and each numbers its excerpts from 1: `[2]`
 * in the first answer and `[2]` in the second point at different excerpts in
 * different documents. A single flat list — the newest answer's — made a
 * marker in an older answer open the newer answer's excerpt with the same
 * number. It looked right and was not. Found by #4 in
 * design/brukerreiser-2026-09-15.md, punkt 5.
 *
 * `status` is the answer's own {@link MessageStatus} and not a second
 * vocabulary for the same thing. It is here because an empty `documents`
 * means four different things — the answer is still writing, it was stopped,
 * it failed, or it genuinely cited nothing — and the panel has to say which.
 *
 * The type lives in the model rather than in either view because three
 * parties need to agree on it: the chat view produces it, the shell carries
 * it, and the sources view draws it.
 */
export type AnswerSources = {
  /** The assistant message these sources belong to. */
  messageId: string;
  /** Grouped per document (answer 57). Empty until they arrive, or if none. */
  documents: SourceDocument[];
  status: MessageStatus;
  /**
   * How many `[n]` markers the answer itself carries.
   *
   * It exists to tell two empty panels apart, and they are not the same
   * thing: an answer that cited nothing has nothing to show, while an answer
   * that cited four and arrived with no excerpts has lost them somewhere.
   * Measured in live mode 2026-09-16 — the backend stores no chunks, so a
   * thread read back has an answer full of markers and an empty panel telling
   * the reader «svaret viser ikke til noen utdrag», which they can disprove
   * by looking at it.
   *
   * The count and not a flag, because the count is what the answer says and a
   * flag would be somebody's reading of it. `emptyStateFor` does the reading.
   *
   * Optional while the chat view still has to start sending it. Undefined
   * means «not known», and the panel then says what it said before.
   */
  citationCount?: number;
  /**
   * Which corpus this answer was retrieved from. Same field and the same
   * reason as `Message.corpusKey`: the panel and the disclaimer name the
   * corpus the ANSWER came from, not the one the chooser stands on now.
   *
   * Optional while the chat view still has to start sending it, and
   * undefined also for a turn where nothing said which corpus answered. It
   * means «not known» either way, and the panel decides what to say then.
   */
  corpusKey?: string;
};

/**
 * The DOM id of an excerpt in the sources panel.
 *
 * The answer's `[n]` marker links to `#excerpt-n`, and the sources panel puts
 * that id on excerpt n. Both sides call this function rather than building
 * the string, so the convention has one definition.
 * Decided 2026-09-11.
 */
export function excerptDomId(citationNumber: number): string {
  return `excerpt-${citationNumber}`;
}

/**
 * The accessible name of a `[n]` marker: «Kilde 3: Årsrapport Nasjonal
 * kommunikasjonsmyndighet 2022, side 41».
 *
 * A bare «[3]» tells a screen reader user nothing about where they are being
 * sent, so the marker carries the document and, when there is one, the page.
 */
export function citationAccessibleName(
  citationNumber: number,
  documentTitle: string,
  page?: number,
): string {
  const where = page === undefined ? '' : `, side ${page}`;
  return `Kilde ${citationNumber}: ${documentTitle}${where}`;
}

/**
 * Every cited excerpt in a set of documents, as link targets for the answer.
 * Excerpts the answer did not cite carry no number and are skipped.
 */
export function citationTargets(documents: SourceDocument[]): CitationTarget[] {
  return documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .map(({ document, excerpt }) => {
      const number = excerpt.citationNumber as number;
      return {
        number,
        targetId: excerptDomId(number),
        label: citationAccessibleName(number, document.title, excerpt.page),
      };
    })
    .sort((a, b) => a.number - b.number);
}

/** A `[n]` marker's link target, ready for the markdown renderer. */
export type CitationTarget = {
  /** 1-indexed, as written in the answer. */
  number: number;
  /** DOM id of the excerpt this marker points at. */
  targetId: string;
  /** Norwegian accessible name for the marker. */
  label: string;
};
