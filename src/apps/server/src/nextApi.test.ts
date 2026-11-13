import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { Hono } from 'hono';

/*
 * The next client switched on (decisions/0013), with sign-in off and a fake genki on localhost
 * that records what the server sends it: the toggle and its cookie, the page by cookie, thread
 * links in either client's form, `/api/next/me`, and the proxy's allow-list, credential, checks
 * and streaming.
 */

interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

const seen: Seen[] = [];
let aborted = false;
let genki: Server;
let genkiBase = '';

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => resolve(raw));
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What genki's own error text can say, which must reach neither the page nor the log. */
const GENKI_TEXT = 'connect ECONNREFUSED 10.1.2.3:5432 (typesense.internal)';

async function startGenki() {
  genki = createServer(async (req, res) => {
    const body = await readBody(req);
    seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
    const path = (req.url ?? '').split('?')[0];
    if (path === '/v1/chat/completions') {
      if (JSON.parse(body).conversation_id === 'not-yours') {
        res.writeHead(404, { 'content-type': 'application/problem+json' });
        res.end(JSON.stringify({ code: 'conversation_not_found' }));
        return;
      }
      const question = JSON.parse(body).messages?.[0]?.content;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'genai-task': 'task-1',
        'genai-service-version': '3',
        'set-cookie': 'upstream=1',
      });
      res.flushHeaders();
      if (question === 'hold') {
        req.on('close', () => (aborted = true));
        res.on('close', () => (aborted = true));
        return;
      }
      for (const n of [1, 2, 3]) {
        res.write(`data: {"n":${n}}\n\n`);
        await sleep(60);
      }
      res.end('data: [DONE]\n\n');
      return;
    }
    if (
      path === '/api/facets' &&
      new URL(req.url ?? '', 'http://x').searchParams.get('fields') === 'locked'
    ) {
      res.writeHead(403, { 'content-type': 'application/problem+json' });
      res.end(
        JSON.stringify({ type: 'urn:genai:problem:locked-environment', title: 'Locked' }),
      );
      return;
    }
    if (path === '/api/conversations/missing') {
      res.writeHead(404, { 'content-type': 'application/problem+json' });
      res.end(
        JSON.stringify({
          error: 'Conversation not found',
          title: 'Conversation not found',
          detail: 'Conversation not found',
          code: 'conversation_not_found',
        }),
      );
      return;
    }
    if (path === '/api/conversations/c-own') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          conversation: { id: 'c-own', topic: 'Min tråd', created: 1 },
          messages: [
            { id: 'm1', role: 'user', text: 'Hva er fast?', created: 1 },
            { id: 'm2', role: 'assistant', text: 'Svar.', created: 2, task: 'task-own' },
          ],
        }),
      );
      return;
    }
    if (path === '/api/datasets/broken') {
      res.writeHead(500, {
        'content-type': 'application/json',
        'x-genki-host': 'db-1.internal',
      });
      res.end(JSON.stringify({ error: { message: GENKI_TEXT, code: 'internal_error' } }));
      return;
    }
    if (path === '/api/datasets/refused') {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: GENKI_TEXT, code: GENKI_TEXT }));
      return;
    }
    if (path === '/api/datasets/moved') {
      res.writeHead(302, { location: `${genkiBase}/api/stolen` });
      res.end();
      return;
    }
    if (path === '/api/datasets/html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<script>alert(1)</script>');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, path }));
  });
  await new Promise<void>((resolve) => genki.listen(0, '127.0.0.1', resolve));
  genkiBase = `http://127.0.0.1:${(genki.address() as AddressInfo).port}`;
}

const builds = mkdtempSync(join(tmpdir(), 'ka-next-'));
const classic = join(builds, 'web');
const nextBuild = join(builds, 'web-next');
mkdirSync(join(classic, 'assets'), { recursive: true });
mkdirSync(join(nextBuild, 'next-assets'), { recursive: true });
writeFileSync(join(classic, 'index.html'), '<html lang="nb">classic</html>');
writeFileSync(join(nextBuild, 'index.html'), '<html lang="nb">next</html>');
writeFileSync(join(nextBuild, 'next-assets', 'index-next.js'), '/* next */');

