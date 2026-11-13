import type { ReactNode } from 'react';
import type { AnswerFailure, AnswerStatus } from '../answer/Answer.js';
import type { AnswerMarker } from '../answer/citations.js';
import type { SourceDocument, SourceTarget } from '../sources/types.js';

/** What the reader asked. */
export interface ConversationQuestion {
  kind: 'question';
  id: string;
  text: string;
  /** The names of the documents the question was asked with. */
  attachments?: readonly string[] | undefined;
  /** The language the reader wrote in, when it is not the page's. */
  lang?: string | undefined;
}

/** One answer, as the contract sends it, with what the app knows about it. */
export interface ConversationAnswer {
  kind: 'answer';
  id: string;
  /** Markdown, with `[N]` footnotes. */
  text: string;
  status: AnswerStatus;
  /** The contract's `sources[]`; they come with the answer's end. */
  sources?: readonly SourceDocument[] | undefined;
  /** The contract's top-level `markers`, when the service cites excerpts. */
  markers?: readonly AnswerMarker[] | undefined;
  /** The text is the service's notice that it found nothing (`no_answer`), not an answer. */
  noAnswer?: boolean | undefined;
  /** When the answer came, as ISO 8601 or a date. Without it, no time is shown. */
  createdAt?: string | number | Date | undefined;
  /** The line over the answer: what the question was narrowed to, or where it was asked. */
  scope?: string | ConversationScope | undefined;
  /** Why a failed answer failed. Keep it with the turn, so a reload says the same. */
  failure?: AnswerFailure | undefined;
}

/**
 * What a question was asked of, for the line over its answer. The block words it as
 * kunnskapsassistenten does: «Avgrenset til: Årsrapport · 2023», «…, fra Kudos», or «Hentet fra
 * Kudos» when nothing was narrowed. Keep it with the turn: it is the filter the question was asked
 * with, not the one chosen now.
 */
export interface ConversationScope {
  /** The values chosen in the filter, in the order the filter lists its fields. */
  narrowedTo?: readonly string[] | undefined;
  /** The collection asked, only when it is not the one chosen now. */
  corpus?: string | undefined;
}

/** The assistant asking for more before it answers (the contract's `clarification`). */
export interface ConversationClarification {
  kind: 'clarification';
  id: string;
  /** The question back, as Markdown. */
  text: string;
  /** Answers the service offers. The reader can always write their own in the question field. */
  options?: readonly string[] | undefined;
  /** The line over the question back, as over an answer: it was searched with the same filter. */
  scope?: string | ConversationScope | undefined;
}

export type ConversationTurn =
  ConversationQuestion | ConversationAnswer | ConversationClarification;

/**
 * Where focus goes back to: which answer, and in it a footnote, by its index in that answer's
 * footnotes, or a title in «Kilder brukt i svaret», by its document.
 */
export type ConversationTarget =
  { turnId: string; citation: number } | { turnId: string; document: SourceTarget };

/** What the conversation hands the app's row under a finished answer. */
export interface ConversationActionParts {
  /** When the answer came, for the far end of the row: `AnswerActions`' `end`. */
  end: ReactNode;
  /** «Søk i svaret», when the conversation searches answers: one of the row's actions. */
  search: ReactNode;
}
