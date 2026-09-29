import { config } from './config.ts';

export interface Capabilities {
  filters: boolean;
  othersThreads: boolean;
  threadTitles: boolean;
}

const PROBE_TOOL = 'builtin.retrieve-only-agent__retrieve-only';
const PROBE_QUERY = 'tiltak og resultater';
const IMPOSSIBLE = {
  fields: [{ field: 'type', 'selected-options': ['ZZZ_ingen_slik_type'] }],
};

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
  return text.includes('"isError":true') ? null : countChunks(text);
}

export type Retrieve = (filterBy: unknown, signal: AbortSignal) => Promise<number | null>;

/** `null` is «could not tell»: a backend that is slow or down is not one without filters. */
export async function probeFilters(
  signal: AbortSignal,
  retrieve: Retrieve = retrieveOnly,
): Promise<boolean | null> {
  // Both at once, so the probe takes the slower call and not the sum of them.
  const [baseline, filtered] = await Promise.all([
    retrieve(undefined, signal),
    retrieve(IMPOSSIBLE, signal),
  ]);
  if (baseline === null || baseline === 0 || filtered === null) return null;
  return filtered === 0;
}

async function attempt(timeoutMs: number, retrieve: Retrieve): Promise<boolean | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await probeFilters(ac.signal, retrieve);
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
): Promise<Capabilities> {
  const override = fromEnv();
  if ('filters' in override) {
    current = { ...current, ...override };
    probed = true;
    return capabilities();
  }
  for (let tries = 0; ; tries += 1) {
    const filters = await attempt(timeoutMs, retrieve);
    const delay = retryDelaysMs[tries];
    if (filters !== null || delay === undefined) {
      current = { ...current, filters: filters ?? false, ...override };
      probed = true;
      return capabilities();
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
