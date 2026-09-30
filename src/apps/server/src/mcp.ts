import type { DeltaEvent, Source, Stage, TurnEvent } from '@ka/contract';
import { config } from './config.ts';
import { excerpts } from './excerpts.ts';

const PROTOCOL_VERSION = '2026-07-28';

const allowedTools = new Set<string>();

export function setAllowedTools(ids: string[]): void {
  allowedTools.clear();
  for (const id of ids) allowedTools.add(id);
}

/** Derived from the body: a disagreeing header is rejected with -32020. */
function headers(method: string, userId: string, toolName?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
    'X-User-Id': userId,
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    'Mcp-Method': method,
  };
  if (toolName) h['Mcp-Name'] = toolName;
  return h;
}

interface ProgressMeta {
  event?: string;
  delta?: string;
  iteration?: number | string;
  'max-iterations'?: number | string;
  'tool-calls'?: unknown;
  reasoning?: string;
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

function toStage(event: string, meta: ProgressMeta): Stage | null {
  switch (event) {
    case 'agent/iteration-started':
      return 'starting';
    case 'agent/turn-completed': {
      const calls = JSON.stringify(meta['tool-calls'] ?? '');
      if (calls.includes('read_chunks')) return 'reading';
      if (calls.includes('search') || calls.includes('plan_queries')) return 'searching';
      return 'starting';
    }
    case 'agent/thinking':
      return 'writing';
    case 'agent/finalized':
      return 'done';
    default:
      return null;
  }
}

function queriesFrom(toolCalls: unknown): string[] | undefined {
  const found: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (k === 'queries' && Array.isArray(val)) {
          found.push(...val.filter((q): q is string => typeof q === 'string'));
        } else walk(val);
      }
    }
  };
  walk(toolCalls);
  return found.length ? found : undefined;
}

export function takeFrames(buffer: string): { frames: string[]; rest: string } {
  const frames: string[] = [];
  let rest = buffer;
  let sep: number;
  while ((sep = rest.indexOf('\n\n')) !== -1) {
    frames.push(rest.slice(0, sep));
    rest = rest.slice(sep + 2);
  }
  return { frames, rest };
}

export function frameData(frame: string): Record<string, any> | null {
  const line = frame.split('\n').find((l) => l.startsWith('data: '));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(6)) as Record<string, any>;
  } catch {
    return null;
  }
}

export interface ResultChunk {
  chunk_id?: string;
  doc_num?: string;
  chunk_index?: number;
  title?: string;
  url?: string;
}

function safeHttpUrl(value: string): string {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : '';
  } catch {
    return '';
  }
}

