import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import type { FilterFieldSpec } from './datasetConfig.ts';

process.env.DIGDIR_API_KEY ??= 'test-key';
process.env.TYPESENSE_API_HOST = 'typesense.test';
process.env.TYPESENSE_API_KEY_ADMIN = 'test-typesense-key';
process.env.KUDOS_DOCS_COLLECTION = 'kudos_documents_test';

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
      counts(['2436', 40], ['1989', 1], ['2024', 1], ['1990', 1], ['0', 1]),
      2026,
    );
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2024', '1990'],
    );
  });

  test('ends at this year, not at the year a plan runs to', () => {
    const f = facets.shapeFacet(YEAR, counts(['2027', 88], ['2026', 40], ['2025', 900]), 2026);
    assert.deepEqual(
      f.options.map((o) => o.value),
      ['2026', '2025'],
    );
  });

  test('counts the year in Norway, not in UTC', () => {
    // The machine's zone is set to UTC for this test, as the container's is.
    // Left alone, a Mac in Norway would pass it with or without the fix.
    const zone = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      assert.equal(facets.currentYear(new Date('2026-12-31T23:30:00Z')), 2027);
      assert.equal(facets.currentYear(new Date('2026-12-31T22:30:00Z')), 2026);
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
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

  test('a value the backend refuses is a 400, never dropped', () => {
    for (const bad of ['x'.repeat(257), 'a`b', 'a\\b', 'a\nb', 'a\u0000b']) {
      assert.throws(
        () => facets.cleanFilter({ type: [bad, 'ok'] }, [], FIELDS),
        (err: unknown) => err instanceof facets.FilterInvalidValue && err.field === 'type',
        JSON.stringify(bad),
      );
    }
    assert.deepEqual(facets.cleanFilter({ type: ['x'.repeat(256)] }, [], FIELDS), {
      type: ['x'.repeat(256)],
    });
  });

  test('anything that is not an object is no filter', () => {
    assert.deepEqual(facets.cleanFilter(null, [], FIELDS), {});
    assert.deepEqual(facets.cleanFilter(['type'], [], FIELDS), {});
    assert.deepEqual(facets.cleanFilter('type', [], FIELDS), {});
  });
});

/**
 * A Typesense that behaves like the real one: it returns the most frequent
 * `max_facet_values` values per field and no more. The corpus is Kudos's
 * shape, measured 29.09 and 30.09: 8 types, 457 organisations, and 1006
 * distinct `concerned_years`, of which 46 are years from 1990 on — 9 of them
 * after this one, the years plans run to — and the years with the fewest
 * documents are rarer than much of the noise.
 *
 * The years are laid out from this year rather than from 2026, so the test
 * says the same thing next year.
 */