const ORIGIN = 'http://localhost:8787';

let app: typeof import('./app.ts').app;
let nextApi: typeof import('./nextApi.ts');
let nextApiPage: typeof import('./nextPage.ts');

before(async () => {
  await startGenki();
  Object.assign(process.env, {
    AUTH_MODE: 'off',
    APP_ORIGIN: ORIGIN,
    DIGDIR_API_KEY: 'service-key',
    DIGDIR_API_BASE: genkiBase,
    WEB_ROOT: classic,
    WEB_NEXT_ROOT: nextBuild,
    KA_NEXT: '1',
    KA_NEXT_MODEL: 'kunnskapsassistenten__default',
    KA_NEXT_TENANT: 'digdir',
  });
  ({ app } = await import('./app.ts'));
  nextApi = await import('./nextApi.ts');
  nextApiPage = await import('./nextPage.ts');
});

after(async () => {
  genki.closeAllConnections();
  await new Promise<void>((resolve) => genki.close(() => resolve()));
  rmSync(builds, { recursive: true, force: true });
});

beforeEach(() => {
  seen.length = 0;
  aborted = false;
});

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const switchTo = (ui: unknown, headers: Record<string, string> = {}) =>
  app.request('/api/next/ui', {
    method: 'POST',
    headers: { ...JSON_HEADERS, Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', ...headers },
    body: JSON.stringify({ ui }),
  });

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

describe('the toggle', () => {
  test('is offered: GET /api/next/ui says so, and which client this browser has', async () => {
    const res = await app.request('/api/next/ui');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ui: 'classic', available: true });
    const chosen = await app.request('/api/next/ui', { headers: { Cookie: 'ka_ui=next' } });
    assert.deepEqual(await chosen.json(), { ui: 'next', available: true });
  });

  test('POST next sets a long-lived, HttpOnly, SameSite=Lax cookie; POST classic clears it', async () => {
    const on = await switchTo('next');
    assert.equal(on.status, 200);
    assert.deepEqual(await on.json(), { ui: 'next' });
    const set = on.headers.getSetCookie().find((line) => line.startsWith('ka_ui='));
    assert.ok(set, 'a ka_ui cookie');
    assert.match(set, /^ka_ui=next;/);
    assert.match(set, /Max-Age=31536000/);
    assert.match(set, /Path=\//);
    assert.match(set, /HttpOnly/);
    assert.match(set, /SameSite=Lax/);

    const off = await switchTo('classic');
    assert.equal(off.status, 200);
    const cleared = off.headers.getSetCookie().find((line) => line.startsWith('ka_ui='));
    assert.ok(cleared);
    assert.match(cleared, /Max-Age=0/);
  });

  test('refuses another value, a cross-site call, a foreign Origin, and a body that is not JSON', async () => {
    assert.equal((await switchTo('beta')).status, 400);
    assert.equal((await switchTo('next', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await switchTo('next', { 'Sec-Fetch-Site': 'same-site' })).status, 403);
    assert.equal((await switchTo('next', { Origin: 'https://evil.example' })).status, 403);
    const form = await app.request('/api/next/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ui: 'next' }),
    });
    assert.equal(form.status, 403);
    for (const res of [form, await switchTo('next', { Origin: 'https://evil.example' })])
      assert.equal(res.headers.getSetCookie().filter((l) => l.startsWith('ka_ui=')).length, 0);
  });
});

