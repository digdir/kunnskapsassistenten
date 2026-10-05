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
 * One cached conversation: a question the mock has a real answer for.
 *
 * Lars asked for «noen nye søk, cachede, så jeg kan teste selv». These are
 * those: eleven questions across the Kudos corpus, each with the whole shape a
 * real turn has — thinking steps, a streamed answer, excerpts behind it, and
 * «Fremgangsmåte».
 *
 * **What is real and what is ours.** Every document, title, organisation,
 * year and URL comes from the corpus, and every excerpt is a literal quote
 * from that document's Kudos summary — `conversations.test.ts` checks that
 * each one is still a substring of the summary it claims to come from. The
 * answers, the thinking steps and the keywords are written by us. Nothing is
 * generated.
 */
export type ScriptedConversation = {
  id: string;
  /** The question as a user would type it. Matched loosely; see `matches`. */
  question: string;
  /** Other phrasings that should land on the same answer. */
  aliases?: string[];
  /** The thread title, which is the question until a backend writes one. */
  threadTitle: string;
  /**
   * How long ago this conversation was had, in days, for the thread list.
   *
   * On the conversation and not in a list beside it, which is the difference
   * between a mismatch being impossible and being something a test has to
   * catch: the days used to be an array paired by position, and they were
   * paired with the FILTERED list — so a second conversation that fails would
   * have shifted every day after it without a word. Found by KA CC reviewing
   * PR #58.
   *
   * Relative rather than a date, so the spread keeps exercising every bucket
   * in `views/threads/grouping.ts` however long after they were written
   * somebody opens the app. See `daysAgo` in ../clock.ts.
   *
   * A conversation that gets no thread — the one that fails — still carries
   * one. It says when the conversation was had, which is true either way.
   */
  daysAgo: number;
  /** Markdown. Heading and paragraphs, sometimes a list or a table. */
  answer: string;
  documents: SourceDocument[];
  retrieval: RetrievalDetails;
  thinkingSteps: ThinkingStep[];
  /** Suggested next questions, shown under the answer. */
  followUps: string[];
  /**
   * The agent asking back instead of answering. The answer text is then a
   * real question to the user and there are no sources, because nothing was
   * retrieved.
   */
  outcome?: 'needs-clarification';
  /** This question fails instead of answering. */
  failure?: ChatError;
};

/** One excerpt to quote, before it is grounded in a corpus document. */
export type ExcerptDraft = {
  /**
   * A literal quote from the document's Kudos summary. Not a paraphrase: the
   * sources panel shows this as something the document says.
   */
  text: string;
  /** Where in the document, when the summary makes that clear. */
  heading?: string;
  relevance: RelevanceLevel;
  /**
   * The `[n]` in the answer that points here. Left out for an excerpt the
   * search found but the answer never cited — which is normal, and why «10
   * treff» beside five sources is right rather than a bug.
   */
  citationNumber?: number;
};

/**
 * Build a source document from the corpus, so nothing about it is typed twice.
 *
 * Title, type, organisation, year and the Kudos URL all come from the fetched
 * record. Pass an id the corpus does not have and this throws: a scripted
 * conversation that quotes a document nobody can open is worse than no
 * conversation, and a refetch that drops a document should say so loudly
 * rather than ship a broken link.
 *
 * No `page` anywhere. Kudos gives a summary per document and no page for any
 * part of it, and the brief is explicit that a page invented from nothing is
 * worse than none. The NKOM fixture had pages until 2026-09-16 and lost them
 * for the same reason when it was rebuilt on real documents, so nothing in
 * the app draws `Excerpt.page` today. The field stays because the live path
 * is where a real page number can come from; see the note on `#page=N` in
 * design/kudos-lenker-og-usikre-2026-09-16.md.
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
