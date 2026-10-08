// @vitest-environment node
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCESS_COOKIE, COOKIE_MAX_AGE_SECONDS, accessSecretFrom, accessToken } from './access.ts';
import { createHandler } from './app.ts';
import { readConfig, type ServerConfig } from './config.ts';

/**
 * Den delte hemmeligheten foran testmiljøet, målt gjennom serverens egen
 * socket. Rå forespørsler der `fetch` ville fulgt omdirigeringen eller satt
 * `Host` selv.
 */
const SECRET = 'Zk3_q9vX-2LmPa7tQwE8rYu1sDfGh4jK6lZx0cVbNm';
const OTHER = 'aB1-cD2_eF3-gH4_iJ5-kL6_mN7-oP8_qR9-sT0uV';

let server: Server | undefined;
let backend: Server | undefined;
let port: number;
/** Hvert kall backend fikk, med hodene. */
let forwarded: { url: string; cookie: string | undefined }[];

async function listen(instance: Server): Promise<number> {
  await new Promise<void>((done) => instance.listen(0, '127.0.0.1', done));
  const address = instance.address();
  if (address === null || typeof address === 'string') throw new Error('Ingen port.');
  return address.port;
}

function stop(instance: Server | undefined): Promise<void> {
  return instance ? new Promise<void>((done) => instance.close(() => done())) : Promise.resolve();
}

/** `null` er porten av; uten argument er den på med `SECRET`. */
async function start(accessSecret: string | null = SECRET): Promise<void> {
  const dist = await mkdtemp(join(tmpdir(), 'ka-dist-'));
  await mkdir(join(dist, 'assets'));
  await writeFile(
    join(dist, 'index.html'),
    '<!doctype html><title>KA</title><div id="root"></div>',
  );
  await writeFile(join(dist, 'assets', 'index-abc.js'), 'console.log(1);\n');

  backend = createServer((request, response) => {
    forwarded.push({ url: request.url ?? '', cookie: request.headers.cookie });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"conversations":[]}');
  });
  const apiBase = `http://127.0.0.1:${await listen(backend)}`;

  const config: ServerConfig = {
    ...readConfig({}, dist),
    mode: 'live',
    apiBase,
    accessSecret: accessSecret ?? undefined,
  };
  server = createServer(createHandler(config));
  port = await listen(server);
}

type Answer = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
};

/** En forespørsel som den er skrevet, med egne hoder, og uten å følge noe. */
function get(path: string, headers: Record<string, string> = {}): Promise<Answer> {
  return new Promise((done, fail) => {
    const call = httpRequest(
      { host: '127.0.0.1', port, path, method: 'GET', headers },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () =>
          done({ status: response.statusCode ?? 0, headers: response.headers, body }),
        );
      },
    );
    call.on('error', fail);
    call.end();
  });
}

const withCookie = (value: string) => ({ Cookie: `annet=1; ${ACCESS_COOKIE}=${value}; siste=2` });

beforeEach(() => {
  forwarded = [];
});

afterEach(async () => {
  await stop(server);
  await stop(backend);
  server = backend = undefined;
});

