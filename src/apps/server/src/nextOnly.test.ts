import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, mock, test } from 'node:test';

/*
 * Only the next client (`KA_NEXT_ONLY`, decisions/0017), as a deployment of another service has
 * it: apps/web-next at `/` and every page address, and nothing of apps/web, so no way back to it.
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-next-only-'));
const classic = join(builds, 'web');
const nextBuild = join(builds, 'web-next');
const unbuilt = join(builds, 'web-next-unbuilt');
mkdirSync(join(classic, 'assets'), { recursive: true });
mkdirSync(join(nextBuild, 'next-assets'), { recursive: true });
mkdirSync(unbuilt);
writeFileSync(join(classic, 'index.html'), '<html lang="nb">classic</html>');
writeFileSync(join(classic, 'assets', 'index-classic.js'), '/* classic */');
writeFileSync(join(classic, 'favicon.ico'), 'classic icon');
writeFileSync(join(nextBuild, 'index.html'), '<html lang="nb">next</html>');
writeFileSync(join(nextBuild, 'next-assets', 'index-next.js'), '/* next */');

const ORIGIN = 'http://localhost:8787';
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
    KA_NEXT_ONLY: '1',
  });
  delete process.env.KA_NEXT_LAYOUT;
  ({ app } = await import('./app.ts'));
  config = await import('./config.ts');
});
after(() => rmSync(builds, { recursive: true, force: true }));

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

const switchTo = (ui: string) =>
  app.request('/api/next/ui', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
    },
    body: JSON.stringify({ ui }),
  });

describe('with only the next client', () => {
  test('serves it at `/` and every page address, whatever the cookie says', async () => {
    for (const path of ['/', '/innstillinger', '/?t=abc-123'])
      for (const cookie of [undefined, 'ka_ui=classic', 'ka_ui=next']) {
        const { res, body } = await page(path, cookie);
        assert.equal(res.status, 200, `${path} ${cookie}`);
        assert.equal(body, NEXT, `${path} ${cookie}`);
        assert.equal(res.headers.get('Cache-Control'), 'no-cache');
      }
  });

  test('leaves apps/web out: its files, its icon and its API are not served', async () => {
    assert.equal((await page('/assets/index-classic.js')).res.status, 404);
    assert.notEqual((await page('/favicon.ico')).body, 'classic icon');
    for (const path of ['/api/v2/health', '/api/v2/capabilities', '/api/v2/me'])
      assert.equal((await app.request(path)).status, 404, path);
    // The readiness probe's route is the server's own, not apps/web's.
    assert.equal((await app.request('/api/health')).status, 200);
    assert.equal((await page('/next-assets/index-next.js')).body, '/* next */');
  });

  test('«Endringslogg» and «Om prosjektet» are the next client’s addresses, as apps/web is not there', async () => {
    for (const path of ['/endringslogg', '/om-prosjektet'])
      assert.equal((await page(path, 'ka_ui=next')).body, NEXT, path);
  });

  test("opens apps/web's thread links in the next client, and keeps its own", async () => {
    for (const path of ['/threads/abc-123', '/chat/abc-123']) {
      const { res } = await page(path);
      assert.equal(res.status, 302, path);
      assert.equal(res.headers.get('Location'), '/?t=abc-123', path);
    }
    assert.equal((await page('/?t=abc-123')).res.status, 200);
  });

  test('offers no way back: the toggle says next, and choosing apps/web is refused with the cookie left as it is', async () => {
    const ui = await app.request('/api/next/ui');
    assert.deepEqual(await ui.json(), { ui: 'next', available: true });
    const back = await switchTo('classic');
    assert.equal(back.status, 409);
    assert.equal(back.headers.getSetCookie().filter((l) => l.startsWith('ka_ui=')).length, 0);
    assert.equal((await switchTo('next')).status, 200);
  });

  test('/api/next/me says so, and the page draws no way back to apps/web', async () => {
    const me = (await (await app.request('/api/next/me')).json()) as Record<string, unknown>;
    assert.equal(me.nextOnly, true);
  });
});

describe('KA_NEXT_ONLY', () => {
  test('is warned about and ignored while KA_NEXT is off, so apps/web is served', () => {
    const warnings: string[] = [];
    mock.method(console, 'warn', (...args: unknown[]) =>
      warnings.push(args.map(String).join(' ')),
    );
    try {
      const next = config.nextConfig({ KA_NEXT_ONLY: '1', WEB_NEXT_ROOT: nextBuild });
      assert.equal(next.enabled, false);
      assert.equal(next.only, false);
    } finally {
      mock.restoreAll();
    }
    assert.ok(
      warnings.some((w) => w.includes('KA_NEXT_ONLY') && w.includes('ignored')),
      warnings.join('\n'),
    );
  });

  test('stops the server when the next client is not built, as there is no client to serve', () => {
    const errors: string[] = [];
    mock.method(console, 'error', (...args: unknown[]) =>
      errors.push(args.map(String).join(' ')),
    );
    const exit = mock.method(process, 'exit', (code?: number) => {
      throw new Error(`exit ${code}`);
    });
    try {
      for (const root of [unbuilt, ''])
        assert.throws(
          () => config.nextConfig({ KA_NEXT: '1', KA_NEXT_ONLY: '1', WEB_NEXT_ROOT: root }),
          /exit 1/,
          root,
        );
      assert.equal(exit.mock.callCount(), 2);
    } finally {
      mock.restoreAll();
    }
    assert.ok(
      errors.every((e) => e.includes('WEB_NEXT_ROOT has no index.html')),
      errors.join('\n'),
    );
  });

  test('is off unless switched on, so KA’s own site keeps apps/web', () => {
    for (const value of [undefined, '', '0', 'false', 'off'])
      assert.equal(
        config.nextConfig({ KA_NEXT: '1', KA_NEXT_ONLY: value, WEB_NEXT_ROOT: nextBuild }).only,
        false,
        String(value),
      );
  });
});
