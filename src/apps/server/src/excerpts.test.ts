import assert from 'node:assert/strict';
import { afterEach, before, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.TYPESENSE_API_HOST = 'typesense.test';
process.env.TYPESENSE_API_KEY_ADMIN = 'test-typesense-key';
process.env.KUDOS_DOCS_COLLECTION = 'kudos_documents_test';

let excerpts: typeof import('./excerpts.ts');
before(async () => {
  excerpts = await import('./excerpts.ts');
});

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});

test(
  'gives up on a Typesense that never answers, so the sources are not held up',
  { timeout: 2000 },
  async () => {
    // The lookup sits between the answer and its `sources` and `done` events.
    globalThis.fetch = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;

    const started = Date.now();
    await assert.rejects(excerpts.excerpts(['c1'], 50));
    assert.ok(Date.now() - started < 1000, 'gave up at the timeout, not later');
  },
);

test('waits as long as the facets do by default, 5 s', () => {
  assert.equal(excerpts.TIMEOUT_MS, 5000);
});

test('reads the passages Typesense has, by chunk id', async () => {
  globalThis.fetch = (async () =>
    Response.json({
      hits: [{ document: { chunk_id: 'c1', content_markdown: ' Teksten. ' } }],
    })) as typeof fetch;

  assert.deepEqual(await excerpts.excerpts(['c1', 'c2']), new Map([['c1', 'Teksten.']]));
});