describe('the page', () => {
  test('is apps/web by default, and apps/web-next only with the cookie', async () => {
    assert.equal((await page('/')).body, '<html lang="nb">classic</html>');
    assert.equal((await page('/', 'ka_ui=classic')).body, '<html lang="nb">classic</html>');
    assert.equal((await page('/', 'ka_ui=yes')).body, '<html lang="nb">classic</html>');
    const next = await page('/', 'ka_ui=next');
    assert.equal(next.body, '<html lang="nb">next</html>');
    assert.equal(next.res.headers.get('Cache-Control'), 'no-cache');
    assert.match(next.res.headers.get('Vary') ?? '', /Cookie/);
    assert.equal(
      (await page('/innstillinger', 'ka_ui=next')).body,
      '<html lang="nb">next</html>',
    );
  });

  test("«Endringslogg» and «Om prosjektet» are apps/web's pages, whichever client was chosen", async () => {
    for (const path of ['/endringslogg', '/om-prosjektet']) {
      const chosen = await page(path, 'ka_ui=next');
      assert.equal(chosen.body, '<html lang="nb">classic</html>', path);
      assert.match(chosen.res.headers.get('Vary') ?? '', /Cookie/);
      assert.equal((await page(path)).body, '<html lang="nb">classic</html>', path);
    }
    // Only those: the rest of the next client's addresses stay its own.
    assert.equal(
      (await page('/endringslogg/x', 'ka_ui=next')).body,
      '<html lang="nb">next</html>',
    );
  });

  test("each client's files are served whatever the cookie, and an unknown name is a 404", async () => {
    const file = await page('/next-assets/index-next.js');
    assert.equal(file.res.status, 200);
    assert.match(file.res.headers.get('Cache-Control') ?? '', /immutable/);
    assert.equal((await page('/next-assets/gone.js', 'ka_ui=next')).res.status, 404);
  });

  test('a thread link opens in the chosen client', async () => {
    const toNext = await page('/threads/abc-123', 'ka_ui=next');
    assert.equal(toNext.res.status, 302);
    assert.equal(toNext.res.headers.get('Location'), '/?t=abc-123');
    assert.equal(
      (await page('/chat/abc-123', 'ka_ui=next')).res.headers.get('Location'),
      '/?t=abc-123',
    );

    const toClassic = await page('/?t=abc-123');
    assert.equal(toClassic.res.status, 302);
    assert.equal(toClassic.res.headers.get('Location'), '/threads/abc-123');

    // Each client's own form stays where it is.
    assert.equal((await page('/?t=abc-123', 'ka_ui=next')).res.status, 200);
    assert.equal((await page('/threads/abc-123')).res.status, 200);
  });

  test('a thread link with an id that is not one is not followed anywhere', async () => {
    for (const [path, cookie] of [
      ['/?t=..%2F..%2Fauth', undefined],
      ['/?t=%2F%2Fevil.example', undefined],
      ['/threads/..', 'ka_ui=next'],
    ] as const) {
      const { res } = await page(path, cookie);
      assert.equal(res.status, 200, path);
    }
  });

  test('threadLinkFor maps the two forms', () => {
    const { threadLinkFor } = nextApiPage;
    assert.equal(threadLinkFor('next', '/threads/x1', new URLSearchParams()), '/?t=x1');
    assert.equal(threadLinkFor('classic', '/', new URLSearchParams('t=x1')), '/threads/x1');
    assert.equal(
      threadLinkFor('classic', '/innstillinger', new URLSearchParams('t=x1')),
      undefined,
    );
    assert.equal(threadLinkFor('next', '/innstillinger', new URLSearchParams()), undefined);
  });
});

describe('/api/next/me', () => {
  test('names the person, the service and variant, and that a service key may not write', async () => {
    const res = await app.request('/api/next/me');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      name: 'Lokal testbruker',
      signOut: null,
      model: 'kunnskapsassistenten__default',
      service: 'kunnskapsassistenten',
      tenant: 'digdir',
      writes: false,
    });
  });
});