describe('facets, against a Typesense shaped like Kudos', () => {
  const types = Array.from({ length: 8 }, (_, i) => ({ value: `type${i}`, count: 3000 - i }));
  const orgs = Array.from({ length: 457 }, (_, i) => ({ value: `org${i}`, count: 900 - i }));
  const noise = Array.from({ length: 960 }, (_, i) => ({
    value: String(2100 + i),
    count: 20 + (i % 30),
  }));
  let byField: Record<string, Array<{ value: string; count: number }>> = {};
  let pastYears = 0;

  let asked: URL[] = [];
  const realFetch = globalThis.fetch;
  before(() => {
    const thisYear = facets.currentYear();
    pastYears = thisYear - 1990 + 1;
    const years = Array.from({ length: pastYears + 9 }, (_, i) => ({
      value: String(1990 + i),
      count: i < 10 ? 6 + i : 1000 + i,
    }));
    byField = { type: types, orgs_long: orgs, concerned_years: [...years, ...noise] };

    globalThis.fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      asked.push(url);
      const max = Number(url.searchParams.get('max_facet_values') ?? 10);
      const fields = (url.searchParams.get('facet_by') ?? '').split(',');
      const facet_counts = fields.map((field) => ({
        field_name: field,
        counts: [...(byField[field] ?? [])].sort((a, b) => b.count - a.count).slice(0, max),
      }));
      return new Response(JSON.stringify({ facet_counts }), { status: 200 });
    }) as typeof fetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
  });
  beforeEach(() => {
    asked = [];
    facets.resetFacetCache();
  });

  test('asks for at least as many values as the year field has, 1006', async () => {
    await facets.facets(FIELDS);
    assert.ok(Number(asked[0]?.searchParams.get('max_facet_values')) >= 1006);
  });

  test('gives every organisation and every year up to this one: 8, 457 and 37 in 2026', async () => {
    const found = await facets.facets(FIELDS);
    assert.deepEqual(
      found.map((f) => [f.id, f.options.length]),
      [
        ['documentType', 8],
        ['organisation', 457],
        ['year', pastYears],
      ],
    );
    assert.equal(found[2]?.options[0]?.value, String(facets.currentYear()));
    assert.deepEqual(found[2]?.options.at(-1), { value: '1990', count: 6 });
  });

  test('the cache belongs to the fields it was fetched for', async () => {
    await facets.facets(FIELDS);
    const types = await facets.facets([TYPE]);
    assert.equal(asked.length, 2);
    assert.deepEqual(
      types.map((f) => f.id),
      ['documentType'],
    );
    await facets.facets([TYPE]);
    assert.equal(asked.length, 2);
  });

  test('cachedFacets never waits: cold, it gives nothing and warms the cache', async () => {
    const cold = facets.cachedFacets(FIELDS);
    assert.deepEqual(cold, []);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(asked.length, 1, 'the cold cache is warmed in the background');
    assert.equal(facets.cachedFacets(FIELDS).length, 3);
    assert.deepEqual(facets.cachedFacets([TYPE]), []);
  });

  test('an expired cache is still given, and a fresh one fetched behind it', async (t) => {
    await facets.facets(FIELDS);
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 11 * 60 * 1000);
    assert.equal(facets.cachedFacets(FIELDS).length, 3);
    assert.equal(asked.length, 2);
  });

  test('«all» of 457 is still no filter once the cache is ten minutes old', async (t) => {
    await facets.facets(FIELDS);
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 11 * 60 * 1000);
    const all = orgs.map((o) => o.value);
    assert.deepEqual(facets.askFilter({ orgs_long: all }, FIELDS), { ok: true, filter: {} });
  });

  test('askFilter answers at once, without waiting on Typesense', () => {
    const answer = facets.askFilter({ type: ['type1'] }, FIELDS);
    assert.equal(typeof (answer as { then?: unknown }).then, 'undefined');
    assert.deepEqual(answer, { ok: true, filter: { type: ['type1'] } });
  });

  test('askFilter gives the 400 body for too many values and for a refused value', () => {
    const many = orgs.slice(0, 150).map((o) => o.value);
    assert.deepEqual(facets.askFilter({ orgs_long: many }, FIELDS), {
      ok: false,
      body: {
        error:
          'Du har valgt 150 virksomheter. Velg høyst 100, eller alle, som er det samme som ingen avgrensning.',
        code: 'filter-too-many-values',
        field: 'orgs_long',
        max: 100,
      },
    });
    const refused = facets.askFilter({ type: ['a`b'] }, FIELDS);
    assert.equal(refused.ok, false);
    assert.equal(!refused.ok && refused.body.code, 'filter-invalid-value');
  });

  test('ten questions right after expiry share one fetch', async (t) => {
    await facets.facets(FIELDS);
    const now = Date.now();
    t.mock.method(Date, 'now', () => now + 11 * 60 * 1000);
    for (let i = 0; i < 10; i += 1) facets.cachedFacets(FIELDS);
    await Promise.all(Array.from({ length: 5 }, () => facets.facets(FIELDS)));
    assert.equal(asked.length, 2);
  });

  test('gives up on a Typesense that does not answer, with a timeout on the call', async () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      throw new Error('unreachable');
    }) as typeof fetch;
    await assert.rejects(facets.facets(FIELDS));
    assert.ok(signal, 'the call carries an abort signal');
  });
});
