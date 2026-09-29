import { config } from './config.ts';
import type { FilterFieldSpec } from './datasetConfig.ts';

export interface Capabilities {
  filters: boolean;
  othersThreads: boolean;
  threadTitles: boolean;
}

const PROBE_TOOL = 'builtin.retrieve-only-agent__retrieve-only';
const PROBE_QUERY = 'tiltak og resultater';

/** A value no document has, on a configured field. Without fields there is nothing to probe. */
export function impossibleFilter(fields: readonly FilterFieldSpec[]) {
  const spec = fields.find((f) => f.valueType !== 'integer') ?? fields[0];
  if (!spec) return undefined;
  return {
    fields: [
      {
        field: spec.field,
        'selected-options': [spec.valueType === 'integer' ? '-1' : 'ZZZ_ingen_slik_verdi'],
        ...(spec.valueType ? { 'value-type': spec.valueType } : {}),
      },
    ],
  };
}

let current: Capabilities = { filters: false, othersThreads: false, threadTitles: false };
let probed = false;

export const capabilities = (): Capabilities => ({ ...current });
export const probeComplete = (): boolean => probed;

export function noteTitleFromBackend(sent: string, received: string): void {
  if (received && received !== sent) current = { ...current, threadTitles: true };
}

function countChunks(text: string): number {
  let most = 0;
  for (const m of text.matchAll(/"chunks":\s*(\[[\s\S]*?\])\s*(?:,\s*"queries"|\})/g)) {
    try {
      const n = (JSON.parse(m[1] ?? '[]') as unknown[]).length;
      if (n > most) most = n;
    } catch {}
  }
  return most;
}

async function retrieveOnly(filterBy: unknown, signal: AbortSignal): Promise<number | null> {
  const res = await fetch(`${config.apiBase}/api/mcp`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-API-Key': config.apiKey,
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': PROBE_TOOL,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: PROBE_TOOL,
        arguments: {
          query: PROBE_QUERY,
          tenant: config.tenant,
          dataset_config_key: config.datasetConfigKey,
          ...(filterBy ? { overrides: { 'retrieve-filter-by': filterBy } } : {}),
        },
      },
    }),
  });
  if (!res.ok) return null;
  const text = await res.text();
  return refused(text) ? null : countChunks(text);
}

/** A tool error in the result, or a JSON-RPC error with no result: #15 refuses a bad filter so. */
export function refused(text: string): boolean {
  if (text.includes('"isError":true')) return true;
  const bodies = text.trimStart().startsWith('{')
    ? [text]
    : text
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6));
  return bodies.some((body) => {
    try {
      const msg = JSON.parse(body) as { error?: unknown; result?: unknown };
      return msg.error !== undefined && msg.result === undefined;
    } catch {
      return false;
    }
  });
}

export type Retrieve = (filterBy: unknown, signal: AbortSignal) => Promise<number | null>;

/** `null` is «could not tell»: a backend that is slow or down is not one without filters. */
export async function probeFilters(
  signal: AbortSignal,
  impossible: unknown,
  retrieve: Retrieve = retrieveOnly,
): Promise<boolean | null> {
  // Both at once, so the probe takes the slower call and not the sum of them.
  const [baseline, filtered] = await Promise.all([
    retrieve(undefined, signal),
    retrieve(impossible, signal),
  ]);
  if (baseline === null || baseline === 0 || filtered === null) return null;
  return filtered === 0;
}

async function attempt(
  timeoutMs: number,
  impossible: unknown,
  retrieve: Retrieve,
): Promise<boolean | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await probeFilters(ac.signal, impossible, retrieve);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fromEnv(): Partial<Capabilities> {
  const raw = process.env.KA_CAPABILITIES?.trim();
  if (!raw) return {};
  const on = new Set(raw.split(/[,\s]+/).filter(Boolean));
  const pick = (k: keyof Capabilities) =>
    on.has(k) ? { [k]: true } : on.has(`no-${k}`) ? { [k]: false } : {};
  return { ...pick('filters'), ...pick('othersThreads'), ...pick('threadTitles') };
}

const RETRY_DELAYS_MS = [60_000, 5 * 60_000];

/** Unsettled until the backend answers yes or no, or the retries run out. */
export async function probe(
  timeoutMs = 60_000,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
  retrieve: Retrieve = retrieveOnly,
  fields: readonly FilterFieldSpec[] = config.filterFields,
): Promise<Capabilities> {
  const override = fromEnv();
  const impossible = impossibleFilter(fields);
  if ('filters' in override || !impossible) {
    current = { ...current, filters: false, ...override };
    probed = true;
    return capabilities();
  }
  for (let tries = 0; ; tries += 1) {
    const filters = await attempt(timeoutMs, impossible, retrieve);
    const delay = retryDelaysMs[tries];
    if (filters !== null || delay === undefined) {
      current = { ...current, filters: filters ?? false, ...override };
      probed = true;
      return capabilities();
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
