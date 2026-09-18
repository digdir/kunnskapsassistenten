import { config } from './config.ts';

type Result = { ok: boolean; detail: string; fix?: string };

const results: Array<{ name: string; result: Result }> = [];

async function check(name: string, fn: () => Promise<Result>): Promise<Result> {
  let result: Result;
  try {
    result = await fn();
  } catch (err) {
    result = {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
      fix: 'Is DIGDIR_API_BASE right, and is the host reachable?',
    };
  }
  results.push({ name, result });
  const mark = result.ok ? '[32m✓[0m' : '[31m✗[0m';
  console.log(`${mark} ${name.padEnd(26)} ${result.detail}`);
  if (!result.ok && result.fix) console.log(`  ${' '.repeat(26)} → ${result.fix}`);
  return result;
}

const headers = () => ({ 'X-API-Key': config.apiKey, 'Content-Type': 'application/json' });

const withTimeout = (ms: number) => AbortSignal.timeout(ms);

async function models(): Promise<Result> {
  const res = await fetch(`${config.apiBase}/v1/models`, {
    headers: headers(),
    signal: withTimeout(15_000),
  });
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      detail: `${res.status} — the key was rejected`,
      fix: `DIGDIR_API_KEY is not valid for ${config.apiBase}. Keys are per environment: a key minted against a local backend will not work against a deployed one.`,
    };
  }
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };

  const body = (await res.json()) as { data?: Array<{ id: string }> };
  const ids = (body.data ?? []).map((m) => m.id);
  if (!ids.length) return { ok: false, detail: 'authenticated, but the key grants no agents' };

  if (!ids.includes(config.tool)) {
    return {
      ok: false,
      detail: `${ids.length} agents, but not the pinned one`,
      fix: `DIGDIR_TOOL is "${config.tool}". Available: ${ids.join(', ')}`,
    };
  }
  return { ok: true, detail: `${ids.length} agents, including the pinned one` };
}

async function conversations(): Promise<Result> {
  const res = await fetch(`${config.apiBase}/api/conversations?page_size=1`, {
    headers: { ...headers(), 'X-User-Id': 'doctor-probe' },
    signal: withTimeout(15_000),
  });
  if (!res.ok) {
    return {
      ok: false,
      detail: `HTTP ${res.status}`,
      fix: 'Threads will not list or persist. The chat itself may still work.',
    };
  }
  return { ok: true, detail: 'readable and scoped by X-User-Id' };
}

async function typesense(): Promise<Result> {
  if (!config.typesenseHost || !config.typesenseKey || !config.docsCollection) {
    return {
      ok: false,
      detail: 'not configured',
      fix: 'Optional. Without it the filter panel is empty and sources show no excerpt. Set TYPESENSE_API_HOST, TYPESENSE_API_KEY_ADMIN, KUDOS_DOCS_COLLECTION.',
    };
  }
  const res = await fetch(
    `https://${config.typesenseHost}/collections/${config.docsCollection}`,
    { headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey }, signal: withTimeout(15_000) },
  );
  if (!res.ok) {
    return {
      ok: false,
      detail: `HTTP ${res.status} on ${config.docsCollection}`,
      fix: 'Check TYPESENSE_API_KEY_ADMIN and that KUDOS_DOCS_COLLECTION names an existing collection.',
    };
  }
  const body = (await res.json()) as { num_documents?: number };
  const chunks = config.docsCollection.replace('_documents_', '_chunks_');
  const chunksRes = await fetch(`https://${config.typesenseHost}/collections/${chunks}`, {
    headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey },
    signal: withTimeout(15_000),
  });
  if (!chunksRes.ok) {
    return {
      ok: false,
      detail: `${body.num_documents ?? '?'} documents, but no chunks collection`,
      fix: `Expected "${chunks}" alongside the documents collection. Source excerpts need it.`,
    };
  }
  return { ok: true, detail: `${body.num_documents ?? '?'} documents, chunks present` };
}

console.log(`\nBackend  ${config.apiBase}`);
console.log(`Agent    ${config.tool}`);
console.log(`Dataset  ${config.tenant}/${config.datasetConfigKey}\n`);

await check('agents (/v1/models)', models);
await check('conversations API', conversations);
await check('typesense (optional)', typesense);

const required = results.filter((r) => r.name !== 'typesense (optional)');
const failed = required.filter((r) => !r.result.ok);
console.log(
  failed.length
    ? `\n${failed.length} required check(s) failed. The app will not work yet.\n`
    : '\nReady. `npm run dev` and open http://localhost:5173\n',
);
process.exit(failed.length ? 1 : 0);
