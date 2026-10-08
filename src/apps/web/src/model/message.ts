import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

export type MessageRole = 'user' | 'assistant';

/**
 * `aborted` (the user pressed stop) keeps the text that arrived. `error`: the
 * turn failed, and `content` holds what arrived first. `needs-clarification`
 * is a finished turn where the agent asks back (`_meta.status`).
 */
export type MessageStatus = 'streaming' | 'complete' | 'needs-clarification' | 'aborted' | 'error';

/**
 * One turn in a thread. `content` is markdown, rendered with Designsystemet
 * components, never raw HTML tags.
 */
export interface Message {
  id: string;
  role: MessageRole;
  /** Markdown for assistant turns, plain text for user turns. */
  content: string;
  /** ISO 8601. */
  createdAt: string;
  /** The `[n]` markers in `content`, resolved. Empty for user turns and uncited answers. */
  citations: Citation[];
  /**
   * Distinct `[n]` in the text, resolved or not; a thread read back from live has no chunks.
   */
  citationCount?: number;
  /**
   * The store kept no sources (the BFF holds them in memory), so empty `sources` proves nothing.
   */
  sourcesNotStored?: boolean;
  /** Grouped per document. Absent while the answer streams; arrives at the end. */
  sources?: SourceDocument[];
  /**
   * Which corpus answered (`dataset_config_key`), not the one selected now. Undefined: unknown.
   */
  corpusKey?: string;
  /** «Fremgangsmåte»: what the search did. Placeholder data for now. */
  retrieval?: RetrievalDetails;
  /** Progress from the agent, in arrival order. Shown while the answer builds. */
  thinkingSteps?: ThinkingStep[];
  /**
   * Ms from the first thinking step to the first word, measured live so it survives a reload.
   */
  thoughtMs?: number;
  status: MessageStatus;
}
