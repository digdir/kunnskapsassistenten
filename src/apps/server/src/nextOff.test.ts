import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

/*
 * The next client built but not switched on, as the image is until `KA_NEXT=1` (decisions/0013):
 * apps/web for everyone, whatever the cookie says, and no `/api/next/*`, so apps/web draws no
 * «Prøv ny versjon».
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-next-off-'));
const classic = join(builds, 'web');
const nextBuild = join(builds, 'web-next');
mkdirSync(join(classic, 'assets'), { recursive: true });
mkdirSync(join(nextBuild, 'next-assets'), { recursive: true });
writeFileSync(join(classic, 'index.html'), '<html lang="nb">classic</html>');
writeFileSync(join(nextBuild, 'index.html'), '<html lang="nb">next</html>');
writeFileSync(join(nextBuild, 'next-assets', 'index-next.js'), '/* next */');

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.WEB_ROOT = classic;
process.env.WEB_NEXT_ROOT = nextBuild;
delete process.env.KA_NEXT;

let app: typeof import('./app.ts').app;
before(async () => {
  ({ app } = await import('./app.ts'));
});
after(() => rmSync(builds, { recursive: true, force: true }));

describe('with KA_NEXT off', () => {
  test('every browser gets apps/web, the cookie and thread links included', async () => {
    for (const path of ['/', '/?t=abc', '/threads/abc']) {
      const res = await app.request(path, { headers: { Cookie: 'ka_ui=next' } });
      assert.equal(res.status, 200, path);
      assert.equal(await res.text(), '<html lang="nb">classic</html>', path);
    }
  });

  test('/api/next/* is not there, so the toggle is neither offered nor settable', async () => {
    for (const [method, path] of [
      ['GET', '/api/next/ui'],
      ['POST', '/api/next/ui'],
      ['GET', '/api/next/me'],
      ['GET', '/api/next/genki/v1/models'],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ ui: 'next' }) } : {}),
      });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.doesNotMatch(res.headers.getSetCookie().join('\n'), /ka_ui=/);
    }
  });

  test("the next client's files are not served", async () => {
    const res = await app.request('/next-assets/index-next.js');
    assert.notEqual(await res.text(), '/* next */');
  });
});
