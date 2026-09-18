import type { Source, Stage, TurnEvent } from '@ka/contract';
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

/** `/documents/<n>`, not `/files/` — the latter 404s. */
function documentUrl(chunk: ResultChunk): string {
  if (chunk.url) {
    const safe = safeHttpUrl(chunk.url);
    if (safe) return safe;
  }
  if (chunk.doc_num) return `${config.kudosBase}/documents/${chunk.doc_num}`;
  return '';
}

export async function toSources(
  chunks: ResultChunk[] | undefined,
  lookup: (ids: string[]) => Promise<Map<string, string>> = excerpts,
): Promise<Source[]> {
  if (!chunks?.length) return [];
  const byDoc = new Map<string, { chunk: ResultChunk; chunkIds: string[] }>();
  for (const c of chunks) {
    const key = c.doc_num || c.url;
    if (!key) continue;
    const entry = byDoc.get(key) ?? { chunk: c, chunkIds: [] };
    if (c.chunk_id) entry.chunkIds.push(c.chunk_id);
    byDoc.set(key, entry);
  }

  let text = new Map<string, string>();
  try {
    text = await lookup([...byDoc.values()].flatMap((e) => e.chunkIds));
  } catch {}

  return [...byDoc.values()].map(({ chunk, chunkIds }, i) => {
    const passages = chunkIds.map((id) => text.get(id)).filter(Boolean) as string[];
    return {
      docNum: chunk.doc_num ?? '',
      title: chunk.title || `Dokument ${chunk.doc_num ?? ''}`.trim(),
      url: documentUrl(chunk),
      marker: i + 1,
      ...(passages.length ? { excerpt: passages.join('\n\n') } : {}),
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

  const upstream = await fetch(`${config.apiBase}/api/mcp`, {
    method: 'POST',
    headers: { ...headers('tools/call', userId, tool), Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    yield { type: 'error', message: `Backend svarte ${upstream.status}.` };
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastStage: Stage | null = null;
  let streamedAnyText = false;
  let iteration = 0;
  let maxIterations = 10;

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
          const text = r.content?.[0]?.text ?? 'Ukjent feil fra backend.';
          yield { type: 'error', message: text, conversationId: convo };
          return;
        }

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
        if (meta.delta) {
          streamedAnyText = true;
          yield { type: 'delta', text: meta.delta };
        }
        continue;
      }

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

  yield { type: 'error', message: 'Forbindelsen til backend ble brutt.' };
}