const proxied = (path: string, init: RequestInit = {}) =>
  app.request(`/api/next/genki${path}`, init);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  proxied(path, {
    method: 'POST',
    headers: { ...JSON_HEADERS, Origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });

const QUESTION = {
  model: 'kunnskapsassistenten__default',
  messages: [{ role: 'user', content: 'Hva sier årsrapportene?' }],
  conversation_id: 'c-1',
  filters: { fields: [] },
  tenant: 'someone-else',
  dataset_config_key: 'kudos',
  stream: true,
  genai_stream: 'live',
  genai_steps: true,
  overrides: { temperature: 2 },
  input: { x: 1 },
  genai_documents: ['secret'],
};

describe('the proxy', () => {
  test('forwards every allowed read with the server credential and nothing of the browser', async () => {
    const reads = [
      '/v1/models',
      '/api/conversations?page_size=100&page_index=2&owner=all',
      '/api/conversations/c-1',
      '/api/datasets',
      '/api/datasets/kudos',
      '/api/facets?tenant=other&dataset-config-key=kudos&fields=type&filter=%7B%7D&extra=1',
      '/api/documents?tenant=other&dataset-config-key=kudos&filter=%7B%7D&limit=50&offset=x&fields=all',
    ];
    for (const path of reads) {
      const res = await proxied(path, {
        headers: {
          Cookie: 'ka_sid=browser-session; ka_ui=next',
          Origin: ORIGIN,
          Referer: `${ORIGIN}/`,
          Authorization: 'Bearer from-the-page',
          'X-API-Key': 'from-the-page',
          'Accept-Language': 'nb',
        },
      });
      assert.equal(res.status, 200, path);
    }
    assert.deepEqual(
      seen.map((s) => s.url),
      [
        '/v1/models',
        '/api/conversations?page_size=100&page_index=2',
        '/api/conversations/c-1',
        '/api/datasets',
        '/api/datasets/kudos',
        '/api/facets?dataset-config-key=kudos&fields=type&filter=%7B%7D&tenant=digdir',
        '/api/documents?dataset-config-key=kudos&filter=%7B%7D&limit=50&tenant=digdir',
      ],
    );
    for (const s of seen) {
      assert.equal(s.headers['x-api-key'], 'service-key');
      assert.equal(s.headers['x-user-id'], 'browser-session');
      assert.equal(s.headers.authorization, undefined);
      assert.equal(s.headers.cookie, undefined);
      assert.equal(s.headers.origin, undefined);
      assert.equal(s.headers.referer, undefined);
      assert.equal(s.headers['accept-encoding'], 'identity');
      assert.equal(s.headers['accept-language'], 'nb');
    }
  });

  test('refuses everything else with 403, and never calls genki for it', async () => {
    const refusedCalls: Array<[string, string]> = [
      ['GET', '/me'],
      ['GET', '/api/mcp'],
      ['POST', '/api/mcp'],
      ['POST', '/api/feedback'],
      ['GET', '/api/tools/search'],
      ['GET', '/api/conversations/c-1/messages'],
      ['GET', '/api/conversations/..'],
      ['GET', '/api/conversations/%2E%2E'],
      ['GET', '/admin/services'],
      ['DELETE', '/v1/models'],
      ['PATCH', '/api/conversations/c-1'],
      // With the service key, as in a local run: never a change to a thread.
      ['PUT', '/api/conversations/c-1'],
      ['DELETE', '/api/conversations/c-1'],
    ];
    for (const [method, path] of refusedCalls) {
      const res = await proxied(path, {
        method,
        headers: { ...JSON_HEADERS, Origin: ORIGIN },
        ...(method === 'GET' || method === 'DELETE'
          ? {}
          : { body: JSON.stringify({ title: 'x' }) }),
      });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(seen.length, 0);
  });

  test('refuses a write from another site, or without a JSON body type', async () => {
    assert.equal(
      (await post('/v1/chat/completions', QUESTION, { Origin: 'https://evil.example' })).status,
      403,
    );
    assert.equal(
      (await post('/v1/chat/completions', QUESTION, { 'Sec-Fetch-Site': 'cross-site' })).status,
      403,
    );
    const plain = await proxied('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(QUESTION),
    });
    assert.equal(plain.status, 403);
    assert.equal(seen.length, 0);
  });

  test('a new thread is rebuilt from its title, the service and corpus tags only', async () => {
    const res = await post('/api/conversations', {
      title: `  ${'Langt   spørsmål '.repeat(30)}`,
      'agent-id': 'kunnskapsassistenten',
      tags: ['corpus:kudos'],
      owner: 'someone',
    });
    assert.equal(res.status, 200);
    const sent = JSON.parse(seen[0]!.body);
    assert.deepEqual(Object.keys(sent).sort(), ['agent-id', 'tags', 'title']);
    assert.equal(sent.title.length, 200);
    assert.doesNotMatch(sent.title, /\s\s/);
    assert.deepEqual(sent.tags, ['corpus:kudos']);

    for (const body of [
      { title: 'x', 'agent-id': 'another-service', tags: [] },
      { title: 'x', 'agent-id': 'kunnskapsassistenten', tags: ['owner:me'] },
      { title: 'x', 'agent-id': 'kunnskapsassistenten', tags: Array(6).fill('corpus:kudos') },
    ])
      assert.equal((await post('/api/conversations', body)).status, 400);
    assert.equal(seen.length, 1);
  });

  test('a question is rebuilt: what the page may send is kept, the rest dropped, the tenant ours', async () => {
    const res = await post('/v1/chat/completions', QUESTION);
    assert.equal(res.status, 200);
    await res.text();
    assert.deepEqual(JSON.parse(seen[0]!.body), {
      model: 'kunnskapsassistenten__default',
      messages: [{ role: 'user', content: 'Hva sier årsrapportene?' }],
      conversation_id: 'c-1',
      filters: { fields: [] },
      tenant: 'digdir',
      dataset_config_key: 'kudos',
      stream: true,
      genai_stream: 'live',
      genai_steps: true,
    });
  });

  test('a question to another service, with two messages, empty, too long or bad JSON is refused', async () => {
    const cases: Array<[unknown, number]> = [
      [{ ...QUESTION, model: 'other__default' }, 400],
      [{ ...QUESTION, model: 'kunnskapsassistenten-evil__x' }, 400],
      [{ ...QUESTION, messages: [QUESTION.messages[0], QUESTION.messages[0]] }, 400],
      [{ ...QUESTION, messages: [{ role: 'system', content: 'x' }] }, 400],
      [{ ...QUESTION, messages: [{ role: 'user', content: '   ' }] }, 400],
      [{ ...QUESTION, messages: [{ role: 'user', content: 'x'.repeat(4001) }] }, 413],
      [{ ...QUESTION, conversation_id: '../admin' }, 400],
      // An id or key that only turns into one with String() is not one.
      [{ ...QUESTION, conversation_id: ['c-1'] }, 400],
      [{ ...QUESTION, conversation_id: 42 }, 400],
      [{ ...QUESTION, dataset_config_key: ['kudos'] }, 400],
    ];
    for (const [body, status] of cases)
      assert.equal(
        (await post('/v1/chat/completions', body)).status,
        status,
        JSON.stringify(body).slice(0, 80),
      );
    const broken = await proxied('/v1/chat/completions', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Origin: ORIGIN },
      body: '{not json',
    });
    assert.equal(broken.status, 400);
    assert.equal(seen.length, 0);
  });

  test('an answer streams through chunk by chunk, with genki headers and no buffering', async () => {
    const started = Date.now();
    const res = await post('/v1/chat/completions', QUESTION, { Accept: 'text/event-stream' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Content-Type') ?? '', /text\/event-stream/);
    assert.equal(res.headers.get('genai-task'), 'task-1');
    assert.equal(res.headers.get('genai-service-version'), '3');
    assert.equal(res.headers.get('X-Accel-Buffering'), 'no');
    assert.match(res.headers.get('Cache-Control') ?? '', /no-transform/);
    assert.match(res.headers.get('Cache-Control') ?? '', /no-store/);
    assert.doesNotMatch(
      res.headers.get('Set-Cookie') ?? '',
      /upstream=/,
      "genki's cookies stay out",
    );
    assert.equal(seen[0]!.headers.accept, 'text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const arrivals: Array<{ at: number; text: string }> = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      arrivals.push({ at: Date.now() - started, text: decoder.decode(value) });
    }
    const text = arrivals.map((a) => a.text).join('');
    assert.match(text, /\{"n":1\}[\s\S]*\{"n":2\}[\s\S]*\{"n":3\}[\s\S]*\[DONE\]/);
    assert.ok(arrivals.length >= 3, `arrived in ${arrivals.length} reads`);
    const first = arrivals.find((a) => a.text.includes('"n":1'))!.at;
    const last = arrivals.find((a) => a.text.includes('[DONE]'))!.at;
    assert.ok(last - first >= 120, `the first chunk came ${last - first} ms before the end`);
  });

  test("an answer in a thread makes apps/web forget the sources it kept for the thread's last answer", async () => {
    const sourceStore = await import('./sourceStore.ts');
    const kept = [{ docNum: '7', title: 'Årsrapport 2020', url: '', chunkId: 'k1' }];
    for (const id of ['c-1', 'c-2', 'not-yours']) sourceStore.remember(id, kept);

    const answered = await post('/v1/chat/completions', QUESTION);
    assert.equal(answered.status, 200);
    await answered.text();
    assert.deepEqual(sourceStore.recall('c-1'), [], 'the next answer is the last, not this');
    assert.deepEqual(sourceStore.recall('c-2'), kept, 'another thread keeps its own');

    const refused = await post('/v1/chat/completions', {
      ...QUESTION,
      conversation_id: 'not-yours',
    });
    assert.equal(refused.status, 404);
    assert.deepEqual(
      sourceStore.recall('not-yours'),
      kept,
      'a refused question changes nothing',
    );
  });

  test('stopping the answer ends the call to genki', async () => {
    const controller = new AbortController();
    const res = await app.request('/api/next/genki/v1/chat/completions', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Origin: ORIGIN },
      body: JSON.stringify({ ...QUESTION, messages: [{ role: 'user', content: 'hold' }] }),
      signal: controller.signal,
    });
    assert.equal(res.status, 200);
    controller.abort();
    await res.body?.cancel().catch(() => {});
    for (let i = 0; i < 40 && !aborted; i += 1) await sleep(25);
    assert.ok(aborted, 'genki saw the call end');
  });

  test("genki's refusals and failures reach the page as a fixed sentence and a code, never genki's text", async () => {
    const logged: string[] = [];
    for (const name of ['log', 'error', 'warn'] as const)
      mock.method(console, name, (...args: unknown[]) =>
        logged.push(args.map(String).join(' ')),
      );
    try {
      const missing = await proxied('/api/conversations/missing');
      assert.equal(missing.status, 404);
      // `conversation` in the sentence is how the page tells a thread that is gone.
      assert.deepEqual(await missing.json(), {
        error: 'Tjenesten svarte 404 (conversation_not_found).',
        detail: 'Tjenesten svarte 404 (conversation_not_found).',
        code: 'conversation_not_found',
      });

      const broken = await proxied('/api/datasets/broken');
      assert.equal(broken.status, 500);
      assert.equal(broken.headers.get('x-genki-host'), null);
      assert.deepEqual(await broken.json(), {
        error: 'Tjenesten svarte 500 (internal_error).',
        detail: 'Tjenesten svarte 500 (internal_error).',
        code: 'internal_error',
      });

      // A code that is not an identifier is genki's text too, and is not passed on.
      const refused = await proxied('/api/datasets/refused');
      assert.equal(refused.status, 403);
      assert.deepEqual(await refused.json(), {
        error: 'Tjenesten svarte 403.',
        detail: 'Tjenesten svarte 403.',
        code: 'backend_http_403',
      });

      const locked = await proxied('/api/facets?dataset-config-key=kudos&fields=locked');
      assert.equal(locked.status, 403);
      const body = (await locked.json()) as { code: string; detail: string };
      assert.equal(body.code, 'locked_environment');
      assert.match(body.detail, /Testmiljøet er låst/);
    } finally {
      mock.restoreAll();
    }
    assert.ok(
      logged.some((line) => / 500 /.test(line)),
      'the status is logged',
    );
    for (const line of logged) {
      assert.doesNotMatch(line, /ECONNREFUSED|10\.1\.2\.3|typesense|db-1/, line);
      assert.doesNotMatch(line, /Conversation not found/, line);
    }
  });

  test('a redirect from genki is never followed, and is a 502 with a fixed sentence', async () => {
    const res = await proxied('/api/datasets/moved');
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('location'), null);
    assert.deepEqual(await res.json(), {
      error: 'Tjenesten svarte med en videresending, som ikke følges.',
      detail: 'Tjenesten svarte med en videresending, som ikke følges.',
      code: 'backend_redirect',
    });
    assert.deepEqual(
      seen.map((s) => s.url),
      ['/api/datasets/moved'],
      'the credential went nowhere else',
    );
  });

  test('every proxied response, a refusal and a failure included, is kept in no cache', async () => {
    for (const [path, status] of [
      ['/api/datasets', 200],
      ['/api/datasets/broken', 500],
      ['/api/datasets/moved', 502],
      ['/admin/services', 403],
      ['/api/conversations/..x', 403],
    ] as const) {
      const res = await proxied(path);
      assert.equal(res.status, status, path);
      assert.match(res.headers.get('Cache-Control') ?? '', /\bno-store\b/, path);
      await res.body?.cancel();
    }
  });

  test("genki's body type passes only when it is JSON or an event stream", async () => {
    const html = await proxied('/api/datasets/html');
    assert.equal(html.status, 200);
    assert.equal(html.headers.get('Content-Type'), 'application/json');
    await html.body?.cancel();

    const json = await proxied('/api/datasets');
    assert.match(json.headers.get('Content-Type') ?? '', /^application\/json\b/);
    await json.body?.cancel();
  });

  test('genki out of reach is a 502 the page can read', async () => {
    const { nextRoutes } = nextApi;
    const host = new Hono();
    host.use('*', async (c, next) => {
      c.set('caller' as never, { userId: 'u' } as never);
      return next();
    });
    host.route(
      '/api/next',
      nextRoutes({
        apiBase: 'http://127.0.0.1:9',
        model: 'kunnskapsassistenten__default',
        service: 'kunnskapsassistenten',
        tenant: 'digdir',
        origin: ORIGIN,
        maxQueryLength: 4000,
      }),
    );
    const res = await host.request('/api/next/genki/v1/models');
    assert.equal(res.status, 502);
    assert.equal(((await res.json()) as { code: string }).code, 'backend_unreachable');
  });
});

