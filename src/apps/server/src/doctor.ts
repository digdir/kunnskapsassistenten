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

  if (!ids.includes(config.next.model)) {
    return {
      ok: false,
      detail: `${ids.length} agents, but not the one the client asks`,
      fix: `KA_NEXT_MODEL is "${config.next.model}". Available: ${ids.join(', ')}`,
    };
  }
  return { ok: true, detail: `${ids.length} agents, including the one the client asks` };
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

console.log(`\nBackend  ${config.apiBase}`);
console.log(`Model    ${config.next.model}`);
console.log(`Tenant   ${config.next.tenant}\n`);

await check('agents (/v1/models)', models);
await check('conversations API', conversations);

const failed = results.filter((r) => !r.result.ok);
console.log(
  failed.length
    ? `\n${failed.length} check(s) failed. The app will not work yet.\n`
    : '\nReady. `npm run dev` and open http://localhost:5173\n',
);
process.exit(failed.length ? 1 : 0);
