import type { FilterSelection } from './filter';
import type { Message } from './message';

/**
 * One conversation («tråd», «samtale» or «chat» in the design). `id` is our own
 * key and the route's; `conversationId` is separate because a `tools/call`
 * conversation is not visible through `/api/conversations`.
 */
export interface Thread {
  id: string;
  /** What the thread list shows: the first question until the backend generates a title. */
  title: string;
  /**
   * `title` is the question, so the conversation hides its heading (the question is on screen).
   */
  titleFromQuestion?: boolean;
  /** ISO 8601. The backend returns epoch milliseconds; the client normalises. */
  createdAt: string;
  /** ISO 8601. Drives the thread list grouping («I dag», «Siste 7 dager», …). */
  updatedAt: string;
  /** The backend conversation to continue on the next turn. */
  conversationId?: string;
  /**
   * The corpus it started in; fixed, since its answers cite only that corpus. Undefined: older.
   */
  corpusKey?: string;
  /**
   * The filter every question in it uses. Absent if none or not known (src/decisions/0006).
   */
  filter?: FilterSelection;
}

/** A thread with its messages, the shape a thread route needs. */
export interface ThreadDetail extends Thread {
  messages: Message[];
}

/**
 * A thread for a question that had none, with an id minted in the browser and
 * the whole question (whitespace collapsed) as title; the list clamps it.
 */
export function threadFromQuestion(question: string, now: Date = new Date()): Thread {
  const timestamp = now.toISOString();
  return {
    id: newThreadId(),
    title: question.trim().replace(/\s+/g, ' '),
    titleFromQuestion: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * URL-safe id. `crypto.randomUUID` needs a secure context; otherwise unique per tab is enough.
 */
function newThreadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
