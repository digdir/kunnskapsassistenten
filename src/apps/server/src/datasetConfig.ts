/**
 * What this deployment knows about its dataset: the filter fields and the name.
 * Configuration, not code, so another corpus is an environment change.
 * The grammar is the client's `VITE_KA_FILTER_FIELDS` and `VITE_KA_DATASETS`.
 */
import type {
  Capabilities,
  CapabilitiesResponse,
  DatasetInfo,
  FilterFieldId,
} from '@ka/contract';

export interface FilterFieldSpec {
  id: FilterFieldId;
  field: string;
  valueType?: 'integer' | 'string';
  label: string;
}

const DEFAULT_LABELS: Record<FilterFieldId, string> = {
  documentType: 'dokumenttyper',
  organisation: 'virksomheter',
  year: 'år',
};

const IDS = new Set<string>(Object.keys(DEFAULT_LABELS));
const VALUE_TYPES = new Set(['integer', 'string']);

/** The part after `<key>=` in a `;`-separated list, or undefined. */
function entryFor(raw: string | undefined, key: string): string | undefined {
  for (const entry of (raw ?? '').split(';')) {
    const split = entry.indexOf('=');
    if (split !== -1 && entry.slice(0, split).trim() === key) return entry.slice(split + 1);
  }
  return undefined;
}

/**
 * `kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer`.
 * Inside one field `id:field[:valueType[:label]]`. A bad field is dropped with a
 * warning, and a missing type is not guessed: `year` without `integer` finds nothing.
 */
export function parseFilterFields(raw: string | undefined, dataset: string): FilterFieldSpec[] {
  const entry = entryFor(raw, dataset);
  if (!entry) return [];

  const specs: FilterFieldSpec[] = [];
  const dropped: string[] = [];
  for (const part of entry.split('|')) {
    if (!part.trim()) continue;
    const [id = '', field = '', valueType = '', label = ''] = part
      .split(':')
      .map((p) => p.trim());
    const known = IDS.has(id) && !specs.some((s) => s.id === id);
    if (!known || !field || (valueType && !VALUE_TYPES.has(valueType))) {
      dropped.push(part.trim());
      continue;
    }
    const fieldId = id as FilterFieldId;
    specs.push({
      id: fieldId,
      field,
      ...(valueType ? { valueType: valueType as 'integer' | 'string' } : {}),
      label: label || DEFAULT_LABELS[fieldId],
    });
  }
  if (dropped.length) {
    console.warn(
      `KA_FILTER_FIELDS: hopper over ${dropped.join(', ')}. ` +
        'Formatet er "datasett=id:felt[:verditype[:etikett]]|…", med id documentType, organisation eller year.',
    );
  }
  return specs;
}

/** `kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no`. The description is optional. */
export function parseDataset(
  raw: string | undefined,
  dataset: string,
): DatasetInfo | undefined {
  const entry = entryFor(raw, dataset);
  if (entry === undefined) return undefined;
  const pipe = entry.indexOf('|');
  const label = (pipe === -1 ? entry : entry.slice(0, pipe)).trim();
  const description = pipe === -1 ? '' : entry.slice(pipe + 1).trim();
  if (!label) return undefined;
  return { key: dataset, label, ...(description ? { description } : {}) };
}

/** `GET /api/capabilities`: what the backend can do, and which dataset this is. */
export function capabilitiesResponse(
  capabilities: Capabilities,
  settled: boolean,
  dataset: DatasetInfo | undefined,
): CapabilitiesResponse {
  return { capabilities, settled, ...(dataset ? { dataset } : {}) };
}
