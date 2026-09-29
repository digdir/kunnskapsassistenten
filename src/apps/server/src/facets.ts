import type { FacetField, FacetOption } from '@ka/contract';
import { config } from './config.ts';
import type { FilterFieldSpec } from './datasetConfig.ts';

export type { FacetField, FacetOption };

let cache: { at: number; key: string; data: FacetField[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** A Typesense that accepts and never answers must not hold up the panel. */
const TIMEOUT_MS = 5000;

const cacheKey = (fields: FilterFieldSpec[]) => fields.map((f) => f.field).join(',');

/**
 * Enough for every value of a field, so the policy and not a cut-off decides
 * what is shown. Kudos has 457 organisations, and `concerned_years` has 1006
 * distinct values of which 46 are years.
 */
export const MAX_FACET_VALUES = 2000;

/** Years outside this span are parse noise like 2436, not years. */
export const YEAR_SPAN = { from: 1990, to: 2035 } as const;

/** What the backend takes per field: 1 to 100 values. */
export const MAX_SELECTED_VALUES = 100;

/** What #15 takes per value: at most 256 characters, and none of these. */
const MAX_VALUE_LENGTH = 256;
const FORBIDDEN = /[`\\\u0000-\u001f\u007f]/;

export async function facets(
  fields: FilterFieldSpec[] = config.filterFields,
): Promise<FacetField[]> {
  if (!config.typesenseHost || !config.typesenseKey || !config.docsCollection) return [];
  if (!fields.length) return [];
  const key = cacheKey(fields);
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.data;

  const url = new URL(
    `https://${config.typesenseHost}/collections/${config.docsCollection}/documents/search`,
  );
  url.searchParams.set('q', '*');
  url.searchParams.set('query_by', 'title');
  url.searchParams.set('per_page', '0');
  url.searchParams.set('facet_by', fields.map((f) => f.field).join(','));
  url.searchParams.set('max_facet_values', String(MAX_FACET_VALUES));

  const res = await fetch(url, {
    headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`facets ${res.status}`);

  const body = (await res.json()) as {
    facet_counts?: Array<{ field_name: string; counts: FacetOption[] }>;
  };
  const byField = new Map((body.facet_counts ?? []).map((f) => [f.field_name, f.counts]));

  const data = fields
    .map((spec) => shapeFacet(spec, byField.get(spec.field)))
    .filter((f) => f.options.length > 0);

  cache = { at: Date.now(), key, data };
  return data;
}

/**
 * The facets already fetched, without waiting on Typesense. For `/api/ask`,
 * which must not wait to learn what «all» is.
 *
 * A cache past its ten minutes is still given, and a fresh one is fetched in
 * the background: which values a corpus has changes in days, and an expired
 * cache made «all selected» a 400 on the first question after a quiet ten
 * minutes (KA CC). A cold cache gives nothing and is warmed for the next one.
 */
export function cachedFacets(fields: FilterFieldSpec[] = config.filterFields): FacetField[] {
  if (!cache || cache.key !== cacheKey(fields)) {
    void facets(fields).catch(() => {});
    return [];
  }
  if (Date.now() - cache.at >= TTL_MS) void facets(fields).catch(() => {});
  return cache.data;
}

export type AskFilter =
  | { ok: true; filter: Record<string, string[]> }
  | { ok: false; body: FilterTooManyValuesBody | FilterInvalidValueBody };

interface FilterTooManyValuesBody {
  error: string;
  code: 'filter-too-many-values';
  field: string;
  max: number;
}

interface FilterInvalidValueBody {
  error: string;
  code: 'filter-invalid-value';
  field: string;
}

/**
 * The filter a question is asked with, or the 400 to answer instead.
 * Synchronous on purpose: it cannot wait on Typesense, only read the cache.
 */
export function askFilter(
  raw: unknown,
  fields: FilterFieldSpec[] = config.filterFields,
): AskFilter {
  try {
    return { ok: true, filter: cleanFilter(raw, cachedFacets(fields), fields) };
  } catch (err) {
    if (err instanceof FilterTooManyValues) {
      return {
        ok: false,
        body: {
          error: err.message,
          code: 'filter-too-many-values',
          field: err.field,
          max: MAX_SELECTED_VALUES,
        },
      };
    }
    if (err instanceof FilterInvalidValue) {
      return {
        ok: false,
        body: { error: err.message, code: 'filter-invalid-value', field: err.field },
      };
    }
    throw err;
  }
}

/** For tests: forget the cache. */
export function resetFacetCache(): void {
  cache = null;
}

/** No empty values; years only inside `YEAR_SPAN`, newest first; the rest by count. */
export function shapeFacet(
  spec: FilterFieldSpec,
  counts: FacetOption[] | undefined,
): FacetField {
  const years = spec.id === 'year';
  const options = (counts ?? [])
    .map(({ value, count }) => ({ value, count }))
    .filter((o) => {
      if (o.value.trim() === '') return false;
      if (!years) return true;
      const y = Number(o.value);
      return Number.isInteger(y) && y >= YEAR_SPAN.from && y <= YEAR_SPAN.to;
    })
    .sort((a, b) =>
      years
        ? Number(b.value) - Number(a.value)
        : b.count - a.count || a.value.localeCompare(b.value, 'nb'),
    );
  return {
    id: spec.id,
    field: spec.field,
    ...(spec.valueType ? { valueType: spec.valueType } : {}),
    label: spec.label,
    options,
  };
}

/** A value the backend refuses (#15). Answered as 400, never dropped. */
export class FilterInvalidValue extends Error {
  readonly field: string;

  constructor(field: string, label: string) {
    super(
      `Et av valgene i ${label} har tegn eller en lengde søket ikke tar imot. Fjern det og prøv igjen.`,
    );
    this.field = field;
  }
}

/** More values in one field than the backend takes. Answered as 400, never cut. */
export class FilterTooManyValues extends Error {
  readonly field: string;
  readonly count: number;

  constructor(field: string, label: string, count: number) {
    super(
      `Du har valgt ${count} ${label}. Velg høyst ${MAX_SELECTED_VALUES}, ` +
        'eller alle, som er det samme som ingen avgrensning.',
    );
    this.field = field;
    this.count = count;
  }
}

/**
 * Only configured fields, and only lists of strings. A field with every known
 * value selected is the same as no filter on it, and is left out. A value the
 * backend would refuse, and more than it takes, are a 400 and never dropped.
 */
export function cleanFilter(
  raw: unknown,
  known: FacetField[] = [],
  fields: FilterFieldSpec[] = config.filterFields,
): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const spec of fields) {
    const values = (raw as Record<string, unknown>)[spec.field];
    if (!Array.isArray(values)) continue;
    const kept = [
      ...new Set(values.filter((v): v is string => typeof v === 'string' && v.trim() !== '')),
    ];
    if (!kept.length) continue;
    if (kept.some((v) => v.length > MAX_VALUE_LENGTH || FORBIDDEN.test(v))) {
      throw new FilterInvalidValue(spec.field, spec.label);
    }

    const all = known.find((f) => f.field === spec.field)?.options.map((o) => o.value) ?? [];
    if (all.length && all.every((v) => kept.includes(v))) continue;

    if (kept.length > MAX_SELECTED_VALUES) {
      throw new FilterTooManyValues(spec.field, spec.label, kept.length);
    }
    out[spec.field] = kept;
  }
  return out;
}

export function toFilterBy(
  selected: Record<string, string[]> | undefined,
  fields: FilterFieldSpec[] = config.filterFields,
):
  | {
      fields: Array<{
        field: string;
        'selected-options': string[];
        'value-type'?: 'integer' | 'string';
      }>;
    }
  | undefined {
  if (!selected) return undefined;
  const out = fields.flatMap((spec) => {
    const values = selected[spec.field];
    if (!values?.length) return [];
    return [
      {
        field: spec.field,
        'selected-options': values,
        ...(spec.valueType ? { 'value-type': spec.valueType } : {}),
      },
    ];
  });
  return out.length ? { fields: out } : undefined;
}
