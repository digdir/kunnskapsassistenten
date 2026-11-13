import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, mock, test } from 'node:test';
import { events, fakeBackend, setEnvironment, type Backend } from '../fixtures/backend.ts';

// Sign-in is off here, so the session's user id is the `ka_sid` cookie.
setEnvironment();
process.env.KA_TESTERS = 'tester-1';
delete process.env.KA_TEST_ENVIRONMENT;
process.env.KA_EXCERPT_ENVIRONMENT = 'excerpts';

let app: typeof import('./app.ts').app;
let config: typeof import('./config.ts');
let headers: typeof import('./backend.ts');
let backend: Backend;
const sent: Array<{ path: string; environment: string | null }> = [];

const TRIAL = { 'KA-Trial-Excerpt-Citations': '1' };

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

/** A question from the session `sid`, and the environment each call to genki named. */
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

/** The thread list for the session `sid`, and the environment each call to genki named. */
async function threads(sid: string, extra: Record<string, string> = {}) {
  sent.length = 0;
  const res = await app.request('/api/v2/conversations', {
    headers: { Cookie: `ka_sid=${sid}`, ...extra },
  });
  assert.equal(res.status, 200);
  return sent.map((s) => [s.path, s.environment]);
}

async function me(sid: string) {
  const res = await app.request('/api/v2/me', { headers: { Cookie: `ka_sid=${sid}` } });
  return (await res.json()) as { excerptTrial?: boolean; environment?: string };
}

const asked = (environment: string | null) => [
  ['/api/conversations', environment],
  ['/api/mcp', environment],
];

describe('the excerpt trial, with KA_EXCERPT_ENVIRONMENT set', () => {
  test('asks genki for the excerpt environment when the person has turned the trial on', async () => {
    assert.deepEqual(await ask('person-1', TRIAL), asked('excerpts'));
    assert.deepEqual(await threads('person-1', TRIAL), [['/api/conversations', 'excerpts']]);
  });

  test('sends nothing extra when the trial is off', async () => {
    assert.equal((await me('person-1')).excerptTrial, true);
    assert.deepEqual(await ask('person-1'), asked(null));
    assert.deepEqual(await threads('person-1'), [['/api/conversations', null]]);
  });

  test("lets the testers' environment win", async () => {
    assert.deepEqual(await ask('tester-1', TRIAL), asked('test'));
    assert.deepEqual(await ask('person-1', TRIAL), asked('excerpts'));
  });

  test('never takes an environment name from the browser', async () => {
    assert.deepEqual(
      await ask('person-1', {
        'GenAI-Environment': 'prod',
        'KA-Trial-Excerpt-Citations': 'prod',
      }),
      asked(null),
    );
    assert.deepEqual(
      await ask('person-1', { ...TRIAL, 'GenAI-Environment': 'prod' }),
      asked('excerpts'),
    );
  });

  test("sends the environment with the person's token too", () => {
    const caller = headers.withExcerptTrial({ userId: 'ansattporten:abc', token: 'tok' }, '1');
    assert.deepEqual(headers.backendHeaders(caller), {
      Authorization: 'Bearer tok',
      'GenAI-Environment': 'excerpts',
    });
  });

  test('/api/v2/me offers the trial but never names its environment', async () => {
    const body = await me('person-1');
    assert.equal(body.excerptTrial, true);
    assert.equal(JSON.stringify(body).includes('excerpts'), false);
  });
});

describe('excerptEnvironmentConfig', () => {
  test('reads an unset or empty KA_EXCERPT_ENVIRONMENT as no trial', () => {
    for (const env of [{}, { KA_EXCERPT_ENVIRONMENT: '' }, { KA_EXCERPT_ENVIRONMENT: '  ' }])
      assert.equal(config.excerptEnvironmentConfig(env), undefined);
    assert.equal(
      config.excerptEnvironmentConfig({ KA_EXCERPT_ENVIRONMENT: ' cite-2 ' }),
      'cite-2',
    );
  });

  test('a KA_EXCERPT_ENVIRONMENT that is not an environment name stops the server', () => {
    const exit = mock.method(process, 'exit', (code?: number) => {
      throw new Error(`exit ${code}`);
    });
    mock.method(console, 'error', () => {});
    try {
      assert.throws(
        () => config.excerptEnvironmentConfig({ KA_EXCERPT_ENVIRONMENT: 'Excerpt env' }),
        /exit 1/,
      );
      assert.equal(exit.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });
});

test('the template passes KA_EXCERPT_ENVIRONMENT only when given, so there is no trial by default', () => {
  const template = readFileSync(new URL('../../../deploy/main.bicep', import.meta.url), 'utf8');
  assert.match(template, /^param kaExcerptEnvironment string = ''$/m);
  assert.match(
    template,
    /empty\(kaExcerptEnvironment\) \? \[\] : \[\s*\{ name: 'KA_EXCERPT_ENVIRONMENT', value: kaExcerptEnvironment \}/,
  );
});
