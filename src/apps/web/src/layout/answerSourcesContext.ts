import { createContext } from 'react';
import type { AnswerSources, SourceDocument } from '../model';

/**
 * The sources behind the answer currently on screen, held above the views.
 *
 * The chat view produces them — they arrive at the end of a stream, in the
 * `sources` event — and the sources view draws them. Neither can own it, for
 * the same reason neither owns the active citation or the filter: two views
 * that must agree may never import each other, and either of them can be
 * moved to another slot.
 *
 * `undefined` and `[]` are different answers, and the sources view renders
 * them differently: undefined is «no answer yet, so nothing is known», and an
 * empty array is «an answer, with nothing behind it».
 */
export type AnswerSourcesContextValue = {
  /**
   * Every answer in the thread that has reported sources, oldest first.
   *
   * `undefined` means nobody has reported any yet — which is also the state
   * while the chat view still uses `setDocuments` below. `[]` means a thread
   * with no answers. The sources panel needs the difference: undefined is
   * «nothing is known», empty is «nothing to show».
   */
  answers: AnswerSources[] | undefined;
  /**
   * Record one answer's sources, replacing the entry with the same message
   * id. Called by the view that owns the answer, once per change.
   */
  setAnswerSources: (answer: AnswerSources) => void;
  /** Forget them all. Leaving a thread does this. */
  clearAnswerSources: () => void;
  /**
   * The newest answer's documents, flat.
   *
   * One caller still wants exactly this and not the per-answer list: the
   * filter panel's «Fra Kudos», which is about the thread rather than about
   * one answer.
   *
   * Derived from `answers` once anything is recorded there, so it follows the
   * newest answer without a second thing to keep in step.
   */
  documents: SourceDocument[] | undefined;
  /**
   * The single flat list, as it was before sources were kept per answer.
   *
   * Still here because the chat view calls it, and it will until #3 has a
   * message id to hand over. It writes to its own slot, and `documents`
   * prefers `answers` the moment that has anything in it — so the two never
   * disagree about which answer is newest.
   */
  setDocuments: (documents: SourceDocument[] | undefined) => void;
};

export const AnswerSourcesContext = createContext<AnswerSourcesContextValue | undefined>(undefined);

/**
 * A complete but inert value, for tests that only need the shape.
 *
 * It exists so a test does not have to spell out every member: this context
 * has grown twice now, and each time it did, every literal built in a test
 * stopped compiling — in folders belonging to other owners. Spread this
 * instead and the next member costs nobody anything.
 */
export const inertAnswerSources: AnswerSourcesContextValue = {
  answers: undefined,
  setAnswerSources: () => {},
  clearAnswerSources: () => {},
  documents: undefined,
  setDocuments: () => {},
};
