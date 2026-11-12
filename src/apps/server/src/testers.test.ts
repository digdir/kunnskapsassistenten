import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, mock, test } from 'node:test';
import { events, fakeBackend, setEnvironment, type Backend } from '../fixtures/backend.ts';

// Sign-in is off here, so the session's user id is the `ka_sid` cookie.
setEnvironment();
process.env.KA_TESTERS = 'tester-1, ansattporten:abc';
delete process.env.KA_TEST_ENVIRONMENT;

let app: typeof import('./app.ts').app;
let config: typeof import('./config.ts');
let headers: typeof import('./backend.ts');
let backend: Backend;
const sent: Array<{ path: string; environment: string | null }> = [];

before(async () => {
  ({ app } = await import('./app.ts'));
  config = await import('./config.ts');
  headers = await import('./backend.ts');
  backend = fakeBackend();
  const fake = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === 'backend.test')
      sent.push({
        path: url.pathname,
        environment: new Headers(init?.headers).get('GenAI-Environment'),
      });
    return fake(input, init);
  }) as typeof fetch;
});
after(() => backend.restore());

async function ask(sid: string, extra: Record<string, string> = {}) {
  sent.length = 0;
  const res = await app.request('/api/v2/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `ka_sid=${sid}`, ...extra },
    body: JSON.stringify({ query: 'Hva sier årsrapportene?' }),
  });
  assert.equal(res.status, 200);
  await events(res);
  return sent.map((s) => [s.path, s.environment]);
}

async function me(sid: string) {
  const res = await app.request('/api/v2/me', { headers: { Cookie: `ka_sid=${sid}` } });
  return (await res.json()) as { environment?: string };
}

describe('a tester in KA_TESTERS', () => {
  test("sends GenAI-Environment: test on every call to genki for the tester's question", async () => {
    assert.deepEqual(await ask('tester-1'), [
      ['/api/conversations', 'test'],
      ['/api/mcp', 'test'],
    ]);
  });

  test('is told by /api/v2/me which environment answers', async () => {
    assert.equal((await me('tester-1')).environment, 'test');
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
    assert.deepEqual(await ask('someone-else'), [
      ['/api/conversations', null],
      ['/api/mcp', null],
    ]);
  });

  test('cannot choose an environment by sending GenAI-Environment from the browser', async () => {
    assert.deepEqual(await ask('someone-else', { 'GenAI-Environment': 'test' }), [
      ['/api/conversations', null],
      ['/api/mcp', null],
    ]);
  });

  test('gets no environment from /api/v2/me', async () => {
    assert.equal('environment' in (await me('someone-else')), false);
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
