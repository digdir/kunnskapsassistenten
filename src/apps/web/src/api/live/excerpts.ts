import { CHUNK_ID, MAX_EXCERPT_IDS } from '../../../shared/excerpts.ts';
import type { SourceDocument } from '../../model';

// The text of an answer's chunks, from our own server's `/api/excerpts` (src/decisions/0008):
// the MCP answer names its chunks but leaves their text out.

/** A little over the server's own 5 s towards Typesense, so its 502 arrives first. */
export const EXCERPT_TIMEOUT_MS = 6_000;

/** One request, or undefined when it failed. */
async function fetchBatch(
  basePath: string,
  dataset: string,
  ids: string[],
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Map<string, string> | undefined> {
  const query = new URLSearchParams({ dataset, ids: ids.join(',') });
  // The caller's signal and a timeout, as one. By hand rather than with `AbortSignal.any`, which
  // the test environment does not have.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const response = await fetch(`${basePath}/excerpts?${query}`, { signal: controller.signal });
    if (!response.ok) {
      console.warn('KA: utdragene svarte %d.', response.status);
      return undefined;
    }
    const body = (await response.json()) as { excerpts?: Record<string, unknown> };
    return new Map(
      Object.entries(body.excerpts ?? {}).flatMap(([id, text]) =>
        typeof text === 'string' && text.trim() !== '' ? [[id, text]] : [],
      ),
    );
  } catch (error) {
    // A reader who stopped the answer is not a failure worth reporting.
    if (!signal?.aborted) console.warn('KA: fikk ikke hentet utdragene.', error);
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/**
 * The texts by chunk id, or undefined when the lookup failed (an empty map means none were found).
 * Requests go in parallel, `MAX_EXCERPT_IDS` ids each, so a failed one costs only its own ids.
 */
export async function fetchExcerptTexts(
  basePath: string,
  dataset: string | undefined,
  ids: string[],
  signal?: AbortSignal,
  timeoutMs = EXCERPT_TIMEOUT_MS,
): Promise<Map<string, string> | undefined> {
  if (!dataset || ids.length === 0) return new Map();

  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += MAX_EXCERPT_IDS) {
    batches.push(ids.slice(start, start + MAX_EXCERPT_IDS));
  }
  const answers = await Promise.all(
    batches.map((batch) => fetchBatch(basePath, dataset, batch, signal, timeoutMs)),
  );
  if (answers.every((answer) => answer === undefined)) return undefined;
  return new Map(answers.flatMap((answer) => [...(answer ?? [])]));
}

/**
 * Every chunk id the server's grammar accepts (shared/excerpts.ts), in order, once each: an id the
 * server refuses would cost the whole request.
 */
export function excerptIds(documents: SourceDocument[]): string[] {
  const ids = documents.flatMap((document) => document.excerpts.map((excerpt) => excerpt.id));
  return [...new Set(ids.filter((id) => CHUNK_ID.test(id)))];
}

/**
 * The documents with each excerpt's text filled in, or `textUnavailable` set where there is none,
 * so the sources panel says so instead of drawing an empty box.
 */
export function withExcerptTexts(
  documents: SourceDocument[],
  texts: ReadonlyMap<string, string> | undefined,
): SourceDocument[] {
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map((excerpt) => {
      const text = texts?.get(excerpt.id);
      if (text) return { ...excerpt, text };
      return { ...excerpt, text: '', textUnavailable: true };
    }),
  }));
}
