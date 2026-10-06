import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Facet, FacetOption } from '../shared/facets.ts';
import {
  filterDimensions,
  parseFilterFields,
  type FilterDimension,
  type FilterFieldConfig,
} from '../shared/filterFields.ts';
import { currentYear } from '../shared/years.ts';

/**
 * The filter panel's facets, counted by this server from Typesense.
 *
 * A bridge, and meant as one (src/decisions/0004, «Next steps», item 3).
 * The backend has no facet API over HTTP, so in live the panel had nothing to
 * draw — not even a filter the reader had already set, which then could be
 * neither seen nor removed. This route answers in the generic format
 * (shared/facets.ts), the same as the BFF in digdir/kunnskapsassistenten, and
 * the day the backend can count facets, the source changes behind it and the
 * client does not.
 *
 * Answered here and never forwarded: it is the one path under `/api/` that
 * is this server's own (app.ts).
 *
 * The counts are the whole corpus's, whatever the reader has ticked. So no
 * value from the browser is ever put into a Typesense filter; the only thing
 * read from the request is which dataset, and that is looked up among the
 * configured ones and used as nothing else. The client leaves the counts out
 * once another dimension is narrowed (`facetsFrom`), as it does for the BFF.
 */

export const FACETS_PATH = '/api/facets';

export type FacetConfig = {
  /** Typesense, as a base URL with scheme and port and no trailing slash. */
  typesenseUrl: string | undefined;
  /**
   * The key. Search is all this route does, so a search-only key scoped to
   * the collections is enough, and is what a deployment should be given.
   * Never leaves this server.
   */
  typesenseKey: string | undefined;
  /** Dataset key → the Typesense collection its documents are in. */
  collections: ReadonlyMap<string, string>;
  /** Dataset key → field per dimension: the same `VITE_KA_FILTER_FIELDS` the client reads. */
  fields: FilterFieldConfig;
  /** How long one dataset's facets are kept before Typesense is asked again. */
  ttlMs: number;
};

/** Blank is missing, as in config.ts. */
function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * `"kudos-full=KUDOS_preprod_v4_docs;kudos-pilot=kudos_pilot_docs"`
 *
 * The grammar of `VITE_KA_DATASETS` and `VITE_KA_FILTER_FIELDS`: semicolons
 * between datasets, the first `=` after the key. A bad or repeated entry is
 * dropped with one warning, and the first of a repeat wins, for the reasons
 * shared/filterFields.ts gives.
 */
export function parseCollections(
  raw: string | undefined,
  variable = 'KA_FACET_COLLECTIONS',
): Map<string, string> {
  const collections = new Map<string, string>();
  const dropped: string[] = [];

  for (const entry of (raw ?? '').split(';')) {
    if (!entry.trim()) continue;
    const split = entry.indexOf('=');
    const key = split === -1 ? '' : entry.slice(0, split).trim();
    const collection = split === -1 ? '' : entry.slice(split + 1).trim();
    if (!key || !collection || collections.has(key)) {
      dropped.push(entry.trim());
      continue;
    }
    collections.set(key, collection);
  }

  if (dropped.length > 0) {
    console.warn(
      `[ka] hopper over ${dropped.length} ugyldig(e) eller gjentatt(e) oppføring(er) i ` +
        `${variable}. Formatet er "datasett=samling;…". Hoppet over: ${dropped.join(', ')}`,
    );
  }
  return collections;
}

/**
 * The facet settings from the environment.
 *
 * Its own function and not a part of `readConfig`, because the Vite dev
 * server needs the same route (vite.config.ts) and has no other use for the
 * server's config.
 */
export function facetConfigFrom(env: NodeJS.ProcessEnv): FacetConfig {
  return {
    typesenseUrl: value(env.TYPESENSE_URL)?.replace(/\/+$/, ''),
    typesenseKey: value(env.TYPESENSE_API_KEY),
    collections: parseCollections(env.KA_FACET_COLLECTIONS),
    fields: parseFilterFields(value(env.VITE_KA_FILTER_FIELDS)),
    // Ten minutes, as the BFF keeps its. A corpus is re-indexed in days, and
    // the panel asks again on every tick, which must not be a call to
    // Typesense each time.
    ttlMs: 10 * 60 * 1000,
  };
}

/** Norwegian nouns in lower case; `facetsFrom` capitalises them. */
const LABELS: Record<FilterDimension, string> = {
  documentType: 'dokumenttyper',
  organisation: 'virksomheter',
  year: 'år',
};

/**
 * The first year a year facet keeps. Kudos's `concerned_years` holds parse
 * noise like «2436» (src/decisions/0004), and has more than 500 distinct
 * values where a real span has a few dozen.
 */
export const FIRST_YEAR = 1990;

/**
 * Values per field Typesense returns, the most frequent first.
 *
 * High enough for the whole field, so that the policy and not the cut-off
 * decides what is kept. Measured against Kudos 28.09: `concerned_years` has
 * 1006 distinct values, most of them noise, and with 500 the least frequent
 * value returned had 19 documents — a real year with fewer would have been
 * dropped before `shapeOptions` ever saw it. Kudos has 457 organisations.
 */
export const MAX_FACET_VALUES = 2000;

/** Long enough for a slow Typesense, short enough that the panel does not hang. */
const TIMEOUT_MS = 10_000;

/**
 * The minimal policy: no empty values; a year only if it is a whole number
 * from `FIRST_YEAR` up to this year, newest first; everything else by count,
 * most first, and then alphabetically so equal counts keep one order.
 *
 * «This year» was a fixed 2035, the span src/decisions/0004 named, and the filter offered
 * 2027–2035. It is read on every load now, so it moves on New Year without a
 * deploy. See shared/years.ts.
 */
