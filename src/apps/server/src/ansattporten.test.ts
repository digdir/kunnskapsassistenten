import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { serializeSigned } from 'hono/utils/cookie';
import {
  ALTINN_RESOURCE,
  startFakeAnsattporten,
  startFakeGenki,
  type FakeLogin,
} from '../fixtures/ansattporten.ts';

/*
 * AUTH_MODE=ansattporten through the real app: a fake Ansattporten signs the
 * person in, and a fake genki records what the BFF sends it.
 */
const CLIENT_ID = 'ka-test';
const CLIENT_SECRET = 'not-a-real-secret';

let op: Awaited<ReturnType<typeof startFakeAnsattporten>>;
let genki: Awaited<ReturnType<typeof startFakeGenki>>;
let app: typeof import('./app.ts').app;
let oidc: typeof import('./oidc.ts');

before(async () => {
  op = await startFakeAnsattporten(CLIENT_ID, CLIENT_SECRET);
  genki = await startFakeGenki();
  Object.assign(process.env, {
    AUTH_MODE: 'ansattporten',
    ANSATTPORTEN_ISSUER: op.issuer,
    ANSATTPORTEN_CLIENT_ID: CLIENT_ID,
    ANSATTPORTEN_CLIENT_SECRET: CLIENT_SECRET,
    ANSATTPORTEN_REDIRECT_URI: 'http://localhost:8787/auth/callback',
    ANSATTPORTEN_ALTINN_RESOURCE: ALTINN_RESOURCE,
    SESSION_SECRET: 's'.repeat(40),
    DIGDIR_API_BASE: genki.base,
    DIGDIR_TOOL: 'kunnskapsassistenten__default',
    KA_CAPABILITIES: 'no-filters',
  });
  delete process.env.DIGDIR_API_KEY;
  ({ app } = await import('./app.ts'));
  oidc = await import('./oidc.ts');
});

after(async () => {
  await op.close();
  await genki.close();
});

beforeEach(() => {
  genki.requests.length = 0;
  genki.state.me = { organisations: [] };
  genki.state.meRefused = false;
  genki.state.locked = false;
});

type Jar = Map<string, string>;

const keep = (res: Response, jar: Jar = new Map()) => {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const [name, ...rest] = (pair ?? '').split('=');
    if (!name) continue;
    const value = rest.join('=');
    if (value && !/Max-Age=0/i.test(line)) jar.set(name, value);
    else jar.delete(name);
  }
  return jar;
};
const cookie = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function login(person: FakeLogin) {
  op.nextLogin(person);
  const start = await app.request('/auth/start?next=%2Fthreads%2F1');
  const jar = keep(start);
  const { code, state } = op.authorize(start.headers.get('location') ?? '');
  const callback = await app.request(`/auth/callback?code=${code}&state=${state}`, {
    headers: { cookie: cookie(jar) },
  });
  keep(callback, jar);
  return { start, callback, jar };
}

const DIGDIR = { orgNumber: '991825827', name: 'Digdir' };
const NAV = { orgNumber: '889640782', name: 'NAV' };

const get = (path: string, jar: Jar, headers: Record<string, string> = {}) =>
  app.request(path, { headers: { cookie: cookie(jar), ...headers } });

const ask = (jar: Jar) =>
  app.request('/api/v2/ask', {
    method: 'POST',
    headers: { cookie: cookie(jar), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Hva sier årsrapportene?' }),
  });

const sse = async (res: Response) =>
  (await res.text())
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => JSON.parse(l.slice(6)) as Record<string, unknown>);

const toGenki = (path: string) => genki.requests.filter((r) => r.path === path);