describe('delt hemmelighet', () => {
  it('gir 401 uten kapsel, på sider, filer, /config.js og /api/', async () => {
    await start();

    for (const path of ['/', '/threads/abc', '/config.js', '/assets/index-abc.js']) {
      const answer = await get(path);

      expect({ path, status: answer.status }).toEqual({ path, status: 401 });
      expect(answer.headers['content-type']).toContain('text/html');
      expect(answer.body).toContain('lang="nb"');
      expect(answer.body).toContain('krever lenken');
      // Ikke klienten, og ikke konfigurasjonen.
      expect(answer.body).not.toContain('id="root"');
      expect(answer.body).not.toContain('__KA_CONFIG__');
    }

    const api = await get('/api/conversations');
    expect(api.status).toBe(401);
    expect(api.headers['content-type']).toContain('application/json');
    expect(forwarded).toEqual([]);
  });

  it('setter kapselen og sender videre uten hemmeligheten når den stemmer', async () => {
    await start();

    const answer = await get(`/threads/abc?x=1&secret=${SECRET}&y=2`);

    expect(answer.status).toBe(303);
    expect(answer.headers.location).toBe('/threads/abc?x=1&y=2');
    expect(answer.headers['referrer-policy']).toBe('no-referrer');
    expect(answer.headers['cache-control']).toBe('no-store');

    const setCookie = String(answer.headers['set-cookie']);
    expect(setCookie).toContain(`${ACCESS_COOKIE}=${accessToken(SECRET)}`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain(`Max-Age=${COOKIE_MAX_AGE_SECONDS}`);
    // Kapselen er ikke hemmeligheten.
    expect(setCookie).not.toContain(SECRET);
    expect(forwarded).toEqual([]);
  });

  it('sender til forsiden uten spørrestreng når hemmeligheten var alt', async () => {
    await start();

    expect((await get(`/?secret=${SECRET}`)).headers.location).toBe('/');
  });

  it('gir samme 401 for feil hemmelighet som for ingen, også med gyldig kapsel', async () => {
    await start();

    const none = await get('/');
    for (const headers of [{}, withCookie(accessToken(SECRET))]) {
      const wrong = await get(`/?secret=${OTHER}`, headers);

      expect(wrong.status).toBe(401);
      expect(wrong.body).toBe(none.body);
      expect(wrong.headers['set-cookie']).toBeUndefined();
    }
  });

  it('slipper gjennom med gyldig kapsel, og sender ikke kapselen til backend', async () => {
    await start();
    const headers = withCookie(accessToken(SECRET));

    expect((await get('/', headers)).status).toBe(200);
    expect((await get('/config.js', headers)).status).toBe(200);
    expect((await get('/assets/index-abc.js', headers)).status).toBe(200);

    const api = await get('/api/conversations', headers);
    expect(api.status).toBe(200);
    expect(forwarded).toEqual([{ url: '/api/conversations', cookie: undefined }]);
  });

  it('lar /healthz være åpen', async () => {
    await start();

    const answer = await get('/healthz');

    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toMatchObject({ ok: true });
  });

  it('avviser en kapsel fra en hemmelighet som er byttet', async () => {
    await start(OTHER);

    expect((await get('/', withCookie(accessToken(SECRET)))).status).toBe(401);
    expect((await get('/', withCookie(accessToken(OTHER)))).status).toBe(200);
  });

  it('avviser en kapsel som er gjettet eller tom', async () => {
    await start();

    for (const value of ['', 'x', SECRET, `${accessToken(SECRET)}x`]) {
      expect({ value, status: (await get('/', withCookie(value))).status }).toEqual({
        value,
        status: 401,
      });
    }
  });

  it('er Secure utenfor denne maskinen, og ikke på localhost', async () => {
    await start();

    const azure = await get(`/?secret=${SECRET}`, {
      Host: 'ka-frontend-test.example.azurecontainerapps.io',
    });
    const local = await get(`/?secret=${SECRET}`, { Host: 'localhost:8787' });

    expect(String(azure.headers['set-cookie'])).toContain('Secure');
    expect(String(local.headers['set-cookie'])).not.toContain('Secure');
  });

  it('sender aldri til en annen vert', async () => {
    // URL-parseren gjør `/.//evil.example` om til stien `//evil.example`, og
    // en Location som starter med `//` er en annen vert for en nettleser.
    await start();

    for (const path of [`/.//evil.example/?secret=${SECRET}`, `//evil.example/?secret=${SECRET}`]) {
      const location = String((await get(path)).headers.location);

      expect({ path, location: location.startsWith('//') }).toEqual({ path, location: false });
      expect(location.startsWith('/')).toBe(true);
    }
  });

  it('er av når variabelen er tom', async () => {
    await start(null);

    expect((await get('/')).status).toBe(200);
    // Hemmeligheten i adressen betyr ingenting da.
    expect((await get(`/?secret=${SECRET}`)).status).toBe(200);
    expect((await get('/api/conversations')).status).toBe(200);
  });
});

describe('KA_ACCESS_SECRET', () => {
  it('er av når den er tom, og stopper serveren når den er for kort', () => {
    expect(accessSecretFrom(undefined)).toBeUndefined();
    expect(accessSecretFrom('  ')).toBeUndefined();
    expect(accessSecretFrom(` ${SECRET} `)).toBe(SECRET);
    expect(() => accessSecretFrom('kort-hemmelighet')).toThrow(/KA_ACCESS_SECRET/);
    // Lengden, ikke verdien, står i meldingen.
    expect(() => accessSecretFrom('kort-hemmelighet')).not.toThrow(/kort-hemmelighet/);
  });

  it('leses av readConfig', () => {
    expect(readConfig({ KA_ACCESS_SECRET: SECRET }, '/dist').accessSecret).toBe(SECRET);
    expect(readConfig({}, '/dist').accessSecret).toBeUndefined();
  });
});
