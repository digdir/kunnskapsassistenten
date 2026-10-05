// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandler } from './app.ts';
import { readConfig, type ServerConfig } from './config.ts';
import { MAX_IDS, TIMEOUT_MS, excerptConfigFrom, parseIds } from './excerpts.ts';

/**
 * `/api/excerpts` measured through the server's own socket, against a fake
 * Typesense that answers in the shape a search of a chunks collection does.
 */
const KEY = 'ts_hemmelig_sokenokkel';

let server: Server | undefined;
let typesense: Server | undefined;
let backend: Server | undefined;
let base: string;
/** Every request Typesense got. */
let asked: { url: URL; key: string | undefined }[];
/** Every request the backend got. Always empty here. */
let forwarded: string[];
/** What Typesense answers with next. */
let answer: { status: number; body: string };
/** When true, Typesense takes the connection and never answers. */
let hang = false;

const hits = (documents: Record<string, unknown>[]) =>
  JSON.stringify({ found: documents.length, hits: documents.map((document) => ({ document })) });

async function listen(instance: Server): Promise<string> {
  await new Promise<void>((done) => instance.listen(0, '127.0.0.1', done));
  const address = instance.address();
  if (address === null || typeof address === 'string') throw new Error('Ingen port.');
  return `http://127.0.0.1:${address.port}`;
}

function stop(instance: Server | undefined): Promise<void> {
  if (!instance) return Promise.resolve();
  // A Typesense that never answered still holds the route's connection open,
  // and `close` waits for it. Without this one failed timeout takes the next
  // tests down with it.
  instance.closeAllConnections();
  return new Promise<void>((done) => instance.close(() => done()));
}

async function start(
  env: NodeJS.ProcessEnv = {},
  mode: 'live' | 'mock' = 'live',
  timeoutMs?: number,
) {
  typesense = createServer((request, response) => {
    if (hang) return;
    asked.push({
      url: new URL(request.url ?? '', 'http://typesense'),
      key: request.headers['x-typesense-api-key'] as string | undefined,
    });
    response.writeHead(answer.status, { 'Content-Type': 'application/json' });
    response.end(answer.body);
  });
  backend = createServer((request, response) => {
    forwarded.push(request.url ?? '');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"excerpts":{"fra-backend":"feil"}}');
  });
  const typesenseUrl = await listen(typesense);
  const apiBase = await listen(backend);

  const config: ServerConfig = {
    ...readConfig({}, '/dist'),
    mode,
    apiBase,
    excerpts: {
      ...excerptConfigFrom({
        TYPESENSE_URL: `${typesenseUrl}/`,
        TYPESENSE_API_KEY: KEY,
        KA_CHUNK_COLLECTIONS: 'kudos-full=KUDOS_chunks v4',
        ...env,
      }),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    },
  };
  server = createServer(createHandler(config));
  base = await listen(server);
}

beforeEach(() => {
  hang = false;
  asked = [];
  forwarded = [];
  answer = {
    status: 200,
    body: hits([
      { chunk_id: 'ef0a96e7e2bb', content_markdown: '  Digdir skal prioritere …\n' },
      { chunk_id: '3c399236a70d', content_markdown: '# Mål\n\nFelles løsninger.' },
    ]),
  };
});

afterEach(async () => {
  await stop(server);
  await stop(typesense);
  await stop(backend);
  server = typesense = backend = undefined;
});

