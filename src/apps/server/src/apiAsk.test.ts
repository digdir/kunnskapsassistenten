import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { events, fakeBackend, setEnvironment, type Backend } from '../fixtures/backend.ts';

/*
 * POST …/ask through the app, the route both versions share (apiAsk.ts), and
 * what the server does when it starts (app.ts, `startUp`).
 */
setEnvironment();

let app: typeof import('./app.ts').app;
let startUp: typeof import('./app.ts').startUp;
let facets: typeof import('./facets.ts');
let backend: Backend;
before(async () => {
  ({ app, startUp } = await import('./app.ts'));
  facets = await import('./facets.ts');
  backend = fakeBackend();
});
after(() => backend.restore());

const ask = async (body: unknown) =>
  events(
    await app.request('/api/v2/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const filterOf = async (id: string) =>
  ((await (await app.request(`/api/v2/conversations/${id}`)).json()) as { filter?: unknown })
    .filter;

describe('the filter of a new thread', () => {
  const filter = { concerned_years: ['2024'] };

  test('is not kept when the first turn fails, so a follow-up is not stuck with it', async () => {
    backend.failing = true;
    try {
      const sent = await ask({ query: 'Hva sier årsrapportene?', filter });
      const created = sent.find((e) => e.type === 'conversation')?.id as string;
      assert.equal(sent.at(-1)?.type, 'error');
      assert.equal(await filterOf(created), undefined);
    } finally {
      backend.failing = false;
    }
  });

  test('is there when the thread is read at the conversation event', async () => {
    // The client reads the thread when `conversation` arrives, before the turn
    // has an answer, and locks the filter from what it reads.
    let release = () => {};
    backend.held = new Promise((resolve) => (release = resolve));
    try {
      const res = await app.request('/api/v2/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Hva sier årsrapportene?', filter }),
      });
      const reader = res.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      const created = JSON.parse(first.slice(first.indexOf('{'), first.indexOf('\n')))
        .id as string;
      assert.deepEqual(await filterOf(created), filter);
      release();
      while (!(await reader.read()).done);
    } finally {
      backend.held = null;
      release();
    }
  });

  test('is kept once the first turn has its answer', async () => {
    const sent = await ask({ query: 'Hva sier årsrapportene?', filter });
    const created = sent.find((e) => e.type === 'conversation')?.id as string;
    assert.equal(sent.at(-1)?.type, 'done');
    assert.deepEqual(await filterOf(created), filter);
  });
});

describe('start-up', () => {
  test('warms the facets, so the first question after it is answered from the cache', async () => {
    facets.resetFacetCache();
    const before = backend.facetFetches;
    startUp();
    // Nothing here may fetch the facets itself, or a start-up that does not
    // would pass: wait for the fetch startUp makes, and for its answer.
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    for (let i = 0; i < 50 && backend.facetFetches === before; i += 1) await tick();
    for (let i = 0; i < 10; i += 1) await tick();
    assert.equal(backend.facetFetches, before + 1);
    // Every value of the field selected is no filter, which only a warm cache
    // can tell: cold, `askFilter` keeps the value.
    assert.deepEqual(
      facets.askFilter({ orgs_long: ['Digitaliseringsdirektoratet', 'Statens vegvesen'] }),
      { ok: true, filter: {} },
    );
  });
});
