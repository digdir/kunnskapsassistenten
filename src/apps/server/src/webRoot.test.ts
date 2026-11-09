import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

/*
 * The one build the BFF serves, from WEB_ROOT, and what is left of the API
 * besides /api/v2 (decisions/0012).
 */
const build = mkdtempSync(join(tmpdir(), 'ka-web-'));
mkdirSync(join(build, 'assets'), { recursive: true });
writeFileSync(join(build, 'index.html'), '<html lang="nb">web</html>');
writeFileSync(join(build, 'assets', 'index-web.js'), '/* web */');

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.WEB_ROOT = build;

let app: typeof import('./app.ts').app;
before(async () => {
  ({ app } = await import('./app.ts'));
});
after(() => rmSync(build, { recursive: true, force: true }));

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

describe('the page', () => {
  test('is the build on any address, asked for again on every load', async () => {
    for (const path of ['/', '/threads/abc']) {
      const { res, body } = await page(path);
      assert.equal(res.status, 200, path);
      assert.equal(body, '<html lang="nb">web</html>', path);
      assert.equal(res.headers.get('Cache-Control'), 'no-cache', path);
    }
  });

  test('the old switch to the previous client changes nothing', async () => {
    const { res, body } = await page('/threads/abc?klient=gammel', 'ka_klient=gammel');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.headers.get('Set-Cookie') ?? '', /ka_klient=/);
    assert.equal(body, '<html lang="nb">web</html>');
  });
});

describe('the hashed files', () => {
  test('are kept for a year, and a name from an older build is a 404', async () => {
    const { res } = await page('/assets/index-web.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Cache-Control') ?? '', /immutable/);
    assert.equal((await page('/assets/index-borte.js')).res.status, 404);
  });
});

describe('the API besides /api/v2', () => {
  test('/api/health answers for the probe, without sign-in', async () => {
    const res = await app.request('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test('the rest of /api/* is gone, and is a 404 and not the page', async () => {
    for (const path of ['/api/capabilities', '/api/facets', '/api/me']) {
      const res = await app.request(path);
      assert.equal(res.status, 404, path);
      assert.match(res.headers.get('Content-Type') ?? '', /json/, path);
    }
  });
});