describe("the proxy with a person's token", () => {
  const withPerson = () => {
    const host = new Hono();
    host.use('*', async (c, next) => {
      c.set(
        'caller' as never,
        { userId: 'ansattporten:1', token: 'person-token', actingFor: '991825827' } as never,
      );
      return next();
    });
    host.route(
      '/api/next',
      nextApi.nextRoutes({
        apiBase: genkiBase,
        model: 'kunnskapsassistenten__default',
        service: 'kunnskapsassistenten',
        tenant: 'digdir',
        origin: ORIGIN,
        maxQueryLength: 4000,
      }),
    );
    return host;
  };

  test('sends the token and the organisation, never the service key', async () => {
    const res = await withPerson().request(
      '/api/next/genki/api/conversations?page_size=100&page_index=0',
    );
    assert.equal(res.status, 200);
    assert.equal(seen[0]!.headers.authorization, 'Bearer person-token');
    assert.equal(seen[0]!.headers['genai-acting-for'], '991825827');
    assert.equal(seen[0]!.headers['x-api-key'], undefined);
    assert.equal(seen[0]!.headers['x-user-id'], undefined);
  });

  test('may rename a thread, with only its title, and delete one', async () => {
    const host = withPerson();
    const rename = await host.request('/api/next/genki/api/conversations/c-1', {
      method: 'PUT',
      headers: { ...JSON_HEADERS, Origin: ORIGIN },
      body: JSON.stringify({ title: '  Nytt   navn ', owner: 'x' }),
    });
    assert.equal(rename.status, 200);
    const remove = await host.request('/api/next/genki/api/conversations/c-1', {
      method: 'DELETE',
      headers: { Origin: ORIGIN },
    });
    assert.equal(remove.status, 200);
    assert.deepEqual(
      seen.map((s) => [s.method, s.url, s.body]),
      [
        ['PUT', '/api/conversations/c-1', JSON.stringify({ title: 'Nytt navn' })],
        ['DELETE', '/api/conversations/c-1', ''],
      ],
    );
  });

  test('still refuses a delete from another site, and feedback', async () => {
    const host = withPerson();
    const remove = await host.request('/api/next/genki/api/conversations/c-1', {
      method: 'DELETE',
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(remove.status, 403);
    const feedback = await host.request('/api/next/genki/api/feedback', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Origin: ORIGIN },
      body: JSON.stringify({ task: 't', rating: 'up' }),
    });
    assert.equal(feedback.status, 403);
    assert.equal(seen.length, 0);
  });
});

