import { CHUNK_ID, MAX_EXCERPT_IDS } from '../../../shared/excerpts.ts';
import type { SourceDocument } from '../../model';

/**
 * The text of an answer's chunks, from our own server's `/api/excerpts`
 * (server/excerpts.ts, src/decisions/0008).
 *
 * The MCP answer names its chunks and leaves their text out, so every excerpt
 * in live arrived with an empty `text` and nothing saying why — the sources
 * panel drew the heading path and a blank box (issue 86d). This fills
 * the text in, or says it could not be had.
 */

/**
 * Long enough for the server's own 5 s towards Typesense, and a little more:
 * the server's 502 is the answer that should arrive, and this is the backstop
 * for a server that does not answer at all.
 */
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
  // The caller's signal and a timeout, as one. By hand rather than with
  // `AbortSignal.any`, which the test environment does not have.
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
 * The texts by chunk id, or undefined when they could not be fetched at all.
 *
 * Undefined and an empty map are told apart on purpose: undefined is «the
 * lookup failed», an empty map is «it answered, and none of these were
 * found». The excerpts come out the same either way — `textUnavailable` —
 * but only the first is worth a line in the console.
 *
 * In requests of `MAX_EXCERPT_IDS`, side by side. headless-rag gives one
 * answer at most that many chunks today, so this is one request; the day it
 * gives more, the answer still gets its text instead of a 400 (KA CC on
 * #227). A request that fails costs only its own ids.
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
 * Every chunk id in the documents that can be asked for, in order, once each.
 *
 * Checked against the server's own grammar (shared/excerpts.ts). An excerpt
 * whose chunk came with no id has one this client made up, and an id the
 * server refuses would cost the whole request.
 */
export function excerptIds(documents: SourceDocument[]): string[] {
  const ids = documents.flatMap((document) => document.excerpts.map((excerpt) => excerpt.id));
  return [...new Set(ids.filter((id) => CHUNK_ID.test(id)))];
}

/**
 * The documents with each excerpt's text filled in, or `textUnavailable` set
 * where there is none: the lookup failed, or this chunk was not found.
 *
 * `textUnavailable` is the model's own word for it, and the sources panel says
 * it in words (source.ts). An empty `text` with no flag is what live used to
 * send, and it drew as a box with nothing in it.
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
