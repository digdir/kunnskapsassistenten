import { config } from './config.ts';

export interface FacetOption {
  value: string;
  count: number;
}

export interface FacetField {
  field: string;
  /** Norwegian noun; the client prefixes it with Velg or Valgt. */
  label: string;
  options: FacetOption[];
}

/** `orgs_short` is left out: it is empty in this corpus. */
const FIELDS: Array<{ field: string; label: string }> = [
  { field: 'type', label: 'dokumenttyper' },
  { field: 'orgs_long', label: 'virksomheter' },
  { field: 'concerned_years', label: 'år' },
];

let cache: { at: number; data: FacetField[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function facets(): Promise<FacetField[]> {
  if (!config.typesenseHost || !config.typesenseKey || !config.docsCollection) return [];
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const url = new URL(
    `https://${config.typesenseHost}/collections/${config.docsCollection}/documents/search`,
  );
  url.searchParams.set('q', '*');
  url.searchParams.set('query_by', 'title');
  url.searchParams.set('per_page', '0');
  url.searchParams.set('facet_by', FIELDS.map((f) => f.field).join(','));
  url.searchParams.set('max_facet_values', '200');

  const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey } });
  if (!res.ok) throw new Error(`facets ${res.status}`);

  const body = (await res.json()) as {
    facet_counts?: Array<{ field_name: string; counts: FacetOption[] }>;
  };
  const byField = new Map((body.facet_counts ?? []).map((f) => [f.field_name, f.counts]));

  const data = FIELDS.map(({ field, label }) =>
    shapeFacet(field, label, byField.get(field)),
  ).filter((f) => f.options.length > 0);

  cache = { at: Date.now(), data };
  return data;
}

const CAP: Record<string, number> = { orgs_long: 300 };

/** `concerned_years` holds parse noise like 2436. */
export function shapeFacet(
  field: string,
  label: string,
  counts: FacetOption[] | undefined,
): FacetField {
  const years = field === 'concerned_years';
  const options = (counts ?? [])
    .filter((o) => {
      if (o.value === '') return false;
      if (!years) return true;
      const y = Number(o.value);
      return Number.isInteger(y) && y >= 1990 && y <= 2035;
    })
    .sort((a, b) => (years ? Number(b.value) - Number(a.value) : b.count - a.count))
    .slice(0, CAP[field] ?? 60);
  return { field, label, options };
}

const MAX_VALUES = 100;
const MAX_VALUE_LENGTH = 200;

/** Only known fields, and only bounded lists of strings. */
export function cleanFilter(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const { field } of FIELDS) {
    const values = (raw as Record<string, unknown>)[field];
    if (!Array.isArray(values)) continue;
    const kept = values
      .filter((v): v is string => typeof v === 'string' && v.length <= MAX_VALUE_LENGTH)
      .slice(0, MAX_VALUES);
    if (kept.length) out[field] = kept;
  }
  return out;
}

export function toFilterBy(
  selected: Record<string, string[]> | undefined,
): { fields: Array<{ field: string; 'selected-options': string[] }> } | undefined {
  if (!selected) return undefined;
  const fields = Object.entries(selected)
    .filter(([field, values]) => FIELDS.some((f) => f.field === field) && values?.length)
    .map(([field, values]) => ({ field, 'selected-options': values }));
  return fields.length ? { fields } : undefined;
}
