import type { IncomingMessage, ServerResponse } from 'node:http';
import { CHUNK_ID, MAX_EXCERPT_IDS } from '../shared/excerpts.ts';
import { parseCollections } from './facets.ts';

/**
 * The text of the chunks an answer was built from, looked up by their ids in
 * the dataset's chunks collection in Typesense.
 *
 * A bridge, like `/api/facets` (src/decisions/0008). The MCP answer names
 * its chunks and leaves their text out, and headless-rag has no route that
 * hands a caller the text of a chunk by id. The BFF in
 * digdir/kunnskapsassistenten looks the same ids up in the same collection,
 * so both clients show the same passage.
 *
 * Answered here and never forwarded, like `/api/facets` (app.ts).
 *
 * The ids come from the browser and go into a Typesense filter, which is the
 * one thing here that needs care: only ids made of the characters chunk ids
 * are made of, at most `MAX_IDS` of them, each in backticks. Anything else is
 * a 400 and Typesense is not asked. The dataset is looked up among the
 * configured ones and used as nothing else.
 */

export const EXCERPTS_PATH = '/api/excerpts';

/** The limit on ids per request; see shared/excerpts.ts. */
export const MAX_IDS = MAX_EXCERPT_IDS;

/**
 * Long enough for a slow Typesense, short enough that the panel does not wait
 * long. Measured by KA CC on #227: a Typesense that never answers gave 502
 * after 5011 ms.
 */
export const TIMEOUT_MS = 5_000;

export type ExcerptConfig = {
  /** Typesense, as a base URL with scheme and port and no trailing slash. */
  typesenseUrl: string | undefined;
  /**
   * The facets' key. It must be allowed to search the chunks collections as
   * well as the documents collections. Never leaves this server.
   */
  typesenseKey: string | undefined;
  /** Dataset key → the Typesense collection its chunks are in. */
  collections: ReadonlyMap<string, string>;
  /** How long Typesense gets before the route answers 502. A field so a test can shorten it. */
  timeoutMs: number;
};

/** Blank is missing, as in config.ts. */
function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The settings from the environment. Its own function, for the same reason as
 * `facetConfigFrom`: the Vite dev server mounts the same route.
 */
export function excerptConfigFrom(env: NodeJS.ProcessEnv): ExcerptConfig {
  return {
    typesenseUrl: value(env.TYPESENSE_URL)?.replace(/\/+$/, ''),
    typesenseKey: value(env.TYPESENSE_API_KEY),
    collections: parseCollections(env.KA_CHUNK_COLLECTIONS, 'KA_CHUNK_COLLECTIONS'),
    timeoutMs: TIMEOUT_MS,
  };
}

/**
 * The ids in `?ids=a,b,c`, or undefined when any of them is not an id or
 * there are too many. Repeats are asked for once.
 */
export function parseIds(raw: string | null): string[] | undefined {
  const ids = [
    ...new Set(
      (raw ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > MAX_IDS || !ids.every((id) => CHUNK_ID.test(id))) return undefined;
  return ids;
}

type TypesenseHits = {
  hits?: { document?: { chunk_id?: unknown; content_markdown?: unknown } }[];
};

async function loadExcerpts(
  config: ExcerptConfig,
  collection: string,
  ids: string[],
): Promise<Record<string, string>> {
  const url = new URL(
    `${config.typesenseUrl}/collections/${encodeURIComponent(collection)}/documents/search`,
  );
  url.searchParams.set('q', '*');
  url.searchParams.set('filter_by', `chunk_id:=[${ids.map((id) => `\`${id}\``).join(',')}]`);
  url.searchParams.set('include_fields', 'chunk_id,content_markdown');
  url.searchParams.set('per_page', String(ids.length));

  const response = await fetch(url, {
    headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey ?? '' },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  // The status and nothing of the body, as in facets.ts.
  if (!response.ok) throw new Error(`Typesense svarte ${response.status}`);

  const body = (await response.json()) as TypesenseHits;
  const excerpts: Record<string, string> = {};
  for (const hit of body.hits ?? []) {
    const { chunk_id: id, content_markdown: text } = hit.document ?? {};
    // Only an id that was asked for: the answer is keyed by what the client
    // sent, and a hit for anything else is not ours to pass on.
    if (typeof id !== 'string' || typeof text !== 'string' || !ids.includes(id)) continue;
    const trimmed = text.trim();
    if (trimmed) excerpts[id] = trimmed;
  }
  return excerpts;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

/**
 * The route. `{ excerpts: { <chunk id>: <text> } }`, with an id that was not
 * found left out, and an empty object for a dataset nobody configured — the
 * client then says the text could not be fetched, which is the truth.
 */
export function excerptRoute(config: ExcerptConfig) {
  return async function excerpts(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      json(response, 405, { error: 'Bare GET.' });
      return;
    }

    const params = new URL(request.url ?? '', 'http://localhost').searchParams;
    const ids = parseIds(params.get('ids'));
    if (!ids) {
      json(response, 400, { error: `Opptil ${MAX_IDS} id-er til biter, skilt med komma.` });
      return;
    }

    const dataset = params.get('dataset') ?? '';
    const collection = config.collections.get(dataset);
    if (ids.length === 0 || !collection || !config.typesenseUrl || !config.typesenseKey) {
      json(response, 200, { excerpts: {} });
      return;
    }

    try {
      json(response, 200, { excerpts: await loadExcerpts(config, collection, ids) });
    } catch (error) {
      // A configured dataset's name, never what the browser sent. Quoted all
      // the same, so a line break in it cannot start a log line of its own.
      console.error('[ka] utdragene for %s feilet: %s', JSON.stringify(dataset), String(error));
      json(response, 502, { error: 'Fikk ikke hentet utdragene.' });
    }
  };
}
