import type {
  ChatError,
  Excerpt,
  RelevanceLevel,
  RetrievalDetails,
  SourceDocument,
  ThinkingStep,
} from '../../../model';
import { corpusDocument } from '../corpus';

/**
 * A question the mock has a real answer for, with the whole shape of a real turn. Documents come
 * from the corpus and excerpts are literal quotes (`conversations.test.ts` checks); the answers,
 * steps and keywords are ours. Nothing is generated.
 */
export type ScriptedConversation = {
  id: string;
  /** The question as a user would type it. Matched loosely; see `scriptedFor`. */
  question: string;
  /** Other phrasings that should land on the same answer. */
  aliases?: string[];
  /** The thread title, which is the question until a backend writes one. */
  threadTitle: string;
  /**
   * Days ago, for the thread list. On the conversation so filtering cannot shift it; see `daysAgo`.
   */
  daysAgo: number;
  /** Markdown. Heading and paragraphs, sometimes a list or a table. */
  answer: string;
  documents: SourceDocument[];
  retrieval: RetrievalDetails;
  thinkingSteps: ThinkingStep[];
  /** Suggested next questions, shown under the answer. */
  followUps: string[];
  /** The agent asks back instead of answering; no sources, since nothing was retrieved. */
  outcome?: 'needs-clarification';
  /** This question fails instead of answering. */
  failure?: ChatError;
};

/** One excerpt to quote, before it is grounded in a corpus document. */
export type ExcerptDraft = {
  /** A literal quote from the Kudos summary, never a paraphrase: the panel shows it as a quote. */
  text: string;
  /** Where in the document, when the summary makes that clear. */
  heading?: string;
  relevance: RelevanceLevel;
  /** The `[n]` pointing here. Left out when the answer never cited it, which is normal. */
  citationNumber?: number;
};

/**
 * A source document built from the corpus record. Throws on an unknown id, so a refetch that
 * drops a document fails loudly. No `page`: Kudos has none for a summary, and an invented one is
 * worse.
 */
export function sourceFrom(corpusId: string, drafts: ExcerptDraft[]): SourceDocument {
  const document = corpusDocument(corpusId);
  if (!document) {
    throw new Error(
      `Scriptet samtale viser til et dokument som ikke finnes i korpuset: ${corpusId}. ` +
        'Er korpuset hentet på nytt, må samtalen oppdateres.',
    );
  }

  const excerpts: Excerpt[] = drafts.map((draft, index) => ({
    id: `${corpusId}-${index + 1}`,
    text: draft.text,
    ...(draft.heading ? { heading: draft.heading } : {}),
    relevance: draft.relevance,
    kudosUrl: document.url,
    ...(draft.citationNumber === undefined ? {} : { citationNumber: draft.citationNumber }),
  }));

  return {
    id: document.id,
    title: document.title,
    url: document.url,
    documentType: document.type,
    organisation: document.organisation,
    year: document.year,
    excerpts,
  };
}