describe('/api/excerpts', () => {
  it('gir teksten til hver bit, trimmet, med id-en som nøkkel', async () => {
    await start();

    const response = await fetch(
      `${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb,3c399236a70d`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      excerpts: {
        ef0a96e7e2bb: 'Digdir skal prioritere …',
        '3c399236a70d': '# Mål\n\nFelles løsninger.',
      },
    });
  });

  it('spør bitsamlingen til datasettet, med id-ene i backticks og nøkkelen i hodet', async () => {
    await start();

    await fetch(
      `${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb,3c399236a70d,ef0a96e7e2bb`,
    );

    expect(asked).toHaveLength(1);
    const { url, key } = asked[0];
    expect(url.pathname).toBe('/collections/KUDOS_chunks%20v4/documents/search');
    expect(url.searchParams.get('q')).toBe('*');
    // A repeat is asked for once.
    expect(url.searchParams.get('filter_by')).toBe('chunk_id:=[`ef0a96e7e2bb`,`3c399236a70d`]');
    expect(url.searchParams.get('include_fields')).toBe('chunk_id,content_markdown');
    expect(url.searchParams.get('per_page')).toBe('2');
    expect(key).toBe(KEY);
  });

  it('lar en bit som ikke finnes, være ute, og tar ikke med noe det ikke ble spurt om', async () => {
    answer = {
      status: 200,
      body: hits([
        { chunk_id: 'ef0a96e7e2bb', content_markdown: 'Funnet.' },
        { chunk_id: 'ikke-spurt', content_markdown: 'Skal ikke med.' },
        { chunk_id: '3c399236a70d', content_markdown: '   ' },
        { chunk_id: 42, content_markdown: 'Feil type.' },
      ]),
    };
    await start();

    const response = await fetch(
      `${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb,3c399236a70d,finnes-ikke`,
    );

    expect(await response.json()).toEqual({ excerpts: { ef0a96e7e2bb: 'Funnet.' } });
  });

  it.each([
    ['en backtick', 'ef0a96e7e2bb,abc`]'],
    ['et mellomrom', 'ef0a96e7e2bb,a b'],
    ['en parentes', 'ef0a96e7e2bb,a)'],
    ['et filteruttrykk', 'x]&&doc_num:>0'],
  ])('avviser en id med %s, og spør ikke Typesense', async (_what, ids) => {
    await start();

    const response = await fetch(
      `${base}/api/excerpts?dataset=kudos-full&ids=${encodeURIComponent(ids)}`,
    );

    expect(response.status).toBe(400);
    expect(asked).toHaveLength(0);
  });

  it(`avviser mer enn ${MAX_IDS} id-er, og spør ikke Typesense`, async () => {
    await start();
    const ids = Array.from({ length: MAX_IDS + 1 }, (_, i) => `id${i}`).join(',');

    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=${ids}`);

    expect(response.status).toBe(400);
    expect(asked).toHaveLength(0);
  });

  it('svarer tomt for et datasett som ikke er satt opp, uten å spørre', async () => {
    await start();

    const response = await fetch(`${base}/api/excerpts?dataset=constructor&ids=ef0a96e7e2bb`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ excerpts: {} });
    expect(asked).toHaveLength(0);
  });

  it('svarer tomt uten nøkkel, uten å spørre', async () => {
    await start({ TYPESENSE_API_KEY: '' });

    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`);

    expect(await response.json()).toEqual({ excerpts: {} });
    expect(asked).toHaveLength(0);
  });

  it('svarer 502 når Typesense feiler, og sender ikke feilteksten videre', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = {
      status: 403,
      body: '{"message":"Forbidden - a valid `x-typesense-api-key` header"}',
    };
    await start();

    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`);

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('Forbidden');
    expect(JSON.parse(text)).toEqual({ error: 'Fikk ikke hentet utdragene.' });
    expect(String(logged.mock.calls[0])).toContain('403');
  });

  it('svarer 502 når Typesense aldri svarer, etter tidsavbruddet', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    hang = true;
    await start({}, 'live', 100);

    const started = Date.now();
    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`);

    expect(response.status).toBe(502);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(logged).toHaveBeenCalled();
  });

  it('har fem sekunder som tidsavbrudd mot Typesense', () => {
    // KA CC measured it on #227: a Typesense that never answers gave 502
    // after 5011 ms.
    expect(TIMEOUT_MS).toBe(5000);
    expect(excerptConfigFrom({}).timeoutMs).toBe(5000);
  });

  it('tar 20 id-er, det headless-rag gir ett svar', () => {
    // `structuredContent.chunks` is `(take 20 chunks)` in
    // server/src/digdir/mcp/tools.clj. The client splits a longer list, so
    // this is the size of one request and not the most an answer may have.
    expect(MAX_IDS).toBe(20);
  });

  it('sendes aldri til backend', async () => {
    await start();

    await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`);

    expect(forwarded).toEqual([]);
  });

  it('er stengt i mock, som resten av /api/', async () => {
    await start({}, 'mock');

    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`);

    expect(response.status).toBe(404);
    expect(asked).toHaveLength(0);
  });

  it('svarer bare på GET', async () => {
    await start();

    const response = await fetch(`${base}/api/excerpts?dataset=kudos-full&ids=ef0a96e7e2bb`, {
      method: 'POST',
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('parseIds', () => {
  it('deler på komma, fjerner tomme og gjentakelser', () => {
    expect(parseIds(' a , b,,a ')).toEqual(['a', 'b']);
    expect(parseIds(null)).toEqual([]);
  });
});

describe('KA_CHUNK_COLLECTIONS', () => {
  it('navngir sin egen variabel når en oppføring hoppes over', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = excerptConfigFrom({ KA_CHUNK_COLLECTIONS: 'kudos-full=chunks;bare-nokkel' });

    expect([...config.collections]).toEqual([['kudos-full', 'chunks']]);
    expect(String(warned.mock.calls[0])).toContain('KA_CHUNK_COLLECTIONS');
  });
});
