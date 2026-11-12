import type { MessageStatus } from './message';
/**
 * How relevant an excerpt is to the question; the design draws three tags.
 * Not provided by the backend yet: the MCP answer ranks chunks by order only.
 */
export type RelevanceLevel = 'high' | 'medium' | 'low';

/** Shared so every place that shows a relevance tag uses the same wording. */
export const relevanceLabels: Record<RelevanceLevel, string> = {
  high: 'Mest relevant',
  medium: 'Relevant',
  low: 'Minst relevant',
};

/**
 * One excerpt — a chunk — from a source document. A «treff» in
 * «Fremgangsmåte» is exactly one of these.
 */
export interface Excerpt {
  id: string;
  /** A literal quote from the document. MCP chunks carry no text; only `/v1` has it. */
  text: string;
  /**
   * Heading path, e.g. «Ressursbruk og måloppnåelse». Arrives as a Clojure map in a string.
   */
  heading?: string;
  /** Page in the source document, when the corpus has pages. */
  page?: number;
  relevance: RelevanceLevel;
  /** «Les dokumentet på Kudos». Absent when the backend returns `url: null`; always check. */
  kudosUrl?: string;
  /**
   * The chunk text could not be fetched, so the panel says so in words. See src/decisions/0008.
   */
  textUnavailable?: boolean;
  /** The `[n]` that names this excerpt; undefined if uncited or if its document is cited whole. */
  citationNumber?: number;
}

/** A source document with the excerpts the answer used, grouped so the title is not repeated. */
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
   * Where it came from, not guessed from the title: an upload has no Kudos link. Absent = `corpus`.
   */
  origin?: 'corpus' | 'user';
  /** The `[n]` that names this document as a whole, when the service cites by document. */
  citationNumber?: number;
  excerpts: Excerpt[];
}

/**
 * The sources behind ONE answer: each answer numbers its excerpts from 1, so
 * one flat list would open the wrong `[2]`. `status` tells the panel why
 * `documents` is empty (still writing, stopped, failed or cited nothing).
 */
export type AnswerSources = {
  /** The assistant message these sources belong to. */
  messageId: string;
  /** Grouped per document. Empty until they arrive, or if none. */
  documents: SourceDocument[];
  status: MessageStatus;
  /**
   * `[n]` count in the answer, to tell «cited nothing» from «excerpts lost». Undefined: unknown.
   */
  citationCount?: number;
  /** The store did not keep this answer's sources. See `Message.sourcesNotStored`. */
  sourcesNotStored?: boolean;
  /** The corpus the ANSWER came from, not the one selected now. See `Message.corpusKey`. */
  corpusKey?: string;
  /**
   * How many places in the answer cite each excerpt, by its number: the back-link from an
   * excerpt steps through them. Absent: not counted.
   */
  uses?: Record<number, number>;
};

/** How many times the answer writes each `[n]`, by number. */
export function citationUses(content: string): Record<number, number> {
  const uses: Record<number, number> = {};
  for (const match of content.matchAll(/\[(\d{1,3})\]/g)) {
    const number = Number(match[1]);
    uses[number] = (uses[number] ?? 0) + 1;
  }
  return uses;
}

/** The DOM id of one answer in the conversation, where its `[n]` markers are. */
export function answerDomId(messageId: string): string {
  return `svar-${messageId}`;
}

/**
 * The DOM id of an excerpt in the sources panel. The answer's `[n]` marker
 * links to it, and both sides call this so the convention has one definition.
 */
export function excerptDomId(citationNumber: number): string {
  return `excerpt-${citationNumber}`;
}

/** The id of a document card in the sources panel. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}

/** The id of a document card's heading, where a title or a document's `[n]` sends the reader. */
export function documentHeadingDomId(documentId: string): string {
  return `${documentDomId(documentId)}-tittel`;
}

/**
 * The accessible name of a `[n]` marker, and its tooltip: «Utdrag 3: Årsrapport Nasjonal
 * kommunikasjonsmyndighet 2022» (Lars, 2026-11-03). Only the excerpt has a number, so the name
 * says which excerpt and whose document; a bare «[3]» tells a screen reader user nothing about
 * where they are being sent.
 */
export function citationAccessibleName(citationNumber: number, documentTitle: string): string {
  return `Utdrag ${citationNumber}: ${documentTitle}`;
}

/** The accessible name of a `[n]` that names a whole document: «Kilde 2: Årsrapport …». */
export function documentCitationAccessibleName(
  citationNumber: number,
  documentTitle: string,
): string {
  return `Kilde ${citationNumber}: ${documentTitle}`;
}

/** Every footnote, a cited excerpt or a document cited whole, as link targets for the answer. */
export function citationTargets(documents: SourceDocument[]): CitationTarget[] {
  const excerpts = documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .map(({ document, excerpt }) => {
      const number = excerpt.citationNumber as number;
      return {
        number,
        targetId: excerptDomId(number),
        label: citationAccessibleName(number, document.title),
      };
    });
  const wholeDocuments = documents
    .filter((document) => document.citationNumber !== undefined)
    .map((document) => {
      const number = document.citationNumber as number;
      return {
        number,
        targetId: documentHeadingDomId(document.id),
        label: documentCitationAccessibleName(number, document.title),
        documentId: document.id,
      };
    });
  return [...excerpts, ...wholeDocuments].sort((a, b) => a.number - b.number);
}

/** A `[n]` marker's link target, ready for the markdown renderer. */
export type CitationTarget = {
  /** 1-indexed, as written in the answer. */
  number: number;
  /** DOM id of the excerpt, or of the document's heading, this marker points at. */
  targetId: string;
  /** Norwegian accessible name for the marker. */
  label: string;
  /** Set when the marker names a whole document: activating it opens that document. */
  documentId?: string;
};
