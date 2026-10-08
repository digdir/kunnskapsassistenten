import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

// Why a turn ended; the view words each code. `aborted` and `no-hits` are not errors in the UI.
// The two `-unavailable` codes only when the backend names the half that failed: a 5xx is
// `unknown`, since a wrong guess sends the reader the wrong way.
const CHAT_ERROR_CODES = [
  'aborted',
  'model-unavailable',
  'retrieval-unavailable',
  'timeout',
  'no-hits',
  'unauthorized',
  'rate-limited',
  'question-too-long',
  'thread-not-found',
  'filter-refused',
  'unknown',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

/**
 * A code from outside, narrowed to one we know. The backend will one day
 * send codes this frontend has never heard of; they must land on `unknown`,
 * never throw or miss a lookup table.
 */
export function chatErrorCode(value: unknown): ChatErrorCode {
  return CHAT_ERROR_CODES.find((code) => code === value) ?? 'unknown';
}

export interface ChatError {
  code: ChatErrorCode;
  /**
   * Norwegian; replaces the view's first sentence. Never wire text (that is only logged).
   */
  message?: string;
}

/**
 * One frame of a streaming answer: `thinking-step`s, `token`s, `sources` once,
 * then `done` — or `error` at any point, which ends the stream. `sources` comes
 * last because the backend only knows the chunks at the final frame.
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'thinking-step'; step: ThinkingStep }
  | {
      type: 'sources';
      documents: SourceDocument[];
      citations: Citation[];
      retrieval: RetrievalDetails;
    }
  | {
      type: 'done';
      messageId: string;
      conversationId: string;
      /**
       * When the answer finished (ISO 8601): one time per turn, shared by screen and store.
       */
      createdAt?: string;
      /** How the agent ended the turn (`_meta.status`). Absent means `complete`. */
      outcome?: 'complete' | 'needs-clarification';
      /** Which corpus answered, as the client put it on the wire. Undefined: unknown. */
      corpusKey?: string;
    }
  | {
      type: 'error';
      error: ChatError;
      /**
       * When the turn ended (ISO 8601): stopped and `no-hits` turns stay as finished turns.
       */
      createdAt?: string;
      /** Which corpus the turn was asked of, as on `done`. */
      corpusKey?: string;
    };
