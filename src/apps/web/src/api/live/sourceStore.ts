import type { RetrievalDetails, ThinkingStep, ThinkingStepKind } from '../../model';
import type { McpChunk } from './mcp';

/**
 * What each answer was built from and how, kept in this browser, so the
 * sources and «Fremgangsmåte» come back when the page is loaded again
 * (runde 3, ekstra 2, and issue 88; src/decisions/0008).
 *
 * The backend keeps the answer's text and nothing else: a thread read back
 * has `chunks: []` on every message (headless-rag #21), and no steps at all.
 * So the one record of them is what the live answer carried, and this is
 * where it is written down.
 *
 * Only what the answer itself carried is kept. For the chunks: the id, the
 * document's number, its title, its address and the heading path. No passage
 * from any document is written to the browser; the text is looked up again
 * from the same route a fresh answer uses (excerpts.ts), so a fresh answer and
 * one read back cannot show two texts for one chunk. For the steps: what the
 * stream said, which is the agent's own words about what it did, the search
 * strings it ran, the numbers of hits and documents, and how long it thought.
 *
 * Keyed by the conversation and by the answer's text, because nothing else
 * survives: the live stream names its answer `msg-<time>`, and the store gives
 * the same answer an id of its own. The stored text was measured to be the
 * text `tools/call` returned, character for character (30.09, one answer).
 *
 * Everything here fails quietly. Storage that is full, blocked or corrupt
 * leaves the reader where they were before this existed — sources gone after
 * a reload — and never costs them an answer.
 */

export const SOURCES_STORAGE_KEY = 'ka.sources.v1';

/**
 * The most this store takes, in characters of JSON. A chunk is about 380
 * (KA CC measured 5308 for 14 on #227), an answer at most 20 chunks and its
 * steps, so this is well over a hundred answers at their largest and many
 * more as they come. Browsers give an origin about five million, and the rest
 * of this app needs some of it.
 */
export const MAX_STORED_CHARS = 1_000_000;

/** What is kept of one chunk: what `toSourceDocuments` reads, and no more. */
export type StoredChunk = Pick<McpChunk, 'chunk_id' | 'doc_num' | 'title' | 'url' | 'metadata'>;

/**
 * What is kept of one answer: the fields of `Message` the backend forgets,
 * under the same names, so restoring one is copying it across.
 *
 * Every field but `chunks` is optional, and absent means «the stream did not
 * say», never zero: an answer from before the steps were kept has none, and
 * draws as it did then.
 */
export type StoredAnswer = {
  /** In the order the answer numbered them. */
  chunks: StoredChunk[];
  /** «Fremgangsmåte», in arrival order. */
  thinkingSteps?: ThinkingStep[];
  /** The hits, the documents and the search words, for the detailed view. */
  retrieval?: RetrievalDetails;
  /** From the first step to the first word of the answer. See `Message.thoughtMs`. */
  thoughtMs?: number;
};

/** What the client hands over when an answer is done. */
export type AnswerRecord = {
  chunks: McpChunk[];
  thinkingSteps?: ThinkingStep[];
  retrieval?: RetrievalDetails;
  thoughtMs?: number;
};

type StoredThread = {
  /** When this thread was last written or opened, for choosing what to drop. */
  usedAt: number;
  /** Answer fingerprint → what is kept of it. */
  answers: Record<string, StoredAnswer>;
};

type Store = { threads: Record<string, StoredThread> };

/**
 * A short, stable name for an answer's text: its length and an FNV-1a hash of
 * it. Trimmed first, because whitespace at the ends is the one difference a
 * store could introduce without changing the answer.
 *
 * Not a secret and not a guard against anyone: two answers in one thread with
 * the same length and hash would share their sources, and those are the odds
 * of a 32-bit collision among a handful of strings.
 */