const DIGITS = /^\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/documents/<n>`, not `/files/` — the latter 404s.
 *
 * Kudos answers the two shapes of a document number at different addresses
 * (measured 30.09): `/documents/<number>` is a 301 to the document,
 * `/documents/<uuid>` is a 404, and `/dokument/<uuid>` is the document. The
 * Kudos API now gives only UUIDs (headless-rag #25), so a corpus loaded again
 * after that fix has them. A number in neither shape gets no link rather than
 * a guess, which also keeps anything but digits or a UUID out of the path.
 */
function documentUrl(chunk: ResultChunk): string {
  if (chunk.url) {
    const safe = safeHttpUrl(chunk.url);
    if (safe) return safe;
  }
  const num = chunk.doc_num?.trim() ?? '';
  if (DIGITS.test(num)) return `${config.kudosBase}/documents/${num}`;
  if (UUID.test(num)) return `${config.kudosBase}/dokument/${num}`;
  return '';
}

/**
 * The retrieved chunks as sources, one per chunk and in retrieval order.
 *
 * The index IS the marker: `[N]` in the answer is the agent's 1-based index
 * into this same list, so nothing here may reorder it, group it or drop an
 * entry. An earlier version grouped by document and numbered the documents,
 * which silently shifted every marker as soon as one document gave two
 * chunks. Dropping a chunk without a `doc_num` would shift them the same way,
 * so such a chunk keeps its place with an empty `docNum` and the client names
 * it by its marker.
 */
export async function toSources(
  chunks: ResultChunk[] | undefined,
  lookup: (ids: string[]) => Promise<Map<string, string>> = excerpts,
): Promise<Source[]> {
  if (!chunks?.length) return [];

  let text = new Map<string, string>();
  try {
    text = await lookup(chunks.flatMap((c) => (c.chunk_id ? [c.chunk_id] : [])));
  } catch {}

  return chunks.map((chunk, i) => {
    const passage = chunk.chunk_id ? text.get(chunk.chunk_id) : undefined;
    return {
      docNum: chunk.doc_num ?? '',
      title: chunk.title || `Dokument ${chunk.doc_num ?? ''}`.trim(),
      url: documentUrl(chunk),
      marker: i + 1,
      ...(chunk.chunk_id ? { chunkId: chunk.chunk_id } : {}),
      ...(passage ? { excerpt: passage } : {}),
    };
  });
}

/** Never accumulates the upstream body: that would stall the stream. */
export async function* ask(
  query: string,
  userId: string,
  conversationId: string | undefined,
  signal: AbortSignal,
  requestedTool?: string,
  filterBy?: { fields: Array<{ field: string; 'selected-options': string[] }> },
): AsyncGenerator<TurnEvent> {
  const tool = requestedTool && allowedTools.has(requestedTool) ? requestedTool : config.tool;
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: tool,
      _meta: { progressToken: `ka-${Date.now()}` },
      arguments: {
        query,
        // Silently dropped unless the backend advertises filter support.
        ...(filterBy ? { overrides: { 'retrieve-filter-by': filterBy } } : {}),
        tenant: config.tenant,
        dataset_config_key: config.datasetConfigKey,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      },
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${config.apiBase}/api/mcp`, {
      method: 'POST',
      headers: { ...headers('tools/call', userId, tool), Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    // An abort is the caller's own doing and stays an exception, so the route
    // can tell it from a failure. Everything else here is the backend not
    // being there at all — a DNS miss, a refused connection, a dead TLS
    // session — which is a different thing from any answer it could give, and
    // the only place that knows it is this one.
    if (err instanceof Error && err.name === 'AbortError') throw err;
    const why =
      err instanceof Error ? ((err.cause as { code?: string })?.code ?? err.name) : '';
    yield {
      type: 'error',
      message: `Fikk ikke kontakt med backend${why ? ` (${why})` : ''}.`,
      code: 'backend_unreachable',
    };
    return;
  }

  if (!upstream.ok || !upstream.body) {
    // The sentence keeps the status, because that is what anyone debugging
    // from a screenshot has to go on; the code is what the client acts on.
    yield {
      type: 'error',
      message: `Backend svarte ${upstream.status}.`,
      code: `backend_http_${upstream.status}`,
    };
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastStage: Stage | null = null;
  let streamedAnyText = false;
  let iteration = 0;
  let maxIterations = 10;
  // A `response/chunk` is not known to be answer text when it arrives. Against
  // this agent every run of them is its plan, repeated by the `agent/thinking`
  // that follows, and the answer comes whole in the final frame. So deltas are
  // held: `agent/thinking` drops them, `agent/finalized` and the result release
  // them. An agent that streams its answer still streams it.
  let pending: string[] = [];
  function* release(): Generator<DeltaEvent> {
    for (const text of pending) {
      streamedAnyText = true;
      yield { type: 'delta', text };
    }
    pending = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const { frames, rest } = takeFrames(buffer);
    buffer = rest;

    for (const frame of frames) {
      const msg = frameData(frame);
      if (!msg) continue;

      if (msg.result) {
        const r = msg.result;
        const sc = r.structuredContent ?? {};
        const meta = r._meta ?? {};
        const convo: string | undefined = sc.conversation_id ?? meta.conversation_id;

        if (r.isError) {
          // The backend names the condition in `_meta.code`
          // (digdir/mcp/tools.clj, `error->tool-result`). It was dropped here,
          // so every one of them — an unauthorized dataset, a mode that does
          // not exist, a model that did not answer — reached the client as
          // English prose to guess at.
          const text = r.content?.[0]?.text ?? 'Ukjent feil fra backend.';
          const code = typeof meta.code === 'string' ? meta.code : undefined;
          yield {
            type: 'error',
            message: text,
            ...(code ? { code } : {}),
            conversationId: convo,
          };
          return;
        }

        yield* release();
        if (!streamedAnyText) {
          const full = r.content?.find((b: { type?: string }) => b.type === 'text')?.text;
          if (full) yield { type: 'delta', text: full };
        }

        const sources = await toSources(sc.chunks);
        if (sources.length) yield { type: 'sources', sources };
        yield {
          type: 'done',
          conversationId: convo ?? '',
          insufficient: Boolean(meta.insufficient),
        };
        return;
      }

      // A tools/call that named something nonexistent comes back as a
      // JSON-RPC error with the code in `data.code`, not as a result
      // (digdir/mcp/transport.clj, `invalid-params`). Nothing read these
      // frames, so the stream simply ran out and the reader was told the
      // connection broke.
      if (msg.error) {
        const e = msg.error as { message?: string; code?: number; data?: { code?: unknown } };
        const backendCode = typeof e.data?.code === 'string' ? e.data.code : undefined;
        yield {
          type: 'error',
          message: e.message ?? `Backend svarte JSON-RPC-feil ${e.code ?? ''}`.trim(),
          ...(backendCode ? { code: backendCode } : {}),
        };
        return;
      }

      const meta: ProgressMeta = msg.params?._meta ?? {};
      const event = meta.event;
      if (!event) continue;

      iteration = num(meta.iteration, iteration);
      maxIterations = num(meta['max-iterations'], maxIterations);

      if (event === 'response/chunk') {
        if (lastStage !== 'writing') {
          lastStage = 'writing';
          yield { type: 'stage', stage: 'writing', iteration, maxIterations };
        }
        if (meta.delta) pending.push(meta.delta);
        continue;
      }

      if (event === 'agent/thinking') pending = [];
      if (event === 'agent/finalized') yield* release();

      const stage = toStage(event, meta);
      if (!stage || stage === lastStage) continue;
      lastStage = stage;
      yield {
        type: 'stage',
        stage,
        iteration,
        maxIterations,
        ...(event === 'agent/turn-completed'
          ? { queries: queriesFrom(meta['tool-calls']) }
          : {}),
      };
    }
  }

  yield {
    type: 'error',
    message: 'Forbindelsen til backend ble brutt.',
    code: 'stream_broken',
  };
}
