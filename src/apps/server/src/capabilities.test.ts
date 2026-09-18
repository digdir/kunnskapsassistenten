import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

// config.ts exits on a missing key at import time, hence the dynamic import.
process.env.DIGDIR_API_KEY ??= 'test-key';

let noteTitleFromBackend: typeof import('./capabilities.ts').noteTitleFromBackend;
let capabilities: typeof import('./capabilities.ts').capabilities;

before(async () => {
  ({ noteTitleFromBackend, capabilities } = await import('./capabilities.ts'));
});

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
