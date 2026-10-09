import { createContext } from 'react';
import type { AnswerSources, SourceDocument } from '../model';

/**
 * The sources behind the answer on screen. The shell holds them: the chat view produces them and
 * the sources view draws them, and neither may import the other.
 */
export type AnswerSourcesContextValue = {
  /** Answers that have reported sources, oldest first. `undefined`: nothing known; `[]`: none. */
  answers: AnswerSources[] | undefined;
  /** Record one answer's sources, replacing any entry with the same message id. */
  setAnswerSources: (answer: AnswerSources) => void;
  /** Forget them all. Leaving a thread does this. */
  clearAnswerSources: () => void;
  /** The newest answer's documents, flat (for the filter panel's «Fra Kudos»). */
  documents: SourceDocument[] | undefined;
  /**
   * Set the flat list without a message id. `documents` prefers `answers` once that has entries.
   */
  setDocuments: (documents: SourceDocument[] | undefined) => void;
};

export const AnswerSourcesContext = createContext<AnswerSourcesContextValue | undefined>(undefined);

/**
 * A complete but inert value, for tests that only need the shape. Spread it rather than
 * spelling out every member, so a new member does not break test literals across the repo.
 */
export const inertAnswerSources: AnswerSourcesContextValue = {
  answers: undefined,
  setAnswerSources: () => {},
  clearAnswerSources: () => {},
  documents: undefined,
  setDocuments: () => {},
};
