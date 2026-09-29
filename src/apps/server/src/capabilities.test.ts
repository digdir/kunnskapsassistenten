import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

// config.ts exits on a missing key at import time, hence the dynamic import.
process.env.DIGDIR_API_KEY ??= 'test-key';

type Module = typeof import('./capabilities.ts');
let noteTitleFromBackend: Module['noteTitleFromBackend'];
let capabilities: Module['capabilities'];
let probeFilters: Module['probeFilters'];
let probe: Module['probe'];
let probeComplete: Module['probeComplete'];
let impossibleFilter: Module['impossibleFilter'];
let refused: Module['refused'];

before(async () => {
  ({
    noteTitleFromBackend,
    capabilities,
    probeFilters,
    probe,
    probeComplete,
    impossibleFilter,
    refused,
  } = await import('./capabilities.ts'));
});

const TYPE = { id: 'documentType', field: 'type', label: 'dokumenttyper' } as const;
const YEAR = {
  id: 'year',
  field: 'concerned_years',
  valueType: 'integer',
  label: 'år',
} as const;
const IMPOSSIBLE = {
  fields: [{ field: 'type', 'selected-options': ['ZZZ_ingen_slik_verdi'] }],
};

const never = (signal: AbortSignal): Promise<number | null> =>
  new Promise((_, reject) =>
    signal.addEventListener('abort', () => reject(new Error('aborted'))),
  );

describe('noteTitleFromBackend', () => {
  test('a title echoed back unchanged is not a generated one', () => {
    noteTitleFromBackend('Hva gjorde Digdir i 2024?', 'Hva gjorde Digdir i 2024?');
    assert.equal(capabilities().threadTitles, false);
  });

  test('a title the backend changed means it names threads itself', () => {
    noteTitleFromBackend('Hva gjorde Digdir i 2024?', 'Digdirs aktiviteter i 2024');
    assert.equal(capabilities().threadTitles, true);
  });

  test('an empty title never flips the capability', () => {
    noteTitleFromBackend('Noe', '');
    assert.equal(capabilities().threadTitles, true);
  });

  test('capabilities() hands out a copy, so a caller cannot mutate the state', () => {
    const snapshot = capabilities();
    snapshot.filters = true;
    assert.equal(capabilities().filters, false);
  });
});

describe('probeFilters', () => {
  test('sends the plain and the impossible search at once', async () => {
    let started = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const pending = probeFilters(new AbortController().signal, IMPOSSIBLE, async (filterBy) => {
      started += 1;
      await gate;
      return filterBy ? 0 : 5;
    });
    assert.equal(started, 2);
    release();
    assert.equal(await pending, true);
  });

  test('a filter that still finds chunks means the backend dropped it', async () => {
    const seen = await probeFilters(new AbortController().signal, IMPOSSIBLE, async (f) =>
      f ? 3 : 5,
    );
    assert.equal(seen, false);
  });

  test('no answer, or no chunks without the filter, is «could not tell»', async () => {
    const signal = new AbortController().signal;
    assert.equal(await probeFilters(signal, IMPOSSIBLE, async (f) => (f ? 0 : null)), null);
    assert.equal(await probeFilters(signal, IMPOSSIBLE, async () => 0), null);
    assert.equal(await probeFilters(signal, IMPOSSIBLE, async (f) => (f ? null : 5)), null);
  });
});

describe('probe', () => {
  test('an attempt that times out is tried again, not taken as a no', async () => {
    let calls = 0;
    const caps = await probe(
      10,
      [0],
      (filterBy, signal) => {
        calls += 1;
        return calls <= 2 ? never(signal) : Promise.resolve(filterBy ? 0 : 4);
      },
      [TYPE],
    );
    assert.equal(caps.filters, true);
    assert.equal(probeComplete(), true);
    assert.equal(calls, 4);
  });

  test('a filter the backend refuses with a JSON-RPC error is not a yes', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const call = JSON.parse(String(init?.body)) as { params: { arguments: object } };
      const payload =
        'overrides' in call.params.arguments
          ? { jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'Invalid filter' } }
          : { jsonrpc: '2.0', id: 1, result: { structuredContent: { chunks: [{}, {}] } } };
      return new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const caps = await probe(1000, [], undefined, [TYPE]);
      assert.equal(caps.filters, false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test('when the retries run out, it settles on no', async () => {
    const caps = await probe(10, [0, 0], async () => null, [TYPE]);
    assert.equal(caps.filters, false);
    assert.equal(probeComplete(), true);
  });
});

describe('impossibleFilter', () => {
  test('uses a configured text field, with a value no document has', () => {
    assert.deepEqual(impossibleFilter([YEAR, TYPE]), {
      fields: [{ field: 'type', 'selected-options': ['ZZZ_ingen_slik_verdi'] }],
    });
  });

  test('a year field alone gets an integer and its value type', () => {
    assert.deepEqual(impossibleFilter([YEAR]), {
      fields: [
        { field: 'concerned_years', 'selected-options': ['-1'], 'value-type': 'integer' },
      ],
    });
  });

  test('no fields means no probe: filters are off without asking the backend', async () => {
    let asked = false;
    const caps = await probe(
      10,
      [0],
      async () => {
        asked = true;
        return 5;
      },
      [],
    );
    assert.equal(impossibleFilter([]), undefined);
    assert.equal(caps.filters, false);
    assert.equal(asked, false);
  });
});

describe('refused', () => {
  test('a JSON-RPC error with no result is a refusal, as #15 answers a bad filter', () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602, message: 'x' },
    });
    assert.equal(refused(body), true);
    assert.equal(refused(`event: message\ndata: ${body}\n\n`), true);
  });

  test('a tool error in the result is a refusal', () => {
    assert.equal(refused('{"jsonrpc":"2.0","id":1,"result":{"isError":true}}'), true);
  });

  test('a result, streamed or not, is not', () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { structuredContent: { chunks: [] } },
    });
    assert.equal(refused(body), false);
    assert.equal(
      refused(`data: {"method":"notifications/progress"}\n\ndata: ${body}\n\n`),
      false,
    );
  });
});
