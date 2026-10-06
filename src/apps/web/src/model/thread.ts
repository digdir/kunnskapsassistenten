import type { FilterSelection } from './filter';
import type { Message } from './message';

/**
 * One conversation in Kunnskapsassistenten. The design calls it «tråd»,
 * «samtale» and «chat» interchangeably; the code says thread throughout.
 *
 * `conversationId` is deliberately separate from `id`. The backend has two
 * conversation concepts that do not meet: a `conversation_id` created by
 * `tools/call` is not visible through `/api/conversations`. `id` is our own
 * thread key and the one in the route `/threads/:threadId`.
 * See design/eksisterende/api-for-frontend.md, gap 4.
 */
export interface Thread {
  id: string;
  /**
   * What the thread list shows for this thread.
   *
   * Until the backend generates one, it is the user's own first question,
   * unchanged. That is a stand-in and `titleFromQuestion` says so.
   */
  title: string;
  /**
   * True while `title` is the question standing in for a title nobody has
   * generated yet.
   *
   * It exists because the two places a title is drawn want opposite things
   * from it. The thread list needs SOMETHING to name the row, and the
   * question is the best thing available. The conversation itself must not
   * draw it: the question is already on screen as the user's own message, and
   * a heading repeating it word for word put the same sentence on the page
   * twice, at 36 px and at 18 px. Measured by #3, 2026-09-15.
   *
   * So the list reads `title`, and the conversation keeps its heading
   * visually hidden while this is true. The flag goes away on its own the day
   * the backend sends a real title, and neither place has to change.
   */
  titleFromQuestion?: boolean;
  /** ISO 8601. The backend returns epoch milliseconds; the client normalises. */
  createdAt: string;
  /**
   * ISO 8601. Drives the grouping in the thread list: «I dag», «Siste 7
   * dager», «Siste 30 dager», then month names, then the year (answer 6).
   */
  updatedAt: string;
  /** The backend conversation to continue on the next turn. */
  conversationId?: string;
  /**
   * Which corpus this thread was asked of — `dataset_config_key`.
   *
   * A thread belongs to the corpus it was started in, and cannot be continued
   * in another: the answers in it cite documents that only exist there. So it
   * is recorded when the thread is made rather than read from whatever is
   * selected now, and changing corpus starts a new thread instead of moving
   * this one.
   *
   * Undefined for threads made before there was a choice, and in mock mode,
   * where there is one corpus. The thread list draws it only when more than
   * one corpus exists (#2, del 2).
   */
  corpusKey?: string;
  /**
   * The filter the thread was started with, which every question in it is
   * asked with. By dimension, as the filter panel holds it.
   *
   * On a thread the browser has just made, it is the filter the first
   * question is asked with, so the client can store it when it makes the
   * conversation (live, `filter-value`; issue 90). On a thread read
   * back, it is what the backend kept.
   *
   * Absent when the thread has none, and when the client cannot know: the
   * mock keeps no filter on a thread, the BFF keeps it in memory
   * (src/decisions/0006-filter-fields-and-corpus-from-the-bff.md), and a live thread from
   * before #90 was made without one.
   */
  filter?: FilterSelection;
}

/** A thread with its messages, the shape a thread route needs. */
export interface ThreadDetail extends Thread {
  messages: Message[];
}

/**
 * A thread for a question that had none, created in the browser.
 *
 * The backend has no thread API to ask: a `conversation_id` from `tools/call`
 * is not visible through `/api/conversations`, so nothing on the server can
 * mint this id (gap 4 in design/eksisterende/api-for-frontend.md). Until that
 * changes, the id is ours and the title is the question.
 *
 * The question is stored whole, trimmed, with runs of whitespace collapsed —
 * not cut to a first sentence. Cutting it would be a second way of saying
 * what the user already said, and the list is free to clamp what it draws.
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
 * A thread id that is safe in a URL and will not collide.
 *
 * `crypto.randomUUID` needs a secure context, which `localhost` and https
 * both are; the fallback is for anything else rather than for correctness,
 * and it only has to be unique within one browser tab.
 */
function newThreadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
