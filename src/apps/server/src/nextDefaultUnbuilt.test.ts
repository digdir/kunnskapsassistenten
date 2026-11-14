import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, mock, test } from 'node:test';

/*
 * The next client as the default (`KA_NEXT_DEFAULT`, decisions/0018), but not built: it is not
 * offered, so every browser gets apps/web, as one that chose the next client does.
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-next-default-unbuilt-'));
const classic = join(builds, 'web');
const unbuilt = join(builds, 'web-next');
mkdirSync(classic);
mkdirSync(unbuilt);
writeFileSync(join(classic, 'index.html'), '<html lang="nb">classic</html>');

let app: typeof import('./app.ts').app;
const errors: string[] = [];
before(async () => {
  Object.assign(process.env, {
    AUTH_MODE: 'off',
    APP_ORIGIN: 'http://localhost:8787',
    DIGDIR_API_KEY: 'service-key',
    DIGDIR_API_BASE: 'http://127.0.0.1:9',
    WEB_ROOT: classic,
    WEB_NEXT_ROOT: unbuilt,
    KA_NEXT: '1',
    KA_NEXT_DEFAULT: '1',
  });
  delete process.env.KA_NEXT_LAYOUT;
  delete process.env.KA_NEXT_ONLY;
  mock.method(console, 'error', (...args: unknown[]) =>
    errors.push(args.map(String).join(' ')),
  );
  try {
    ({ app } = await import('./app.ts'));
  } finally {
    mock.restoreAll();
  }
});
after(() => rmSync(builds, { recursive: true, force: true }));

test('a browser that has not chosen gets apps/web, its thread links included, as one that chose the next client does', async () => {
  for (const path of ['/', '/?t=abc-123', '/threads/abc-123'])
    for (const cookie of [undefined, 'ka_ui=next']) {
      const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
      assert.equal(res.status, 200, `${path} ${cookie}`);
      assert.equal(await res.text(), '<html lang="nb">classic</html>', `${path} ${cookie}`);
    }
  assert.ok(
    errors.some((e) => e.includes('WEB_NEXT_ROOT has no index.html')),
    errors.join('\n'),
  );
});

test('the toggle says the next client is not offered, so apps/web draws no way into it', async () => {
  const body = (await (await app.request('/api/next/ui')).json()) as Record<string, unknown>;
  assert.equal(body.available, false);
});
