import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, mock, test } from 'node:test';

/*
 * One client, apps/web-next, at every page address (decisions/0019), with the settings of the
 * previous client and of the switch still set, as on a deployment that has not dropped them:
 * they change nothing, and nor does a browser that chose the previous client.
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-client-'));
const client = join(builds, 'web-next');
const previous = join(builds, 'web');
mkdirSync(join(client, 'next-assets'), { recursive: true });
mkdirSync(join(previous, 'assets'), { recursive: true });
writeFileSync(join(client, 'index.html'), '<html lang="nb">client</html>');
writeFileSync(join(client, 'next-assets', 'index-client.js'), '/* client */');
writeFileSync(join(previous, 'index.html'), '<html lang="nb">previous</html>');
writeFileSync(join(previous, 'assets', 'index-previous.js'), '/* previous */');

const RETIRED = {
  KA_NEXT: '1',
  KA_NEXT_DEFAULT: '1',
  KA_NEXT_ONLY: '1',
  WEB_ROOT: previous,
  KA_EXCERPT_ENVIRONMENT: 'excerpts',
  TYPESENSE_API_HOST: 'typesense.example',
};

process.env.DIGDIR_API_KEY ??= 'test-key';
Object.assign(process.env, {
  AUTH_MODE: 'off',
  APP_ORIGIN: 'http://localhost:8787',
  WEB_NEXT_ROOT: client,
  ...RETIRED,
});
delete process.env.KA_NEXT_LAYOUT;

let app: typeof import('./app.ts').app;
let config: typeof import('./config.ts');
let pages: typeof import('./nextPage.ts');
before(async () => {
  ({ app } = await import('./app.ts'));
  config = await import('./config.ts');
  pages = await import('./nextPage.ts');
});
after(() => rmSync(builds, { recursive: true, force: true }));

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

describe('the page', () => {
  test('is the client at every page address, asked for again on every load', async () => {
    for (const path of [
      '/',
      '/?t=abc',
      '/innstillinger',
      '/endringslogg',
      '/om-prosjektet',
      '/onboarding',
      '/finnes-ikke',
    ]) {
      const { res, body } = await page(path);
      assert.equal(res.status, 200, path);
      assert.equal(body, '<html lang="nb">client</html>', path);
      assert.equal(res.headers.get('Cache-Control'), 'no-cache', path);
      assert.equal(res.headers.get('Vary'), null, path);
    }
  });

  test('is the client for a browser that chose the previous client, or the next one', async () => {
    for (const cookie of [
      'ka_ui=classic',
      '__Host-ka_ui=classic',
      'ka_ui=next',
      'ka_klient=gammel',
    ]) {
      for (const path of ['/', '/endringslogg', '/om-prosjektet']) {
        const { res, body } = await page(path, cookie);
        assert.equal(body, '<html lang="nb">client</html>', `${cookie} ${path}`);
        assert.doesNotMatch(res.headers.get('Set-Cookie') ?? '', /ka_ui=/);
      }
    }
  });
});

describe("the previous client's addresses", () => {
  test('a thread link, `/threads/:id` or the older `/chat/:id`, opens the thread', async () => {
    for (const cookie of [undefined, 'ka_ui=classic']) {
      for (const path of ['/threads/abc-123', '/chat/abc-123']) {
        const { res } = await page(path, cookie);
        assert.equal(res.status, 302, path);
        assert.equal(res.headers.get('Location'), '/?t=abc-123', path);
      }
    }
  });

  test('opens a genki id that starts with `_` or `-`, never one that starts with `.` or `:`', async () => {
    for (const id of ['_V1StGXR8Z5jdHi6BmyT', '-V1StGXR8Z5jdHi6BmyT'])
      assert.equal((await page(`/threads/${id}`)).res.headers.get('Location'), `/?t=${id}`, id);
    for (const path of ['/threads/.hidden', '/threads/..x', '/threads/:x', '/threads/a/b']) {
      const { res, body } = await page(path);
      assert.equal(res.status, 200, path);
      assert.equal(body, '<html lang="nb">client</html>', path);
    }
  });

  test('threadLinkFor maps only those two forms', () => {
    assert.equal(pages.threadLinkFor('/threads/x1'), '/?t=x1');
    assert.equal(pages.threadLinkFor('/chat/x1'), '/?t=x1');
    for (const path of ['/', '/innstillinger', '/endringslogg', '/threads', '/threads/'])
      assert.equal(pages.threadLinkFor(path), undefined, path);
  });

  test("the previous client's files are a 404, and never its page or the client's", async () => {
    for (const path of ['/assets/index-previous.js', '/assets/index-borte.js']) {
      const { res, body } = await page(path);
      assert.equal(res.status, 404, path);
      assert.doesNotMatch(body, /<html/, path);
    }
  });
});

describe("the client's files", () => {
  test('are kept for a year, and a name from an older build is a 404', async () => {
    const file = await page('/next-assets/index-client.js');
    assert.equal(file.res.status, 200);
    assert.equal(file.body, '/* client */');
    assert.match(file.res.headers.get('Cache-Control') ?? '', /immutable/);
    assert.equal((await page('/next-assets/index-borte.js')).res.status, 404);
  });
});

describe('the API', () => {
  test('/api/health answers for the probe, without sign-in', async () => {
    const res = await app.request('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test("the previous client's API and the switch are gone: a 404, and not the page", async () => {
    const calls: Array<[string, string]> = [
      ['GET', '/api/v2/health'],
      ['GET', '/api/v2/me'],
      ['GET', '/api/v2/capabilities'],
      ['GET', '/api/v2/facets'],
      ['GET', '/api/v2/conversations'],
      ['POST', '/api/v2/ask'],
      ['GET', '/api/next/ui'],
      ['POST', '/api/next/ui'],
      ['GET', '/api/capabilities'],
      ['GET', '/api/me'],
    ];
    for (const [method, path] of calls) {
      const res = await app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
        ...(method === 'POST' ? { body: JSON.stringify({ ui: 'classic', query: 'x' }) } : {}),
      });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.match(res.headers.get('Content-Type') ?? '', /json/, path);
      assert.doesNotMatch(res.headers.get('Set-Cookie') ?? '', /ka_ui=/, path);
    }
  });

  test('/api/next/me says nothing of the previous client', async () => {
    const me = (await (await app.request('/api/next/me')).json()) as Record<string, unknown>;
    assert.equal('nextOnly' in me, false);
  });
});

describe('the settings no longer read', () => {
  test('are named, by name only, so a deployment can drop them', () => {
    assert.deepEqual(
      config.retiredSettingsIn({ ...RETIRED, KA_NEXT_MODEL: 'x__y', KA_TESTERS: 'a' }),
      Object.keys(RETIRED),
    );
    assert.deepEqual(config.retiredSettingsIn({}), []);
  });

  test('a build without index.html, or a malformed model, stops the server', () => {
    const exit = mock.method(process, 'exit', (code?: number) => {
      throw new Error(`exit ${code}`);
    });
    mock.method(console, 'error', () => {});
    try {
      assert.throws(() => config.nextConfig({ WEB_NEXT_ROOT: previous + '-gone' }), /exit 1/);
      assert.throws(() => config.nextConfig({ KA_NEXT_MODEL: 'not a model' }), /exit 1/);
      assert.equal(exit.mock.callCount(), 2);
    } finally {
      mock.restoreAll();
    }
  });

  test('without a build there is no page, only the API', () => {
    assert.equal(config.nextConfig({}).webRoot, '');
  });
});
