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

before(async () => {
  ({ noteTitleFromBackend, capabilities, probeFilters, probe, probeComplete } =
    await import('./capabilities.ts'));
});

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
    const pending = probeFilters(new AbortController().signal, async (filterBy) => {
      started += 1;
      await gate;
      return filterBy ? 0 : 5;
    });
    assert.equal(started, 2);
    release();
    assert.equal(await pending, true);
  });

  test('a filter that still finds chunks means the backend dropped it', async () => {
    const seen = await probeFilters(new AbortController().signal, async (f) => (f ? 3 : 5));
    assert.equal(seen, false);
  });

  test('no answer, or no chunks without the filter, is «could not tell»', async () => {
    const signal = new AbortController().signal;
    assert.equal(await probeFilters(signal, async (f) => (f ? 0 : null)), null);
    assert.equal(await probeFilters(signal, async () => 0), null);
    assert.equal(await probeFilters(signal, async (f) => (f ? null : 5)), null);
  });
});

describe('probe', () => {
  test('an attempt that times out is tried again, not taken as a no', async () => {
    let calls = 0;
    const caps = await probe(10, [0], (filterBy, signal) => {
      calls += 1;
      return calls <= 2 ? never(signal) : Promise.resolve(filterBy ? 0 : 4);
    });
    assert.equal(caps.filters, true);
    assert.equal(probeComplete(), true);
    assert.equal(calls, 4);
  });

  test('when the retries run out, it settles on no', async () => {
    const caps = await probe(10, [0, 0], async () => null);
    assert.equal(caps.filters, false);
    assert.equal(probeComplete(), true);
  });
});
