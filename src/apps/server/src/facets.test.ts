import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';

process.env.DIGDIR_API_KEY ??= 'test-key';

let facets: typeof import('./facets.ts');
before(async () => {
  facets = await import('./facets.ts');
});

const counts = (...pairs: Array<[string, number]>) =>
  pairs.map(([value, count]) => ({ value, count }));

describe('shapeFacet', () => {
  test('orders ordinary fields by count, descending', () => {
    const f = facets.shapeFacet('type', 'dokumenttyper', counts(['B', 2], ['A', 9], ['C', 5]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['A', 'C', 'B'],
    );
  });

  test('orders years chronologically, newest first, not by count', () => {
    const f = facets.shapeFacet(
      'concerned_years',
      'år',
      counts(['2020', 900], ['2024', 3], ['2022', 50]),
    );
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2024', '2022', '2020'],
    );
  });

  test('drops year values that are page numbers or parse noise', () => {
    const f = facets.shapeFacet(
      'concerned_years',
      'år',
      counts(['2436', 40], ['1989', 1], ['2036', 1], ['2024', 1], ['1990', 1], ['2035', 1]),
    );
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2035', '2024', '1990'],
    );
  });

  test('keeps a non-year field intact even when its values look numeric', () => {
    const f = facets.shapeFacet('type', 'dokumenttyper', counts(['2436', 1]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2436'],
    );
  });

  test('drops the empty value Typesense reports for unset fields', () => {
    const f = facets.shapeFacet('type', 'dokumenttyper', counts(['', 400], ['A', 1]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['A'],
    );
  });

  test('caps organisations higher than other fields', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ value: `v${i}`, count: n - i }));
    assert.equal(facets.shapeFacet('orgs_long', 'x', many(400)).options.length, 300);
    assert.equal(facets.shapeFacet('type', 'x', many(400)).options.length, 60);
  });

  test('a field Typesense returned nothing for yields no options', () => {
    assert.deepEqual(facets.shapeFacet('type', 'x', undefined).options, []);
  });
});

describe('toFilterBy', () => {
  test('shapes the selection the way the retrieval skill wants it', () => {
    assert.deepEqual(facets.toFilterBy({ type: ['Evaluering'] }), {
      fields: [{ field: 'type', 'selected-options': ['Evaluering'] }],
    });
  });

  test('drops fields with nothing selected', () => {
    assert.deepEqual(facets.toFilterBy({ type: ['A'], orgs_long: [] }), {
      fields: [{ field: 'type', 'selected-options': ['A'] }],
    });
  });

  test('ignores field names the backend does not facet on', () => {
    assert.equal(facets.toFilterBy({ not_a_field: ['x'] }), undefined);
  });

  test('an empty or absent selection sends no filter at all', () => {
    assert.equal(facets.toFilterBy({}), undefined);
    assert.equal(facets.toFilterBy(undefined), undefined);
  });
});

describe('cleanFilter', () => {
  test('keeps known fields as lists of strings', () => {
    assert.deepEqual(facets.cleanFilter({ type: ['Evaluering'], concerned_years: ['2023'] }), {
      type: ['Evaluering'],
      concerned_years: ['2023'],
    });
  });

  test('drops unknown fields, non-lists and non-strings', () => {
    assert.deepEqual(
      facets.cleanFilter({
        junk: ['x'],
        type: null,
        orgs_long: 'Digdir',
        concerned_years: [5, {}],
      }),
      {},
    );
  });

  test('caps how many values and how long each may be', () => {
    const many = Array.from({ length: 500 }, (_, i) => `v${i}`);
    assert.equal(facets.cleanFilter({ type: many }).type?.length, 100);
    assert.deepEqual(facets.cleanFilter({ type: ['x'.repeat(201), 'ok'] }), { type: ['ok'] });
  });

  test('anything that is not an object is no filter', () => {
    assert.deepEqual(facets.cleanFilter(null), {});
    assert.deepEqual(facets.cleanFilter(['type']), {});
    assert.deepEqual(facets.cleanFilter('type'), {});
  });
});
