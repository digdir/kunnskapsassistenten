import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { events, fakeBackend, setEnvironment, type Backend } from '../fixtures/backend.ts';

/*
 * The contract of `/api/v2/*` with the client in apps/web: the agent's steps
 * and tool calls as events, one source per chunk, and the dataset's fields and
 * name from the configuration.
 */
setEnvironment();

let app: typeof import('./app.ts').app;
let backend: Backend;
before(async () => {
  ({ app } = await import('./app.ts'));
  backend = fakeBackend();
});
after(() => backend.restore());

const ASK = {
  query: 'Hva sier årsrapportene?',
  filter: { type: ['Årsrapport'], concerned_years: ['2024'] },
};

describe('/api/v2/ask', () => {
  let sent: Array<Record<string, any>> = [];
  before(async () => {
    const res = await app.request('/api/v2/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ASK),
    });
    assert.equal(res.status, 200);
    sent = await events(res);
  });

  test("passes on the agent's own words and each tool call", () => {
    assert.deepEqual(
      sent.filter((e) => e.type === 'thinking').map((e) => e.reasoning),
      ['Jeg søker i årsrapportene.'],
    );
    assert.deepEqual(
      sent.filter((e) => e.type === 'tool-call').map((e) => [e.tool, e.queries]),
      [['search', ['årsrapport 2024']]],
    );
  });

  test('gives one source per chunk, each with its own passage and chunk id', () => {
    assert.deepEqual(
      sent
        .find((e) => e.type === 'sources')
        ?.sources.map((s: Record<string, unknown>) => [
          s.marker,
          s.docNum,
          s.chunkId,
          s.excerpt,
        ]),
      [
        [1, '1', 'a', 'Første avsnitt.'],
        [2, '1', 'b', 'Andre avsnitt.'],
        [3, '2', 'c', 'Tredje avsnitt.'],
      ],
    );
  });

  test('takes the filter keyed by field name, and passes it on with the value type', () => {
    assert.deepEqual(backend.mcp.at(-1)?.params.arguments.overrides['retrieve-filter-by'], {
      fields: [
        { field: 'type', 'selected-options': ['Årsrapport'] },
        { field: 'concerned_years', 'selected-options': ['2024'], 'value-type': 'integer' },
      ],
    });
  });

  test('a thread read back has one source per chunk', async () => {
    const body = (await (await app.request('/api/v2/conversations/c1')).json()) as {
      sources: Array<{ chunkId: string }>;
    };
    assert.deepEqual(
      body.sources.map((s) => s.chunkId),
      ['a', 'b', 'c'],
    );
  });
});

describe('the rest of /api/v2/*', () => {
  test('/api/v2/facets gives the id and the value type of each field', async () => {
    const body = (await (await app.request('/api/v2/facets')).json()) as {
      facets: Array<{ id: string; field: string; valueType?: string }>;
    };
    assert.deepEqual(
      body.facets.map((f) => [f.id, f.field, f.valueType]),
      [
        ['documentType', 'type', undefined],
        ['organisation', 'orgs_long', undefined],
        ['year', 'concerned_years', 'integer'],
      ],
    );
  });

  test('/api/v2/capabilities names the dataset', async () => {
    const body = (await (await app.request('/api/v2/capabilities')).json()) as {
      dataset?: unknown;
    };
    assert.deepEqual(body.dataset, {
      key: 'default',
      label: 'Kudos',
      description: 'Tre dokumenter',
    });
  });

  test('/api/v2/health, /api/v2/me and /api/v2/conversations are the same routes as in /api', async () => {
    assert.equal((await app.request('/api/v2/health')).status, 200);
    const me = (await (await app.request('/api/v2/me')).json()) as { userId: string };
    assert.ok(me.userId);
    const list = (await (await app.request('/api/v2/conversations')).json()) as {
      conversations: Array<{ id: string }>;
    };
    assert.deepEqual(
      list.conversations.map((c) => c.id),
      ['c1'],
    );
  });

  test('an unknown path under /api/v2 is a 404, not the page', async () => {
    const res = await app.request('/api/v2/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Ukjent endepunkt.' });
  });
});
