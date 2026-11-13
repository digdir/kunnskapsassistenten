// What a service can back, read from its published row in `/v1/models`, so the builder offers
// only the blocks whose needs are met (kits D10). A block whose needs are not met is shown off and
// disabled, with the reason.
import { blockSpec, type BlockId, type Need } from './catalogue.js';

/** The fields of a `/v1/models` row the facts are read from. */
export interface ModelRow {
  id: string;
  title?: string | undefined;
  description?: string | undefined;
  _service?: string | undefined;
  _service_title?: string | undefined;
  _variant_title?: string | undefined;
  _pickable?: boolean | undefined;
  _alias_of?: string | null | undefined;
  _chat?: boolean | undefined;
  _documents?: unknown;
  _datasets?:
    | readonly {
        id?: string | undefined;
        tenant?: string | undefined;
        'dataset-config-key'?: string | undefined;
        filters?:
          | readonly { field: string; kinds?: readonly string[]; 'value-type'?: string }[]
          | undefined;
      }[]
    | null
    | undefined;
}

export type Channel = 'conversations' | 'facets' | 'feedback';

export interface ServiceDataset {
  tenant: string;
  key: string;
  /** The fields a reader can narrow by: the dataset's multiselect fields. */
  filterFields: readonly string[];
}

export interface ServiceFacts {
  service: string;
  title: string;
  /** The service answers in a chat (`_chat`). */
  chat: boolean;
  datasets: readonly ServiceDataset[];
  /** The service takes attached documents (`_documents`). */
  documents: boolean;
  /** The model ids the reader may pick between: the `_pickable` rows of the same `_service`. */
  variants: readonly string[];
  /**
   * Whether the way of working reports steps. Not in the row: `undefined` when nobody knows, and
   * then Fremgangsmåte is offered and shows only when an answer brings steps.
   */
  steps?: boolean | undefined;
  /** The channels the client is given. */
  channels: readonly Channel[];
}

export const serviceOf = (row: ModelRow) => row._service ?? row.id.split('__')[0] ?? row.id;

/** The services in the rows, each once, with their rows, in the order they first come. */
export const servicesIn = (rows: readonly ModelRow[]) => {
  const found = new Map<string, { service: string; title: string; rows: ModelRow[] }>();
  for (const row of rows) {
    if (row._alias_of) continue;
    const service = serviceOf(row);
    const entry = found.get(service) ?? {
      service,
      title: row._service_title ?? row.title ?? service,
      rows: [],
    };
    entry.rows.push(row);
    found.set(service, entry);
  }
  return [...found.values()];
};

export const factsFromModels = (
  rows: readonly ModelRow[],
  service: string,
  given: {
    channels: readonly Channel[];
    steps?: boolean | undefined;
    /**
     * The services whose pickable variants the reader may switch between, when the host offers
     * more than the service's own, as kunnskapsassistenten's picker offers its family of services.
     */
    family?: ((service: string) => boolean) | undefined;
  },
): ServiceFacts | undefined => {
  const own = rows.filter((row) => !row._alias_of && serviceOf(row) === service);
  const first = own[0];
  if (!first) return undefined;
  const datasets = (first._datasets ?? []).flatMap((dataset) => {
    const key = dataset['dataset-config-key'] ?? dataset.id;
    if (!key) return [];
    return [
      {
        tenant: dataset.tenant ?? '',
        key,
        filterFields: (dataset.filters ?? [])
          .filter((field) => field.kinds?.includes('multiselect'))
          .map((field) => field.field),
      },
    ];
  });
  return {
    service,
    title: first._service_title ?? first.title ?? service,
    chat: own.some((row) => row._chat === true),
    datasets,
    documents: own.some((row) => row._documents != null),
    variants: given.family
      ? rows
          .filter((row) => !row._alias_of && row._pickable && given.family?.(serviceOf(row)))
          .map((row) => row.id)
      : own.filter((row) => row._pickable).map((row) => row.id),
    ...(given.steps === undefined ? {} : { steps: given.steps }),
    channels: given.channels,
  };
};

/** Whether the facts meet one need. `component:*` is about the layout, not the service: met here. */
export const needMet = (facts: ServiceFacts, need: Need): boolean => {
  switch (need) {
    case 'service:chat':
      return facts.chat;
    case 'service:datasets|documents':
      return facts.datasets.length > 0 || facts.documents;
    case 'service:documents':
      return facts.documents;
    case 'service:filter-fields':
      return facts.datasets.some((dataset) => dataset.filterFields.length > 0);
    case 'service:steps':
      return facts.steps !== false;
    case 'service:variants':
      return facts.variants.length > 1;
    case 'channel:conversations':
      return facts.channels.includes('conversations');
    case 'channel:facets':
      return facts.channels.includes('facets');
    case 'channel:feedback':
      return facts.channels.includes('feedback');
    case 'component:sources|document-view':
      return true;
    case 'genki:projects':
      return false;
  }
};

export interface BlockOffer {
  /** The builder may turn it on. */
  offered: boolean;
  /** Not built yet: «kommer». */
  planned: boolean;
  /** The needs the service does not meet, for the reason shown beside it. */
  unmet: Need[];
}

/** Whether the builder offers a block for this service, and why not. */
export const offerOf = (id: BlockId, facts: ServiceFacts | undefined): BlockOffer => {
  const spec = blockSpec(id);
  const unmet = facts ? spec.needs.filter((need) => !needMet(facts, need)) : [];
  const planned = spec.status === 'planned';
  return { offered: !planned && unmet.length === 0, planned, unmet };
};

/** The same for one of a block's options. */
export const optionOfferOf = (
  id: BlockId,
  option: string,
  facts: ServiceFacts | undefined,
): BlockOffer => {
  const spec = blockSpec(id).options.find((o) => o.id === option);
  const unmet = facts && spec ? (spec.needs ?? []).filter((need) => !needMet(facts, need)) : [];
  const planned = spec?.status === 'planned';
  return { offered: !!spec && !planned && unmet.length === 0, planned, unmet };
};
