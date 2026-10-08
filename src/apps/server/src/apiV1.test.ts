import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { format } from 'node:util';
import { events, fakeBackend, setEnvironment, type Backend } from '../fixtures/backend.ts';

/*
 * The contract of `/api/*` with the client in apps/web-preact: the format of
 * main 8639267. The requests are the ones that client sends (useTurn.ts,
 * Filters.tsx, useConversations.ts), and the answers are read the way it reads
 * them.
 */
setEnvironment();

let app: typeof import('./app.ts').app;
let backend: Backend;
before(async () => {
  ({ app } = await import('./app.ts'));
  backend = fakeBackend();
});
after(() => backend.restore());

/** What useTurn.ts handles. Its switch has no default: any other type loses the turn. */
const HANDLED = new Set(['conversation', 'stage', 'delta', 'sources', 'done', 'error']);

/** The body useTurn.ts sends, with the filter keyed by `facet.field`, as Filters.tsx keeps it. */
const ASK = {
  query: 'Hva sier årsrapportene?',
  filter: {
    type: ['Årsrapport'],
    orgs_long: ['Digitaliseringsdirektoratet'],
    concerned_years: ['2024'],
  },
};

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/api/ask, as the client in apps/web-preact asks', () => {
  let sent: Array<Record<string, any>> = [];
  before(async () => {
    const res = await post('/api/ask', ASK);
    assert.equal(res.status, 200);
    sent = await events(res);
  });

  test('sends only the six event types the client handles', () => {
    const types = sent.map((e) => e.type);
    assert.deepEqual(
      types.filter((t) => !HANDLED.has(t)),
      [],
      `the backend thought and ran a search, and none of it may reach the client: ${types}`,
    );
    assert.equal(types[0], 'conversation');
    assert.deepEqual(types.slice(-3), ['delta', 'sources', 'done']);
  });

  test('sends a stage where main did: on each step the agent took', () => {
    assert.deepEqual(
      sent.filter((e) => e.type === 'stage').map((e) => e.stage),
      ['starting', 'writing', 'searching', 'done'],
    );
    assert.deepEqual(sent.find((e) => e.stage === 'searching')?.queries, ['årsrapport 2024']);
  });

  test('sends the answer, not the plan', () => {
    assert.equal(
      sent
        .filter((e) => e.type === 'delta')
        .map((e) => e.text)
        .join(''),
      'Svaret [1], [2] og [3].',
    );
  });

  test('gives one source per document, with every passage of it, as main did', () => {
    assert.deepEqual(sent.find((e) => e.type === 'sources')?.sources, [
      {
        docNum: '1',
        title: 'Årsrapport 2024',
        url: 'https://kudos.example/documents/1',
        marker: 1,
        excerpt: 'Første avsnitt.\n\nAndre avsnitt.',
      },
      {
        docNum: '2',
        title: 'Tildelingsbrev 2024',
        url: 'https://kudos.example/documents/2',
        marker: 2,
        excerpt: 'Tredje avsnitt.',
      },
    ]);
  });

  test('takes the filter keyed by the Typesense field names, and passes it on', () => {
    assert.deepEqual(backend.mcp.at(-1)?.params.arguments.overrides['retrieve-filter-by'], {
      fields: [
        { field: 'type', 'selected-options': ['Årsrapport'] },
        { field: 'orgs_long', 'selected-options': ['Digitaliseringsdirektoratet'] },
        { field: 'concerned_years', 'selected-options': ['2024'], 'value-type': 'integer' },
      ],
    });
  });

  test('a thread read back has the sources one per document too', async () => {
    const res = await app.request('/api/conversations/c1');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sources: Array<{ docNum: string }> };
    assert.deepEqual(
      body.sources.map((s) => s.docNum),
      ['1', '2'],
    );
  });
});

describe('the rest of /api/*, in main’s shape', () => {
  test("a turn stored as failed reads back as a sentence of ours, not the backend's", async (t) => {
    const error = t.mock.method(console, 'error', () => {});
    backend.messages = [
      { id: 'm1', role: 'user', text: 'Hva sier årsrapportene?', created: 1 },
      {
        id: 'm2',
        role: 'assistant',
        // How headless-rag stores a failed turn (digdir/digdir-headless-rag#22).
        text: 'LLM request failed at iteration 2: Interceptor Exception: llm.internal',
        created: 2,
      },
    ];
    try {
      const text = await (await app.request('/api/conversations/c9')).text();
      assert.doesNotMatch(text, /LLM request failed|llm\.internal/);
      assert.deepEqual(JSON.parse(text).messages[1], {
        id: 'm2',
        role: 'assistant',
        text: 'Svaret kom ikke fram.',
        created: 2,
      });
      assert.ok(error.mock.calls.some((c) => format(...c.arguments).includes('llm.internal')));
    } finally {
      backend.messages = [];
    }
  });

  test('/api/facets gives field, label and options, and nothing else', async () => {
    const body = (await (await app.request('/api/facets')).json()) as {
      facets: Array<Record<string, unknown>>;
    };
    assert.equal(body.facets.length, 3);
    for (const facet of body.facets) {
      assert.deepEqual(Object.keys(facet).sort(), ['field', 'label', 'options']);
    }
    assert.deepEqual(
      body.facets.map((f) => f.field),
      ['type', 'orgs_long', 'concerned_years'],
    );
  });

  test('/api/capabilities gives capabilities and settled, and nothing else', async () => {
    const body = (await (await app.request('/api/capabilities')).json()) as object;
    assert.deepEqual(Object.keys(body).sort(), ['capabilities', 'settled']);
  });

  test('/api/models gives an empty list of agents when the backend says no', async () => {
    // App.tsx reads `b.agents[0]`: `{ models: [] }` set the agents to undefined
    // and threw. The fake backend answers 404 on /v1/models.
    assert.deepEqual(await (await app.request('/api/models')).json(), { agents: [] });
  });

  test('/api/me gives what the contract says, and the user as App.tsx reads it', async () => {
    const me = (await (await app.request('/api/me')).json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(me).sort(), [
      'authEnabled',
      'authenticated',
      'backend',
      'tool',
      'user',
      'userId',
    ]);
    assert.equal(me.user, null, 'no one is signed in with sign-in off');
  });

  test('/api/health, /api/me and /api/conversations are here too', async () => {
    assert.equal((await app.request('/api/health')).status, 200);
    const me = (await (await app.request('/api/me')).json()) as { userId: string };
    assert.ok(me.userId);
    const list = (await (await app.request('/api/conversations')).json()) as {
      conversations: Array<{ id: string }>;
    };
    assert.deepEqual(
      list.conversations.map((c) => c.id),
      ['c1'],
    );
  });
});
