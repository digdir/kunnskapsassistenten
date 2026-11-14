import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, mock, test } from 'node:test';

/*
 * The next client as the default (`KA_NEXT_DEFAULT`, decisions/0018), as KA's own site has it
 * while apps/web is phased out: apps/web-next for a browser that has not chosen, apps/web for one
 * that chose it, and the choice kept both ways.
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-next-default-'));
const classic = join(builds, 'web');
const nextBuild = join(builds, 'web-next');
mkdirSync(join(classic, 'assets'), { recursive: true });
mkdirSync(join(nextBuild, 'next-assets'), { recursive: true });
writeFileSync(join(classic, 'index.html'), '<html lang="nb">classic</html>');
writeFileSync(join(classic, 'assets', 'index-classic.js'), '/* classic */');
writeFileSync(join(nextBuild, 'index.html'), '<html lang="nb">next</html>');

const ORIGIN = 'http://localhost:8787';
const CLASSIC = '<html lang="nb">classic</html>';
const NEXT = '<html lang="nb">next</html>';

let app: typeof import('./app.ts').app;
let config: typeof import('./config.ts');
before(async () => {
  Object.assign(process.env, {
    AUTH_MODE: 'off',
    APP_ORIGIN: ORIGIN,
    DIGDIR_API_KEY: 'service-key',
    DIGDIR_API_BASE: 'http://127.0.0.1:9',
    WEB_ROOT: classic,
    WEB_NEXT_ROOT: nextBuild,
    KA_NEXT: '1',
    KA_NEXT_DEFAULT: '1',
  });
  delete process.env.KA_NEXT_LAYOUT;
  delete process.env.KA_NEXT_ONLY;
  ({ app } = await import('./app.ts'));
  config = await import('./config.ts');
});
after(() => rmSync(builds, { recursive: true, force: true }));

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

const ui = async (cookie?: string) =>
  (await app.request('/api/next/ui', cookie ? { headers: { Cookie: cookie } } : {})).json();

const switchTo = (choice: string) =>
  app.request('/api/next/ui', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
    },
    body: JSON.stringify({ ui: choice }),
  });

/** The cookie a response sets, as the browser sends it back: `ka_ui=<value>`. */
const kept = (res: Response) =>
  res.headers
    .getSetCookie()
    .find((line) => line.startsWith('ka_ui='))
    ?.split(';')[0];

describe('with the next client as the default', () => {
  test('a browser that has not chosen gets the next client, and the toggle says so', async () => {
    for (const path of ['/', '/innstillinger']) {
      const { res, body } = await page(path);
      assert.equal(res.status, 200, path);
      assert.equal(body, NEXT, path);
      assert.match(res.headers.get('Vary') ?? '', /Cookie/, path);
    }
    assert.deepEqual(await ui(), { ui: 'next', available: true });
  });

  test('a cookie that names neither client is no choice, and gets the default', async () => {
    for (const cookie of ['ka_ui=yes', 'ka_ui='])
      assert.equal((await page('/', cookie)).body, NEXT, cookie);
  });

  test('a browser that chose apps/web keeps it', async () => {
    assert.equal((await page('/', 'ka_ui=classic')).body, CLASSIC);
    assert.equal((await page('/innstillinger', 'ka_ui=classic')).body, CLASSIC);
    assert.deepEqual(await ui('ka_ui=classic'), { ui: 'classic', available: true });
  });

  test('a browser that chose the next client keeps it', async () => {
    assert.equal((await page('/', 'ka_ui=next')).body, NEXT);
    assert.deepEqual(await ui('ka_ui=next'), { ui: 'next', available: true });
  });

  test('«Tilbake til gammel versjon» keeps apps/web, and the next request gets it; «Prøv ny versjon» keeps the next client', async () => {
    const back = await switchTo('classic');
    assert.equal(back.status, 200);
    assert.equal(kept(back), 'ka_ui=classic');
    assert.equal((await page('/', kept(back))).body, CLASSIC);

    const forward = await switchTo('next');
    assert.equal(forward.status, 200);
    assert.equal(kept(forward), 'ka_ui=next');
    assert.equal((await page('/', kept(forward))).body, NEXT);
  });

  test("thread links follow the default: apps/web's open in the next client, unless apps/web was chosen", async () => {
    for (const path of ['/threads/abc-123', '/chat/abc-123']) {
      const { res } = await page(path);
      assert.equal(res.status, 302, path);
      assert.equal(res.headers.get('Location'), '/?t=abc-123', path);
    }
    assert.equal((await page('/?t=abc-123')).body, NEXT);

    const toClassic = await page('/?t=abc-123', 'ka_ui=classic');
    assert.equal(toClassic.res.status, 302);
    assert.equal(toClassic.res.headers.get('Location'), '/threads/abc-123');
    assert.equal((await page('/threads/abc-123', 'ka_ui=classic')).body, CLASSIC);
  });

  test('apps/web stays: its info pages, files and API, and /api/next/me keeps the way back to it', async () => {
    for (const path of ['/endringslogg', '/om-prosjektet'])
      assert.equal((await page(path)).body, CLASSIC, path);
    assert.equal((await page('/assets/index-classic.js')).body, '/* classic */');
    assert.equal((await app.request('/api/v2/health')).status, 200);
    const me = (await (await app.request('/api/next/me')).json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(me).sort(), [
      'model',
      'name',
      'service',
      'signOut',
      'tenant',
      'writes',
    ]);
  });
});

describe('KA_NEXT_DEFAULT', () => {
  test('is warned about and ignored while KA_NEXT is off, so apps/web is served', () => {
    const warnings: string[] = [];
    mock.method(console, 'warn', (...args: unknown[]) =>
      warnings.push(args.map(String).join(' ')),
    );
    try {
      const next = config.nextConfig({ KA_NEXT_DEFAULT: '1', WEB_NEXT_ROOT: nextBuild });
      assert.equal(next.enabled, false);
      assert.equal(next.byDefault, false);
    } finally {
      mock.restoreAll();
    }
    assert.ok(
      warnings.some((w) => w.includes('KA_NEXT_DEFAULT') && w.includes('ignored')),
      warnings.join('\n'),
    );
  });

  test('is off unless switched on, so a browser that has not chosen keeps apps/web', () => {
    for (const value of [undefined, '', '0', 'false', 'off'])
      assert.equal(
        config.nextConfig({ KA_NEXT: '1', KA_NEXT_DEFAULT: value, WEB_NEXT_ROOT: nextBuild })
          .byDefault,
        false,
        String(value),
      );
    for (const value of ['1', 'true', 'on', 'yes'])
      assert.equal(
        config.nextConfig({ KA_NEXT: '1', KA_NEXT_DEFAULT: value, WEB_NEXT_ROOT: nextBuild })
          .byDefault,
        true,
        value,
      );
  });
});
