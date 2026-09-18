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

async function probeFilters(signal: AbortSignal): Promise<boolean> {
  const baseline = await retrieveOnly(undefined, signal);
  if (baseline === null || baseline === 0) return false;
  const filtered = await retrieveOnly(IMPOSSIBLE, signal);
  return filtered === 0;
}

function fromEnv(): Partial<Capabilities> {
  const raw = process.env.KA_CAPABILITIES?.trim();
  if (!raw) return {};
  const on = new Set(raw.split(/[,\s]+/).filter(Boolean));
  const pick = (k: keyof Capabilities) =>
    on.has(k) ? { [k]: true } : on.has(`no-${k}`) ? { [k]: false } : {};
  return { ...pick('filters'), ...pick('othersThreads'), ...pick('threadTitles') };
}

export async function probe(timeoutMs = 60_000): Promise<Capabilities> {
  const override = fromEnv();
  if ('filters' in override) {
    current = { ...current, ...override };
    probed = true;
    return capabilities();
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    current = { ...current, filters: await probeFilters(ac.signal) };
  } catch {
    current = { ...current, filters: false };
  } finally {
    clearTimeout(timer);
  }
  current = { ...current, ...override };
  probed = true;
  return capabilities();
}
