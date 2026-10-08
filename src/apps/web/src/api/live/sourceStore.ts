import type { RetrievalDetails, ThinkingStep, ThinkingStepKind } from '../../model';
import type { McpChunk } from './mcp';

// What each answer was built from and how, kept in this browser because the backend keeps only
// the answer's text (headless-rag #21). No passage is stored, and everything fails quietly.
// Keyed by thread and answer text, since nothing else survives. See src/decisions/0008.

export const SOURCES_STORAGE_KEY = 'ka.sources.v1';

/**
 * Characters of JSON: well over a hundred answers at their largest, and well under the origin's
 * limit of about five million, which the rest of the app shares.
 */
export const MAX_STORED_CHARS = 1_000_000;

/** What is kept of one chunk: what `toSourceDocuments` reads, and no more. */
export type StoredChunk = Pick<McpChunk, 'chunk_id' | 'doc_num' | 'title' | 'url' | 'metadata'>;

/**
 * The fields of `Message` the backend forgets, under the same names. Absent means «the stream did
 * not say», never zero.
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
 * The answer text's length and FNV-1a hash, trimmed first. Not a guard: two answers in one thread
 * with the same length and hash would share their sources.
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

/** Drops the least recently used threads until the store fits; the newest goes last. */
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

/** Writes the store, retrying once with half the room when the browser says it is full. */
function write(store: Store): void {
  try {
    localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS));
  } catch {
    try {
      localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS / 2));
    } catch {
      // Blocked or full: the reader loses the sources at the next reload, and nothing worse.
    }
  }
}

/**
 * Stores what one answer was built from, through the same checks as reading, so what is written
 * can be read back. Nothing is stored for an answer with neither chunks nor steps.
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
 * One thread's stored answers by fingerprint, or undefined. Opening a thread counts as using it,
 * so it is not the one dropped.
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
 * Forgets everything, for «Logg ut» (session.ts): the store is per browser, and part of it comes
 * from the reader's own questions (src/decisions/0008).
 */
export function forgetAllAnswers(): void {
  try {
    localStorage.removeItem(SOURCES_STORAGE_KEY);
  } catch {
    // Blocked storage. Nothing was written there either.
  }
}