export function shapeOptions(
  dimension: FilterDimension,
  counts: FacetOption[],
  thisYear = currentYear(),
): FacetOption[] {
  const kept = counts.filter((option) => option.value.trim() !== '');

  if (dimension === 'year') {
    return kept
      .filter((option) => {
        const year = Number(option.value);
        return Number.isInteger(year) && year >= FIRST_YEAR && year <= thisYear;
      })
      .sort((a, b) => Number(b.value) - Number(a.value));
  }

  return kept.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'nb'));
}

type TypesenseFacets = {
  facet_counts?: { field_name?: string; counts?: { value?: unknown; count?: unknown }[] }[];
};

/** Typesense's facet counts, cleaned to `{ value, count }` and nothing else. */
function countsByField(body: TypesenseFacets): Map<string, FacetOption[]> {
  const byField = new Map<string, FacetOption[]>();
  for (const facet of body.facet_counts ?? []) {
    if (typeof facet.field_name !== 'string') continue;
    const options = (facet.counts ?? []).flatMap((count) =>
      typeof count.value === 'string' && typeof count.count === 'number'
        ? [{ value: count.value, count: count.count }]
        : [],
    );
    byField.set(facet.field_name, options);
  }
  return byField;
}

/**
 * Whether there is anything to ask Typesense for this dataset. Checked before
 * the cache as well as in `loadFacets`, so a key nobody configured never
 * becomes an entry that stays (KA CC on #173).
 */
function isConfigured(config: FacetConfig, dataset: string): boolean {
  return Boolean(
    config.typesenseUrl &&
    config.typesenseKey &&
    config.collections.has(dataset) &&
    Object.hasOwn(config.fields, dataset),
  );
}

/**
 * One dataset's facets from Typesense, or none when it is not configured.
 *
 * `Object.hasOwn` and a `Map`, not `fields[dataset]`: the key comes from the
 * browser, and `fields['constructor']` on a plain object is a function.
 */
async function loadFacets(config: FacetConfig, dataset: string): Promise<Facet[]> {
  const collection = config.collections.get(dataset);
  const fields = Object.hasOwn(config.fields, dataset) ? config.fields[dataset] : undefined;
  if (!isConfigured(config, dataset) || !collection || !fields) return [];

  const wanted = filterDimensions.flatMap((dimension) => {
    const mapping = fields[dimension];
    return mapping ? [{ dimension, field: mapping.field }] : [];
  });
  const url = new URL(
    `${config.typesenseUrl}/collections/${encodeURIComponent(collection)}/documents/search`,
  );
  // `q=*` needs no `query_by`, measured against Kudos 28.09, so nothing here
  // has to know a text field of the corpus.
  url.searchParams.set('q', '*');
  url.searchParams.set('per_page', '0');
  url.searchParams.set('facet_by', wanted.map(({ field }) => field).join(','));
  url.searchParams.set('max_facet_values', String(MAX_FACET_VALUES));

  const response = await fetch(url, {
    headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // The status and nothing of the body: an error body is Typesense's, and it
  // is not ours to pass on or to log.
  if (!response.ok) throw new Error(`Typesense svarte ${response.status}`);

  const byField = countsByField((await response.json()) as TypesenseFacets);
  return wanted.flatMap(({ dimension, field }) => {
    const counts = byField.get(field) ?? [];
    // As many as asked for means some may be missing: the field has grown
    // past the limit, and the least frequent values are the ones cut.
    if (counts.length >= MAX_FACET_VALUES) {
      console.warn(
        '[ka] Typesense ga %d verdier for %s i %s, like mange som grensen. Noen kan mangle; se MAX_FACET_VALUES i server/facets.ts.',
        counts.length,
        field,
        JSON.stringify(dataset),
      );
    }
    const options = shapeOptions(dimension, counts);
    // A field with nothing in it is not a filter anybody can use.
    return options.length > 0 ? [{ field, label: LABELS[dimension], options }] : [];
  });
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

/**
 * The route, with its own cache.
 *
 * A factory and not a module-level cache, so every test, and the dev server,
 * starts empty. A pending load is cached as much as a finished one: the
 * panel's two requests on a load that restored a filter then share one call
 * to Typesense. A failed one is forgotten, so the next request tries again.
 */
export function facetRoute(config: FacetConfig) {
  const cache = new Map<string, { at: number; facets: Promise<Facet[]> }>();

  function facetsFor(dataset: string): Promise<Facet[]> {
    if (!isConfigured(config, dataset)) return Promise.resolve([]);

    const hit = cache.get(dataset);
    if (hit && Date.now() - hit.at < config.ttlMs) return hit.facets;

    const facets = loadFacets(config, dataset);
    cache.set(dataset, { at: Date.now(), facets });
    facets.catch(() => {
      if (cache.get(dataset)?.facets === facets) cache.delete(dataset);
    });
    return facets;
  }

  return async function facets(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      json(response, 405, { error: 'Bare GET.' });
      return;
    }

    const dataset =
      new URL(request.url ?? '', 'http://localhost').searchParams.get('dataset') ?? '';
    try {
      json(response, 200, { facets: await facetsFor(dataset) });
    } catch (error) {
      // Only a configured dataset gets this far, so the name in the line is
      // one of ours and not whatever the browser sent. Quoted all the same, so
      // a line break in it cannot start a log line of its own.
      console.error('[ka] fasettene for %s feilet: %s', JSON.stringify(dataset), String(error));
      json(response, 502, { error: 'Fikk ikke hentet filtrene.' });
    }
  };
}