describe('sign-in', () => {
  test('starts a code flow with PKCE, the API as resource and the Altinn resource', async () => {
    const res = await app.request('/auth/start');
    assert.equal(res.status, 302);
    const url = new URL(res.headers.get('location') ?? '');
    assert.equal(url.origin + url.pathname, `${op.issuer}/authorize`);
    const q = url.searchParams;
    assert.equal(q.get('response_type'), 'code');
    assert.equal(q.get('client_id'), CLIENT_ID);
    assert.equal(q.get('scope'), 'openid profile');
    assert.equal(q.get('code_challenge_method'), 'S256');
    assert.match(q.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43}$/);
    assert.ok(q.get('nonce'));
    assert.equal(q.get('resource'), 'digdir:genai');
    assert.deepEqual(JSON.parse(q.get('authorization_details') ?? '[]'), [
      { type: 'ansattporten:altinn:resource', resource: ALTINN_RESOURCE },
    ]);
  });

  test('the callback exchanges the code with the verifier, the redirect URI and the client secret', async () => {
    const { callback } = await login({ parties: [DIGDIR] });
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get('location'), '/threads/1');
    const { form, authorization } = op.tokenRequests.at(-1)!;
    assert.equal(form.grant_type, 'authorization_code');
    assert.ok(form.code_verifier);
    assert.equal(form.redirect_uri, 'http://localhost:8787/auth/callback');
    assert.equal(form.client_secret, undefined);
    assert.equal(
      authorization,
      `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    );
  });

  test('a callback whose state does not match is refused', async () => {
    op.nextLogin({ parties: [DIGDIR] });
    const start = await app.request('/auth/start');
    const jar = keep(start);
    const { code } = op.authorize(start.headers.get('location') ?? '');
    const res = await get(`/auth/callback?code=${code}&state=forged`, jar);
    assert.equal(res.status, 400);
  });

  test('the callback sends a foreign return address home, even in a forged return cookie', async () => {
    op.nextLogin({ parties: [DIGDIR] });
    const start = await app.request('/auth/start');
    const jar = keep(start);
    const { code, state } = op.authorize(start.headers.get('location') ?? '');
    const [name, signed] = [...jar].find(([k]) => k.endsWith('ka_return_to'))!;
    const pending = JSON.parse(decodeURIComponent(signed).replace(/\.[^.]*$/, ''));
    const forged = await serializeSigned(
      name,
      JSON.stringify({ ...pending, next: '//evil.example/x' }),
      's'.repeat(40),
    );
    jar.set(name, forged.slice(name.length + 1).split(';')[0]!);
    const res = await get(`/auth/callback?code=${code}&state=${state}`, jar);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/');
  });

  test('without a session the API asks for a sign-in', async () => {
    const res = await app.request('/api/v2/conversations');
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { login: string }).login, '/auth/login');
  });

  test('without a session a Kudos PDF asks for a sign-in too, as every /api route does', async () => {
    for (const method of ['GET', 'HEAD']) {
      const res = await app.request(
        '/api/next/kudos/files/a33bf297-afd2-4b38-992e-b23c8fec3d80',
        {
          method,
        },
      );
      assert.equal(res.status, 401, method);
    }
  });
});

describe('ID token checks', () => {
  const cases: Array<[string, FakeLogin]> = [
    ['a wrong nonce', { nonce: 'replayed' }],
    ['another issuer', { issuer: 'https://evil.example' }],
    ['another audience', { audience: 'someone-else' }],
    ['a signature from an unknown key', { signWith: 'stranger' }],
    ['an unsigned token', { signWith: 'none' }],
    ['an expired token', { idExpiresIn: -120 }],
  ];
  for (const [label, extra] of cases) {
    test(`refuses ${label}`, async () => {
      const { callback } = await login({ parties: [DIGDIR], ...extra });
      assert.equal(callback.status, 502);
    });
  }
});

describe('the tokens stay on the server', () => {
  test('no cookie holds any part of a token', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    await get('/api/v2/conversations', jar);
    const token = toGenki('/api/conversations')[0]?.headers.authorization?.slice(7) ?? '';
    assert.ok(token.split('.').length === 3);
    for (const value of jar.values())
      for (const part of token.split('.')) assert.ok(!decodeURIComponent(value).includes(part));
  });

  test('/api/me names the person and the organisation, without a token', async () => {
    const { jar } = await login({ parties: [DIGDIR], name: 'Kari Testansatt' });
    const me = (await (await get('/api/v2/me', jar)).json()) as Record<string, any>;
    assert.equal(me.user.name, 'Kari Testansatt');
    assert.deepEqual(me.organisations, [DIGDIR]);
    assert.ok(!JSON.stringify(me).includes('eyJ'));
  });
});

describe("the person's token to genki", () => {
  test('one organisation: bearer token, no Acting-For, no API key and no X-User-Id', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    assert.equal((await get('/api/v2/conversations', jar)).status, 200);
    const sent = await sse(await ask(jar));
    assert.deepEqual(sent.at(-1), {
      type: 'done',
      conversationId: 'c1',
      insufficient: false,
      taskId: 't1',
    });
    for (const path of ['/api/conversations', '/api/mcp']) {
      const headers = toGenki(path)[0]?.headers;
      assert.match(headers?.authorization ?? '', /^Bearer ey/, path);
      assert.equal(headers?.['genai-acting-for'], undefined, path);
      assert.equal(headers?.['x-api-key'], undefined, path);
      assert.equal(headers?.['x-user-id'], undefined, path);
    }
  });

  test('several organisations ask for a choice, and the chosen one goes as GenAI-Acting-For', async () => {
    const { callback, jar } = await login({ parties: [DIGDIR, NAV] });
    assert.equal(callback.headers.get('location'), '/auth/org?next=%2Fthreads%2F1');
    assert.equal((await get('/api/v2/conversations', jar)).status, 401);
    const back = await get('/auth/login?next=%2F', jar);
    assert.equal(back.headers.get('location'), '/auth/org?next=%2F');
    assert.match(await (await get('/auth/org?next=%2F', jar)).text(), /NAV \(889640782\)/);

    const choose = (org: string) =>
      app.request('/auth/org', {
        method: 'POST',
        headers: {
          cookie: cookie(jar),
          origin: 'http://localhost:8787',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `org=${org}&next=%2F`,
      });
    assert.equal((await choose('999999999')).status, 400);
    assert.equal((await choose(NAV.orgNumber)).status, 302);

    await get('/api/v2/conversations', jar);
    assert.equal(toGenki('/api/conversations')[0]?.headers['genai-acting-for'], NAV.orgNumber);
  });

  test('models and feedback go with the token too', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    await get('/api/v2/models', jar);
    const rated = await app.request('/api/v2/feedback', {
      method: 'POST',
      headers: { cookie: cookie(jar), 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'c1', taskId: 't1', rating: 'up' }),
    });
    assert.deepEqual(await rated.json(), { ok: true });
    assert.deepEqual(JSON.parse(toGenki('/api/feedback')[0]?.body ?? '{}'), {
      task: 't1',
      rating: 'up',
    });
    for (const path of ['/v1/models', '/api/feedback'])
      assert.match(toGenki(path)[0]?.headers.authorization ?? '', /^Bearer ey/, path);
  });

  test('feedback on a run that is not in the thread is refused before genki', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    const res = await app.request('/api/v2/feedback', {
      method: 'POST',
      headers: { cookie: cookie(jar), 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'c1', taskId: 'someone-elses', rating: 'down' }),
    });
    assert.equal(res.status, 404);
    assert.equal(toGenki('/api/feedback').length, 0);
  });
});

describe('a token that lists no organisations', () => {
  test("asks genki's /me, and shows the email as the name", async () => {
    genki.state.me = {
      organisations: [{ orgNumber: '312521172', name: 'Digdir plattform', rights: ['use'] }],
    };
    const { callback, jar } = await login({ email: 'kari@digdir.no' });
    assert.equal(callback.status, 302);
    assert.match(toGenki('/me')[0]?.headers.authorization ?? '', /^Bearer ey/);
    const me = (await (await get('/api/v2/me', jar)).json()) as Record<string, any>;
    assert.equal(me.user.name, 'kari@digdir.no');
    assert.deepEqual(me.organisations, [{ orgNumber: '312521172', name: 'Digdir plattform' }]);
  });

  test('an Entra login genki does not trust gets a page that says so', async () => {
    genki.state.meRefused = true;
    const { callback, jar } = await login({ email: 'ekstern@example.com' });
    assert.equal(callback.status, 403);
    assert.match(await callback.text(), /ikke blant dem som slipper inn i testmiljøet/);
    assert.equal((await get('/api/v2/conversations', jar)).status, 401);
    const again = await get('/auth/login', jar);
    assert.equal(again.status, 403);
    assert.match(await again.text(), /Logg ut/);
  });

  test('no organisations at all is refused with a clear page', async () => {
    const { callback } = await login({ email: 'kari@digdir.no' });
    assert.equal(callback.status, 403);
    assert.match(await callback.text(), /Ingen tilgang/);
  });
});

describe('a locked environment', () => {
  test('the question ends with a sentence that says so, and its own code', async () => {
    genki.state.locked = true;
    const { jar } = await login({ parties: [DIGDIR] });
    const sent = await sse(await ask(jar));
    const error = sent.find((e) => e.type === 'error');
    assert.equal(error?.code, 'locked_environment');
    assert.match(String(error?.message), /Testmiljøet er låst/);
  });
});

describe('refresh', () => {
  test('a token about to run out is refreshed with the refresh token before genki is asked', async () => {
    const { jar } = await login({ parties: [DIGDIR], accessExpiresIn: 30 });
    const first = op.tokenRequests.length;
    await get('/api/v2/conversations', jar);
    const refresh = op.tokenRequests
      .slice(first)
      .find((r) => r.form.grant_type === 'refresh_token');
    assert.ok(refresh?.form.refresh_token);
    const sent = toGenki('/api/conversations')[0]?.headers.authorization ?? '';
    assert.equal(
      oidc.decodeJwt(sent.slice(7)).n,
      Number(refresh.form.refresh_token.slice(3)) + 1,
    );
  });

  test('a refresh that fails signs the person out', async () => {
    const { jar } = await login({ parties: [DIGDIR], accessExpiresIn: 30 });
    op.refuseRefresh(true);
    try {
      assert.equal((await get('/api/v2/conversations', jar)).status, 401);
      assert.equal(toGenki('/api/conversations').length, 0);
    } finally {
      op.refuseRefresh(false);
    }
  });
});

describe('logout', () => {
  test('ends the Ansattporten session with the ID token and comes back to the app', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    const res = await get('/auth/logout', jar, { 'Sec-Fetch-Dest': 'document' });
    const url = new URL(res.headers.get('location') ?? '');
    assert.equal(url.origin + url.pathname, `${op.issuer}/logout`);
    assert.match(url.searchParams.get('id_token_hint') ?? '', /^ey/);
    assert.equal(url.searchParams.get('post_logout_redirect_uri'), 'http://localhost:8787/');
    assert.equal((await get('/api/v2/conversations', jar)).status, 401);
  });

  test('an image cannot sign the person out', async () => {
    const { jar } = await login({ parties: [DIGDIR] });
    const res = await get('/auth/logout', jar, { 'Sec-Fetch-Dest': 'image' });
    assert.equal(res.status, 403);
    assert.equal((await get('/api/v2/conversations', jar)).status, 200);
  });
});

describe('organisationsFrom', () => {
  test('reads organisation numbers for the Altinn resource only, once each', () => {
    const claims = {
      authorization_details: [
        {
          type: 'ansattporten:altinn:resource',
          resource: ALTINN_RESOURCE,
          authorized_parties: [
            { orgno: { ID: '0192:991825827' }, name: 'Digdir' },
            { orgno: { ID: '0192:991825827' }, name: 'Digdir' },
            { orgno: { ID: 'bad' }, name: 'Broken' },
          ],
        },
        {
          type: 'ansattporten:altinn:resource',
          resource: 'urn:altinn:resource:something-else',
          authorized_parties: [{ orgno: { ID: '0192:889640782' }, name: 'NAV' }],
        },
      ],
    };
    assert.deepEqual(oidc.organisationsFrom(claims, ALTINN_RESOURCE), [DIGDIR]);
  });
});