describe('feedback on an answer', () => {
  const rate = (
    host: { request: (path: string, init: RequestInit) => Response | Promise<Response> },
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    host.request('/api/next/feedback', {
      method: 'POST',
      headers: { ...JSON_HEADERS, Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', ...headers },
      body: JSON.stringify(body),
    });
  const RATING = {
    conversationId: 'c-own',
    taskId: 'task-own',
    rating: 'down',
    reasons: [' Feil ', '', 'Mangler kilde'],
    comment: '  For kort.  ',
  };

  const withPerson = () => {
    const host = new Hono();
    host.use('*', async (c, next) => {
      c.set('caller' as never, { userId: 'ansattporten:1', token: 'person-token' } as never);
      return next();
    });
    host.route('/api/next', nextApi.nextRoutes());
    return host;
  };

  test('is refused with the service key, and genki is never asked', async () => {
    const res = await rate(app, RATING);
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: 'refused', code: 'not_allowed' });
    assert.equal(seen.length, 0);
  });

  test("is sent with the person's token for a run in their own thread, with reasons and comment", async () => {
    const res = await rate(withPerson(), RATING);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.deepEqual(
      seen.map((s) => [s.method, s.url]),
      [
        ['GET', '/api/conversations/c-own'],
        ['POST', '/api/feedback'],
      ],
    );
    assert.equal(seen[1]!.headers.authorization, 'Bearer person-token');
    assert.equal(seen[1]!.headers['x-api-key'], undefined);
    assert.deepEqual(JSON.parse(seen[1]!.body), {
      task: 'task-own',
      rating: 'down',
      reasons: ['Feil', 'Mangler kilde'],
      comment: 'For kort.',
    });
  });

  test('is refused for a run that is not in the thread, before genki records anything', async () => {
    const res = await rate(withPerson(), { ...RATING, taskId: 'task-someone-else' });
    assert.equal(res.status, 404);
    assert.deepEqual(
      seen.map((s) => [s.method, s.url]),
      [['GET', '/api/conversations/c-own']],
    );
  });

  test('is refused from another site, and with a body it cannot read', async () => {
    const host = withPerson();
    assert.equal((await rate(host, RATING, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await rate(host, RATING, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await rate(host, { ...RATING, rating: 'meh' })).status, 400);
    assert.equal((await rate(host, { ...RATING, reasons: 'Feil' })).status, 400);
    assert.equal((await rate(host, { ...RATING, reasons: [1] })).status, 400);
    assert.equal((await rate(host, { ...RATING, conversationId: '' })).status, 400);
    assert.equal(seen.length, 0);
  });
});
