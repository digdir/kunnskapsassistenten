import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

/*
 * Which client a browser gets: the page from one build or the other, by the
 * cookie `ka_klient`. The API is not part of it: each client asks for its own
 * version by path (decisions/0009).
 */
const builds = mkdtempSync(join(tmpdir(), 'ka-clients-'));
for (const [name, asset] of [
  ['ny', 'index-ny.js'],
  ['gammel', 'index-gammel.js'],
] as const) {
  mkdirSync(join(builds, name, 'assets'), { recursive: true });
  writeFileSync(join(builds, name, 'index.html'), `<html lang="nb">${name}</html>`);
  writeFileSync(join(builds, name, 'assets', asset), `/* ${name} */`);
}

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.WEB_ROOT = join(builds, 'ny');
process.env.WEB_ROOT_PREACT = join(builds, 'gammel');
delete process.env.KA_DEFAULT_CLIENT;

let app: typeof import('./app.ts').app;
let clientSwitch: typeof import('./clientSwitch.ts');
before(async () => {
  ({ app } = await import('./app.ts'));
  clientSwitch = await import('./clientSwitch.ts');
});
after(() => rmSync(builds, { recursive: true, force: true }));

const page = async (path: string, cookie?: string) => {
  const res = await app.request(path, cookie ? { headers: { Cookie: cookie } } : {});
  return { res, body: await res.text() };
};

describe('the page', () => {
  test('without the cookie it is the current client, the default', async () => {
    const { res, body } = await page('/');
    assert.equal(res.status, 200);
    assert.equal(body, '<html lang="nb">gammel</html>');
  });

  test('ka_klient=ny gives the new client, on any address', async () => {
    assert.equal(
      (await page('/threads/abc', 'ka_klient=ny')).body,
      '<html lang="nb">ny</html>',
    );
  });

  test('ka_klient=gammel gives the current client', async () => {
    assert.equal((await page('/', 'ka_klient=gammel')).body, '<html lang="nb">gammel</html>');
  });

  test('is asked for again on every load, and kept apart by the cookie in a cache', async () => {
    const { res } = await page('/', 'ka_klient=ny');
    assert.equal(res.headers.get('Cache-Control'), 'no-cache');
    assert.match(res.headers.get('Vary') ?? '', /\bCookie\b/);
  });
});

describe('?klient=', () => {
  test('?klient=ny sets the cookie and leaves the address', async () => {
    const res = await app.request('/?klient=ny');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/');
    assert.match(res.headers.get('Set-Cookie') ?? '', /^ka_klient=ny;.*Path=\//);
  });

  test('?klient=gammel does the same, and keeps the rest of the address', async () => {
    const res = await app.request('/threads/abc?klient=gammel&q=1', {
      headers: { Cookie: 'ka_klient=ny' },
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/threads/abc?q=1');
    assert.match(res.headers.get('Set-Cookie') ?? '', /^ka_klient=gammel;/);
  });

  test('a path that starts with two slashes stays on this host', async () => {
    // `//evil.example/x` in Location is another host to the browser, and this
    // runs before the sign-in check.
    const res = await app.request('//evil.example/x?klient=ny');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/evil.example/x');
    assert.match(res.headers.get('Set-Cookie') ?? '', /^ka_klient=ny;/);
  });

  test('a slash and a backslash stay on this host too', async () => {
    // The URL parser reads `\` as `/` in an http address, and so do browsers.
    for (const path of ['/\\evil.example/x?klient=ny', '/\\/evil.example/x?klient=ny&q=1']) {
      const location = (await app.request(path)).headers.get('Location') ?? '';
      assert.match(location, /^\/evil\.example\/x(\?q=1)?$/, `${path} gave ${location}`);
    }
  });

  test('an ordinary path keeps its search string, without klient', async () => {
    const res = await app.request('/threads/abc?q=1&klient=ny&r=2');
    assert.equal(res.headers.get('Location'), '/threads/abc?q=1&r=2');
  });

  test('an unknown value changes nothing', async () => {
    const { res, body } = await page('/?klient=beste', 'ka_klient=ny');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.headers.get('Set-Cookie') ?? '', /ka_klient=/);
    assert.equal(body, '<html lang="nb">ny</html>');
  });
});

describe('the rest is not switched', () => {
  test('the hashed files of both builds are there, whichever client is chosen', async () => {
    for (const cookie of ['ka_klient=ny', 'ka_klient=gammel']) {
      assert.equal((await page('/assets/index-ny.js', cookie)).res.status, 200);
      assert.equal((await page('/assets/index-gammel.js', cookie)).res.status, 200);
    }
    assert.equal((await page('/assets/index-borte.js')).res.status, 404);
  });

  test('the API is chosen by its path, not by the cookie', async () => {
    const body = (await (
      await app.request('/api/capabilities', {
        headers: { Cookie: 'ka_klient=ny' },
      })
    ).json()) as object;
    assert.deepEqual(Object.keys(body).sort(), ['capabilities', 'settled']);
  });
});

describe('the choice', () => {
  test('the cookie wins, and without one the default does', () => {
    assert.equal(clientSwitch.chooseClient('ny', 'gammel'), 'ny');
    assert.equal(clientSwitch.chooseClient('gammel', 'ny'), 'gammel');
    assert.equal(clientSwitch.chooseClient(undefined, 'ny'), 'ny');
    assert.equal(clientSwitch.chooseClient('noe annet', 'gammel'), 'gammel');
  });

  test('KA_DEFAULT_CLIENT is ny or gammel, gammel when unset, and nothing else', () => {
    assert.equal(clientSwitch.defaultClientFrom(undefined), 'gammel');
    assert.equal(clientSwitch.defaultClientFrom(''), 'gammel');
    assert.equal(clientSwitch.defaultClientFrom(' Ny '), 'ny');
    assert.throws(() => clientSwitch.defaultClientFrom('new'), /KA_DEFAULT_CLIENT/);
  });
});
