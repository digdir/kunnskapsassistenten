import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { startFakeGenki } from '../fixtures/ansattporten.ts';

/*
 * Testers (decisions/0015): every call to genki for a person in `KA_TESTERS` carries
 * `GenAI-Environment`. Sign-in is off here, so the session's user id is the `ka_sid` cookie.
 */
const ORIGIN = 'http://localhost:8787';

let genki: Awaited<ReturnType<typeof startFakeGenki>>;
let app: typeof import('./app.ts').app;
let config: typeof import('./config.ts');
let headers: typeof import('./backend.ts');

before(async () => {
  genki = await startFakeGenki();
  Object.assign(process.env, {
    AUTH_MODE: 'off',
    APP_ORIGIN: ORIGIN,
    DIGDIR_API_KEY: 'service-key',
    DIGDIR_API_BASE: genki.base,
    KA_TESTERS: 'tester-1, ansattporten:abc',
  });
  delete process.env.KA_TEST_ENVIRONMENT;
  delete process.env.KA_NEXT_LAYOUT;
  ({ app } = await import('./app.ts'));
  config = await import('./config.ts');
  headers = await import('./backend.ts');
});
after(() => genki.close());
beforeEach(() => {
  genki.requests.length = 0;
});

/** A thread list and a question through the proxy, as the client makes them; what genki got. */
async function calls(sid: string, extra: Record<string, string> = {}) {
  const cookie = { Cookie: `ka_sid=${sid}`, ...extra };
  const list = await app.request('/api/next/genki/api/conversations?page_size=100', {
    headers: cookie,
  });
  assert.equal(list.status, 200);
  const asked = await app.request('/api/next/genki/v1/chat/completions', {
    method: 'POST',
    headers: { ...cookie, 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      model: 'kunnskapsassistenten__default',
      messages: [{ role: 'user', content: 'Hva sier årsrapportene?' }],
      stream: true,
    }),
  });
  assert.equal(asked.status, 200);
  await asked.text();
  return genki.requests.map((r) => [r.path, r.headers['genai-environment'] ?? null]);
}

describe('a tester in KA_TESTERS', () => {
  test('sends GenAI-Environment: test on every call to genki for the tester', async () => {
    assert.deepEqual(await calls('tester-1'), [
      ['/api/conversations', 'test'],
      ['/v1/chat/completions', 'test'],
    ]);
  });

  test("sends it with the person's token too", () => {
    assert.deepEqual(headers.backendHeaders({ userId: 'ansattporten:abc', token: 'tok' }), {
      Authorization: 'Bearer tok',
      'GenAI-Environment': 'test',
    });
  });
});

describe('anyone not in KA_TESTERS', () => {
  test('sends no GenAI-Environment, so genki runs prod', async () => {
    assert.deepEqual(await calls('someone-else'), [
      ['/api/conversations', null],
      ['/v1/chat/completions', null],
    ]);
  });

  test('cannot choose an environment by sending GenAI-Environment from the browser', async () => {
    assert.deepEqual(await calls('someone-else', { 'GenAI-Environment': 'test' }), [
      ['/api/conversations', null],
      ['/v1/chat/completions', null],
    ]);
  });
});

describe('testersConfig', () => {
  test('KA_TESTERS takes user ids separated by commas, spaces or new lines', () => {
    const { ids } = config.testersConfig({ KA_TESTERS: ' a, b\nc  d,,' });
    assert.deepEqual([...ids], ['a', 'b', 'c', 'd']);
  });

  test('KA_TEST_ENVIRONMENT defaults to test and may name another environment', () => {
    assert.equal(config.testersConfig({ KA_TESTERS: 'a' }).environment, 'test');
    assert.equal(
      config.testersConfig({ KA_TESTERS: 'a', KA_TEST_ENVIRONMENT: 'staging' }).environment,
      'staging',
    );
  });

  test('with KA_TESTERS empty or unset nobody is a tester', () => {
    for (const env of [{}, { KA_TESTERS: '' }, { KA_TESTERS: ' , ' }]) {
      const testers = config.testersConfig(env);
      assert.equal(testers.ids.size, 0);
      assert.equal(headers.environmentFor('tester-1', testers), undefined);
      assert.equal(headers.environmentFor('', testers), undefined);
    }
  });

  test('a KA_TEST_ENVIRONMENT that is not an environment name stops the server when there are testers', () => {
    const exit = mock.method(process, 'exit', (code?: number) => {
      throw new Error(`exit ${code}`);
    });
    mock.method(console, 'error', () => {});
    try {
      assert.throws(
        () => config.testersConfig({ KA_TESTERS: 'a', KA_TEST_ENVIRONMENT: 'Test env' }),
        /exit 1/,
      );
      assert.equal(exit.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });

  test('a KA_TEST_ENVIRONMENT that is not an environment name is warned about and replaced while KA_TESTERS is empty', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.equal(
        config.testersConfig({ KA_TEST_ENVIRONMENT: 'Test env' }).environment,
        'test',
      );
      assert.equal(warn.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });
});

test('the template passes KA_TESTERS and KA_TEST_ENVIRONMENT only when given, so nobody is a tester by default', () => {
  const template = readFileSync(new URL('../../../deploy/main.bicep', import.meta.url), 'utf8');
  for (const [param, env] of [
    ['kaTesters', 'KA_TESTERS'],
    ['kaTestEnvironment', 'KA_TEST_ENVIRONMENT'],
  ]) {
    assert.match(template, new RegExp(`^param ${param} string = ''$`, 'm'));
    assert.match(
      template,
      new RegExp(
        `empty\\(${param}\\) \\? \\[\\] : \\[\\s*\\{ name: '${env}', value: ${param} \\}`,
      ),
    );
  }
});