export function answerFingerprint(text: string): string {
  const trimmed = text.trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${trimmed.length}.${hash.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const optionalString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** One stored chunk, or nothing, from whatever was in storage. */
function chunkFrom(value: unknown): StoredChunk | undefined {
  if (!isRecord(value)) return undefined;
  const chunk: StoredChunk = {};
  const id = optionalString(value.chunk_id);
  const docNum = optionalString(value.doc_num);
  const title = optionalString(value.title);
  const url = optionalString(value.url);
  const metadata = optionalString(value.metadata);
  if (id) chunk.chunk_id = id;
  if (docNum) chunk.doc_num = docNum;
  if (title) chunk.title = title;
  if (url) chunk.url = url;
  if (metadata) chunk.metadata = metadata;
  return chunk;
}

const STEP_KINDS: readonly ThinkingStepKind[] = ['reasoning', 'search', 'read', 'finalizing'];

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/** One stored step, or nothing. A step with no id, kind or label draws as nothing. */
function stepFrom(value: unknown): ThinkingStep | undefined {
  if (!isRecord(value)) return undefined;
  const id = optionalString(value.id);
  const label = optionalString(value.label);
  const kind = STEP_KINDS.find((known) => known === value.kind);
  if (!id || !label || !kind) return undefined;

  const step: ThinkingStep = { id, kind, label };
  const detail = optionalString(value.detail);
  const queries = strings(value.queries);
  const durationMs = count(value.durationMs);
  if (detail) step.detail = detail;
  if (queries) step.queries = queries;
  if (durationMs !== undefined) step.durationMs = durationMs;
  return step;
}

function retrievalFrom(value: unknown): RetrievalDetails | undefined {
  if (!isRecord(value)) return undefined;
  const hitCount = count(value.hitCount);
  const documentCount = count(value.documentCount);
  const keywords = strings(value.keywords);
  if (hitCount === undefined || documentCount === undefined || !keywords) return undefined;
  return { hitCount, documentCount, keywords };
}

/** One stored answer, or nothing, from whatever was in storage. */
function answerFrom(value: unknown): StoredAnswer | undefined {
  if (!isRecord(value) || !Array.isArray(value.chunks)) return undefined;

  const answer: StoredAnswer = { chunks: value.chunks.flatMap((chunk) => chunkFrom(chunk) ?? []) };
  const steps = Array.isArray(value.thinkingSteps)
    ? value.thinkingSteps.flatMap((step) => stepFrom(step) ?? [])
    : [];
  const retrieval = retrievalFrom(value.retrieval);
  const thoughtMs = count(value.thoughtMs);
  if (steps.length > 0) answer.thinkingSteps = steps;
  if (retrieval) answer.retrieval = retrieval;
  if (thoughtMs !== undefined) answer.thoughtMs = thoughtMs;
  return answer;
}

/** The store as it is in `localStorage`, or an empty one. Never throws. */
function read(): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) ?? 'null');
    if (!isRecord(parsed) || !isRecord(parsed.threads)) return { threads: {} };

    const threads: Record<string, StoredThread> = {};
    for (const [id, thread] of Object.entries(parsed.threads)) {
      if (!isRecord(thread) || !isRecord(thread.answers)) continue;
      const answers: Record<string, StoredAnswer> = {};
      for (const [fingerprint, value] of Object.entries(thread.answers)) {
        const answer = answerFrom(value);
        if (answer) answers[fingerprint] = answer;
      }
      threads[id] = { usedAt: typeof thread.usedAt === 'number' ? thread.usedAt : 0, answers };
    }
    return { threads };
  } catch {
    return { threads: {} };
  }
}

/**
 * Drops the threads used longest ago until the store fits `limit`. The thread
 * just written is the newest, so it is the last to go.
 */
function trimmed(store: Store, limit: number): string {
  let json = JSON.stringify(store);
  const oldestFirst = Object.entries(store.threads)
    .sort(([, a], [, b]) => a.usedAt - b.usedAt)
    .map(([id]) => id);
  while (json.length > limit && oldestFirst.length > 1) {
    delete store.threads[oldestFirst.shift() as string];
    json = JSON.stringify(store);
  }
  return json;
}

/**
 * Writes the store, and when the browser says it is full anyway, tries once
 * more with half the room. Never throws.
 */
function write(store: Store): void {
  try {
    localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS));
  } catch {
    try {
      localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS / 2));
    } catch {
      // Blocked or full. The reader loses their sources at the next reload,
      // which is what happened before this store existed.
    }
  }
}

/**
 * Writes down what one answer was built from and how. An answer with neither
 * chunks nor steps writes nothing, and there is nothing to bring back for it.
 *
 * Every value is put through the same check as on the way in from storage,
 * so what is written is exactly what can be read back.
 */
export function rememberAnswer(
  threadId: string,
  answerText: string,
  record: AnswerRecord,
  now = Date.now(),
): void {
  const steps = record.thinkingSteps ?? [];
  if (!threadId || answerText.trim() === '') return;
  if (record.chunks.length === 0 && steps.length === 0) return;

  const answer = answerFrom({
    ...record,
    chunks: record.chunks.map((chunk) => ({
      ...chunk,
      // One name for the title, whichever of the three it arrived under.
      title: chunk.title ?? chunk.doc_title ?? chunk.docTitle,
    })),
  });
  if (!answer) return;

  const store = read();
  const thread = store.threads[threadId] ?? { usedAt: now, answers: {} };
  thread.usedAt = now;
  thread.answers[answerFingerprint(answerText)] = answer;
  store.threads[threadId] = thread;
  write(store);
}

/**
 * What was written down for one thread's answers, by fingerprint, or
 * undefined when there is nothing. Opening a thread counts as using it, so a
 * thread the reader keeps coming back to is not the one dropped.
 */
export function recallThread(
  threadId: string,
  now = Date.now(),
): ReadonlyMap<string, StoredAnswer> | undefined {
  const store = read();
  const thread = store.threads[threadId];
  if (!thread) return undefined;

  thread.usedAt = now;
  write(store);
  return new Map(Object.entries(thread.answers));
}

/**
 * Forgets everything this store holds, for «Logg ut» (session.ts).
 *
 * The store is per browser and not per user, and part of it comes of the
 * reader's own questions: the search words and the agent's plan
 * (src/decisions/0008, «What the store holds»). The next person to sign
 * in on the same browser should not find them. Fails quietly, like the rest
 * of this file: storage that cannot be reached has nothing to forget.
 */
export function forgetAllAnswers(): void {
  try {
    localStorage.removeItem(SOURCES_STORAGE_KEY);
  } catch {
    // Blocked storage. Nothing was written there either.
  }
}
