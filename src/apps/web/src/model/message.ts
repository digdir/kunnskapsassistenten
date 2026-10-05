import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

export type MessageRole = 'user' | 'assistant';

/**
 * `streaming` is an assistant message still being produced. `aborted` is the
 * user pressing stop (answer 34), which is not a failure: the text that did
 * arrive stays on screen and stays readable. `error` means the turn failed;
 * `content` then holds whatever arrived before it did.
 *
 * `needs-clarification` is the agent answering that it cannot answer yet and
 * asking back. It is a finished turn, not a failed one: the content is a real
 * question to the user and has to read as one. The backend reports it in
 * `_meta.status` alongside `complete` and `error`, see
 * design/eksisterende/api-for-frontend.md.
 */
export type MessageStatus = 'streaming' | 'complete' | 'needs-clarification' | 'aborted' | 'error';

/**
 * One turn in a thread.
 *
 * `content` is markdown. Answer 14: heading plus paragraph, with markdown
 * lists and simple tables inside the paragraph flow. Rendering maps it onto
 * Designsystemet components, never onto raw HTML tags.
 */
export interface Message {
  id: string;
  role: MessageRole;
  /** Markdown for assistant turns, plain text for user turns. */
  content: string;
  /** ISO 8601. */
  createdAt: string;
  /**
   * The `[n]` markers found in `content`, resolved. Empty for user turns and
   * for answers that cite nothing.
   */
  citations: Citation[];
  /**
   * How many DISTINCT `[n]` the answer's own text carries, resolved or not.
   *
   * `citations` above is what could be resolved against excerpts, and the two
   * come apart exactly where it matters: a conversation restored from the
   * live backend has the answer text with `[1][2][3][4]` in it and no chunks
   * behind them, so `citations` is empty while the reader can plainly see
   * four markers. Without this the sources panel says «Svaret viser ikke til
   * noen utdrag» beside an answer that does. See `AnswerSources.citationCount`
   * and `emptyStateFor`.
   *
   * Optional, because only a turn read back from a store has to count: a turn
   * watched live resolves its markers as they arrive.
   */
  citationCount?: number;
  /**
   * Sources behind this answer, grouped per document (answer 57). Arrives at
   * the end of the stream, so it is absent while the answer is streaming.
   */
  sources?: SourceDocument[];
  /**
   * Which corpus the answer was retrieved from — `dataset_config_key`.
   *
   * On the turn, and not read off the store when it is drawn: the store says
   * which corpus is selected NOW. A reader who switches corpus with a
   * finished answer on screen otherwise gets «fra Kudos» written over a
   * Wikipedia source — the sentence follows the chooser while the sources
   * stay whatever they were retrieved as (KA CC on #129).
   *
   * Set by the client that answered, because that is the only place that
   * knows what went on the wire: the live client resolves the key once per
   * question, the mock picks its fixtures by it. A thread read back takes it
   * from the conversation's `corpus:` tag.
   *
   * Absent on turns from before there was a choice, and whenever nothing
   * said which corpus answered — live with no tenant configured leaves the
   * key out of the call and the backend picks (see `datasetArguments`).
   * Undefined is «not known», never «the default one».
   */
  corpusKey?: string;
  /** «Fremgangsmåte»: what the search did. Placeholder data in v1 (answer 11). */
  retrieval?: RetrievalDetails;
  /** Progress from the agent, in arrival order. Shown while the answer builds. */
  thinkingSteps?: ThinkingStep[];
  /**
   * How long the agent thought, in milliseconds: from the first thinking step
   * to the first word of the answer.
   *
   * Measured once, while it happened, and then carried with the turn — which
   * is the point. «Tenkte i 2 sekunder» live became «Tenkte i 4 sekunder»
   * after a reload, because the live number was the clock and the restored
   * one was the sum of the steps' own `durationMs` (brukerblikk runde 2, funn
   * 5). Two honest numbers for the same unchanged turn is one too many.
   *
   * Absent for a turn nobody watched — a fixture thread, an answer from a
   * backend that does not report it — and the summary then falls back to the
   * steps' own durations, or says «Tenkte» with no number at all.
   */
  thoughtMs?: number;
  status: MessageStatus;
}
