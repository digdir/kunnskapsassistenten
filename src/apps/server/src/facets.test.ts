import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import type { FilterFieldSpec } from './datasetConfig.ts';

process.env.DIGDIR_API_KEY ??= 'test-key';

let facets: typeof import('./facets.ts');
before(async () => {
  facets = await import('./facets.ts');
});

const counts = (...pairs: Array<[string, number]>) =>
  pairs.map(([value, count]) => ({ value, count }));

const TYPE: FilterFieldSpec = { id: 'documentType', field: 'type', label: 'dokumenttyper' };
const ORGS: FilterFieldSpec = { id: 'organisation', field: 'orgs_long', label: 'virksomheter' };
const YEAR: FilterFieldSpec = {
  id: 'year',
  field: 'concerned_years',
  valueType: 'integer',
  label: 'år',
};
const FIELDS = [TYPE, ORGS, YEAR];

describe('shapeFacet', () => {
  test('carries the id, field, value type and label from the configuration', () => {
    const f = facets.shapeFacet(YEAR, counts(['2024', 1]));
    assert.deepEqual(
      { id: f.id, field: f.field, valueType: f.valueType, label: f.label },
      { id: 'year', field: 'concerned_years', valueType: 'integer', label: 'år' },
    );
    assert.equal('valueType' in facets.shapeFacet(TYPE, counts(['A', 1])), false);
  });

  test('orders ordinary fields by count, descending, and equal counts by name', () => {
    const f = facets.shapeFacet(TYPE, counts(['B', 2], ['A', 9], ['D', 5], ['C', 5]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['A', 'C', 'D', 'B'],
    );
  });

  test('orders years chronologically, newest first, not by count', () => {
    const f = facets.shapeFacet(YEAR, counts(['2020', 900], ['2024', 3], ['2022', 50]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2024', '2022', '2020'],
    );
  });

  test('drops year values that are page numbers or parse noise', () => {
    const f = facets.shapeFacet(
      YEAR,
      counts(['2436', 40], ['1989', 1], ['2036', 1], ['2024', 1], ['1990', 1], ['2035', 1]),
    );
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2035', '2024', '1990'],
    );
  });

  test('the year policy follows the id, not the field name', () => {
    const f = facets.shapeFacet({ ...TYPE, field: 'concerned_years' }, counts(['2436', 1]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2436'],
    );
  });

  test('drops the empty value Typesense reports for unset fields', () => {
    const f = facets.shapeFacet(TYPE, counts(['', 400], ['A', 1]));
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['A'],
    );
  });

  test('keeps every value: 457 organisations stay 457', () => {
    const many = Array.from({ length: 457 }, (_, i) => ({ value: `v${i}`, count: 500 - i }));
    assert.equal(facets.shapeFacet(ORGS, many).options.length, 457);
    assert.equal(facets.shapeFacet(TYPE, many).options.length, 457);
  });

  test('keeps nothing but value and count from Typesense', () => {
    const f = facets.shapeFacet(TYPE, [{ value: 'A', count: 1, highlighted: 'A' } as never]);
    assert.deepEqual(f.options, [{ value: 'A', count: 1 }]);
  });

  test('a field Typesense returned nothing for yields no options', () => {
    assert.deepEqual(facets.shapeFacet(TYPE, undefined).options, []);
  });
});

describe('toFilterBy', () => {
  test('shapes the selection the way the retrieval skill wants it', () => {
    assert.deepEqual(facets.toFilterBy({ type: ['Evaluering'] }, FIELDS), {
      fields: [{ field: 'type', 'selected-options': ['Evaluering'] }],
    });
  });

  test('sends value-type for a year, which finds nothing without it', () => {
    assert.deepEqual(facets.toFilterBy({ concerned_years: ['2024'] }, FIELDS), {
      fields: [
        { field: 'concerned_years', 'selected-options': ['2024'], 'value-type': 'integer' },
      ],
    });
  });

  test('drops fields with nothing selected', () => {
    assert.deepEqual(facets.toFilterBy({ type: ['A'], orgs_long: [] }, FIELDS), {
      fields: [{ field: 'type', 'selected-options': ['A'] }],
    });
  });

  test('ignores field names that are not configured', () => {
    assert.equal(facets.toFilterBy({ not_a_field: ['x'] }, FIELDS), undefined);
    assert.equal(facets.toFilterBy({ type: ['A'] }, []), undefined);
  });

  test('an empty or absent selection sends no filter at all', () => {
    assert.equal(facets.toFilterBy({}, FIELDS), undefined);
    assert.equal(facets.toFilterBy(undefined, FIELDS), undefined);
  });
});

describe('cleanFilter', () => {
  test('keeps configured fields as lists of strings, without repeats or blanks', () => {
    assert.deepEqual(
      facets.cleanFilter(
        { type: ['Evaluering', 'Evaluering', ' '], concerned_years: ['2023'] },
        [],
        FIELDS,
      ),
      { type: ['Evaluering'], concerned_years: ['2023'] },
    );
  });

  test('drops unknown fields, non-lists and non-strings', () => {
    assert.deepEqual(
      facets.cleanFilter(
        { junk: ['x'], type: null, orgs_long: 'Digdir', concerned_years: [5, {}] },
        [],
        FIELDS,
      ),
      {},
    );
  });

  test('every known value selected is the same as no filter on that field', () => {
    const shaped = [facets.shapeFacet(TYPE, counts(['A', 2], ['B', 1]))];
    assert.deepEqual(facets.cleanFilter({ type: ['B', 'A'] }, shaped, FIELDS), {});
    assert.deepEqual(facets.cleanFilter({ type: ['A'] }, shaped, FIELDS), { type: ['A'] });
  });

  test('all of 457 is not too many: it is no filter', () => {
    const many = Array.from({ length: 457 }, (_, i) => ({ value: `v${i}`, count: 1 }));
    const shaped = [facets.shapeFacet(ORGS, many)];
    assert.deepEqual(
      facets.cleanFilter({ orgs_long: many.map((o) => o.value) }, shaped, FIELDS),
      {},
    );
  });

  test('more than 100 values, not all, is refused and never cut', () => {
    const values = Array.from({ length: 150 }, (_, i) => `v${i}`);
    assert.throws(
      () => facets.cleanFilter({ orgs_long: values }, [], FIELDS),
      (err: unknown) =>
        err instanceof facets.FilterTooManyValues &&
        err.field === 'orgs_long' &&
        err.count === 150 &&
        err.message ===
          'Du har valgt 150 virksomheter. Velg høyst 100, eller alle, som er det samme som ingen avgrensning.',
    );
    assert.equal(
      facets.cleanFilter({ orgs_long: values.slice(0, 100) }, [], FIELDS).orgs_long?.length,
      100,
    );
  });

  test('drops values that are too long to be one', () => {
    assert.deepEqual(facets.cleanFilter({ type: ['x'.repeat(201), 'ok'] }, [], FIELDS), {
      type: ['ok'],
    });
  });

  test('anything that is not an object is no filter', () => {
    assert.deepEqual(facets.cleanFilter(null, [], FIELDS), {});
    assert.deepEqual(facets.cleanFilter(['type'], [], FIELDS), {});
    assert.deepEqual(facets.cleanFilter('type', [], FIELDS), {});
  });
});
