import { describe, expect, it } from 'vitest';
import type { AssistantApi } from '@genai/ui-assembly';
import { boundYears, currentYear, withYearBounds } from './years';

const years = (...values: string[]) => ({
  id: 'concerned_years',
  label: 'År',
  kind: 'year' as const,
  options: values.map((value) => ({ value, count: 1 })),
});

describe('the year list', () => {
  it('keeps the years from 1990 to this year, newest first', () => {
    const field = boundYears(
      years('1950', '2019', '2026', '2027', '2252', '2950', '1990'),
      [],
      2026,
    );
    expect(field.options.map((o) => o.value)).toEqual(['2026', '2019', '1990']);
  });

  it('keeps a chosen year outside the bounds, so its chip can be removed', () => {
    const field = boundYears(years('2019', '2252'), ['2252'], 2026);
    expect(field.options.map((o) => o.value)).toEqual(['2252', '2019']);
  });

  it('drops values that are not years', () => {
    const field = boundYears(years('2019', '', '20x9', '201'), [], 2026);
    expect(field.options.map((o) => o.value)).toEqual(['2019']);
  });

  it('leaves other fields as they are', () => {
    const field = {
      id: 'type',
      label: 'Dokumenttyper',
      options: [{ value: 'Årsrapport', count: 3 }],
    };
    expect(boundYears(field, [], 2026)).toBe(field);
  });

  it('ends at the year it is in Oslo, not on the machine clock', () => {
    // 23:30 UTC on New Year's Eve is 00:30 on 1 January in Oslo.
    expect(currentYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027);
  });

  it('bounds what the genki client loads, with the selection the client was asked for', async () => {
    const api = {
      loadFacets: async () =>
        [years('2300', '2020', '1980'), years('2301')].map((f, i) => ({ ...f, id: `f${i}` })),
    } as unknown as AssistantApi;
    const found = await withYearBounds(api, () => 2026).loadFacets(
      { f1: ['2301'] },
      'kudos',
      [],
    );
    expect(found.map((f) => f.options.map((o) => o.value))).toEqual([['2020'], ['2301']]);
  });
});
