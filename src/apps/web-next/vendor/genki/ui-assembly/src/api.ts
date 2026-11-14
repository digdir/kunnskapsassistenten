// What the assembly asks genki for, lifted from the UI blocks preview's api.ts. One interface, so
// the wiring can be tested with a fake and run against genki through a host's proxy, or with the
// person's own token from the host: a service key is never in the page.
import { ApiError, createClient, type FilterSet, type StreamEvent } from '@genai/client';
import type {
  AnswerFailure,
  AnswerMarker,
  AnswerStatus,
  CorpusOption,
  FilterField,
  FilterSelection,
  ModelRow,
  SourceDocument,
  ThreadItem,
} from '@genai/ui-blocks';
import { documentLink } from './links.js';
import type { AssistantProfile, CorpusProfile, FieldSpec } from './profile.js';
import type { StepFrame } from './procedure.js';

export interface AnswerData {
  text: string;
  status: AnswerStatus;
  sources?: SourceDocument[] | undefined;
  markers?: AnswerMarker[] | undefined;
  noAnswer?: boolean | undefined;
  created: number;
  error?: string | undefined;
  /** Why it failed, for the answer block's heading and advice. */
  failure?: AnswerFailure | undefined;
  /** genki's id for the run that gave the answer (`genai-task`), which feedback is sent on. */
  runId?: string | undefined;
}

export interface Turn {
  id: string;
  question: string;
  askedAt: number;
  answer?: AnswerData | undefined;
  /** The step frames of a question asked here, for «Fremgangsmåte». */
  approach?:
    { frames: StepFrame[]; startedAt: number; finishedAt?: number | undefined } | undefined;
  /**
   * What the question was narrowed to, and the collection asked, if any: genki keeps no filter with
   * a turn.
   */
  scope?:
    | {
        narrowedTo: readonly string[];
        corpus?: string | undefined;
        /** The filter it was asked with, as the question narrowed it (the next look). */
        selection?: FilterSelection | undefined;
        /** How many documents that filter read from, counted from the facets. */
        documents?: number | undefined;
      }
    | undefined;
}

/** A thread in the list, with the service it was made for. */
export type ThreadRow = ThreadItem & { service?: string | undefined };

export interface AskParams {
  question: string;
  /** The model id: the service and its variant, `kunnskapsassistenten__default`. */
  model: string;
  conversationId?: string | undefined;
  filters?: FilterSet | undefined;
  /** The collection asked. Without it, a service that answers in a chat of its own. */
  dataset?: { tenant: string; key: string } | undefined;
  /** Ask for the step frames, for «Fremgangsmåte». */
  steps: boolean;
  signal: AbortSignal;
}

export interface AssistantApi {
  loadModels(): Promise<ModelRow[]>;
  loadThreads(): Promise<ThreadRow[]>;
  loadThread(id: string): Promise<{ title: string; turns: Turn[]; corpus?: string | undefined }>;
  loadCorpora(): Promise<CorpusOption[]>;
  /** The collection's filter fields, in the profile's words where it has them. */
  loadFields(dataset: string): Promise<readonly FieldSpec[]>;
  loadFacets(
    selection: FilterSelection,
    dataset: string,
    fields: readonly FieldSpec[],
    /** The values each field has, for a field with more chosen than genki takes. */
    lists?: readonly FilterField[],
  ): Promise<FilterField[]>;
  /** The line under a document's title in «Dokumenter», where the profile says how to find it. */
  loadAbout(dataset: string, documentId: string): Promise<readonly string[] | undefined>;
  /** Makes the thread first when there is none, then asks into it, as kunnskapsassistenten does. */
  ask(params: AskParams): AsyncGenerator<StreamEvent, void>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** What a failed question's status establishes, in the answer block's words. */
export const failureOf = (error: unknown): AnswerFailure => {
  const status = error instanceof ApiError || error instanceof HttpError ? error.status : undefined;
  switch (status) {
    case 401:
    case 403:
      return { kind: 'access' };
    case 404:
      return /conversation/i.test(error instanceof Error ? error.message : '')
        ? { kind: 'threadGone' }
        : { kind: 'model' };
    case 408:
    case 504:
      return { kind: 'timeout' };
    case 413:
      return { kind: 'tooLong' };
    case 429:
      return { kind: 'busy' };
    default:
      return { kind: 'unknown' };
  }
};

/** The longest facets address sent: Node answers 431 past 16 KB of headers, token included. */
export const FACETS_URL_LIMIT = 8_000;

/** The most values genki's filter takes in a field (`maxOptions` in adapter-rest). */
export const FILTER_VALUES_LIMIT = 100;

/** A field with more values chosen, and more left out, than genki's filter takes. */
export class FilterTooLarge extends Error {
  constructor(readonly field: string) {
    super(`filter field ${field} has too many values chosen and left out to send`);
  }
}

/** The fields asked with, in genki's shape; past the limit, the values `lists` has left out. */
export const filterSet = (
  selection: FilterSelection,
  fields: readonly FieldSpec[],
  lists?: readonly FilterField[],
): FilterSet | undefined => {
  const chosen = fields.flatMap((f) => {
    const values = selection[f.id] ?? [];
    if (values.length === 0) return [];
    const ticked = new Set(values);
    const leftOut = lists
      ?.find((list) => list.id === f.id)
      ?.options.map((option) => option.value)
      .filter((value) => !ticked.has(value));
    const asLeftOut = values.length > FILTER_VALUES_LIMIT;
    if (asLeftOut && (!leftOut || leftOut.length > FILTER_VALUES_LIMIT))
      throw new FilterTooLarge(f.id);
    // Every value it has is chosen: it narrows nothing.
    if (asLeftOut && leftOut?.length === 0) return [];
    const sent = asLeftOut && leftOut ? leftOut : values;
    return [
      {
        field: f.id,
        type: asLeftOut ? ('not-in-set' as const) : ('multiselect' as const),
        'value-type': f.integer ? ('integer' as const) : ('string' as const),
        'selected-options': f.integer ? sent.map(Number) : [...sent],
      },
    ];
  });
  return chosen.length > 0 ? { fields: chosen } : undefined;
};

// ── Stored threads ──

interface ApiConversation {
  id: string;
  topic: string | null;
  serviceId?: string;
  tags: string[];
  created: number;
}

interface WireSource {
  index?: number;
  title?: string;
  url?: string;
  document_id?: string;
  documentId?: string;
  excerpts?: {
    chunk_id?: string;
    chunkId?: string;
    text?: string;
    position?: number;
    /** Its own section path, which the Sources block titles the excerpt by. */
    heading?: string;
    /** The markers that cite this excerpt, from a service that cites excerpts. */
    markers?: string[];
  }[];
  version?: string;
  publishedAt?: string;
}

interface ApiChunk {
  chunkId: string;
  docTitle: string;
  docNum: string | null;
  contentMarkdown: string;
}

interface ApiMessage {
  id: string;
  role: 'user' | 'assistant' | null;
  text: string;
  created: number;
  chunks: ApiChunk[];
  sources?: WireSource[];
  /** The answer's markers, `{ marker, chunk_id, document }`, when the stored turn carries them. */
  markers?: unknown;
  /** The assistant message's run, the id feedback is sent on. */
  task?: string;
}

/** The collection a thread was made in, from its `corpus:` tag. */
const corpusOf = (tags: readonly string[]) =>
  tags.find((tag) => tag.startsWith('corpus:'))?.slice('corpus:'.length) || undefined;

/**
 * One source as the blocks take it. A title it lacks stays empty, for the blocks to name in the
 * reader's language. An excerpt without an id gets one of its own, the same on every read, since
 * the blocks key, scroll to and number excerpts by it (V2-0010: «an id can be minted per
 * conversation»). `at` is the source's place in the answer's list, which keeps two sources without
 * a document id apart.
 */
export const sourceFromWire = (raw: WireSource, corpus?: CorpusProfile, at = 0): SourceDocument => {
  const documentId = raw.documentId ?? raw.document_id;
  const url = raw.url ?? (documentId ? documentLink(corpus, documentId) : undefined);
  const minted = (excerpt: number) => `minted:${documentId ?? `source-${at}`}:${excerpt}`;
  return {
    ...(raw.index !== undefined ? { index: raw.index } : {}),
    title: raw.title?.trim() ?? '',
    ...(url ? { url } : {}),
    ...(documentId ? { documentId } : {}),
    ...(raw.version ? { version: raw.version } : {}),
    ...(raw.publishedAt ? { publishedAt: raw.publishedAt } : {}),
    excerpts: (raw.excerpts ?? []).map((e, i) => {
      const text = e.text ?? '';
      const heading: unknown = e.heading;
      return {
        chunkId: e.chunkId || e.chunk_id || minted(i),
        text,
        ...(e.position !== undefined ? { position: e.position } : {}),
        ...(typeof heading === 'string' ? { heading } : {}),
        ...(text ? {} : { textUnavailable: true }),
      };
    }),
  };
};

// A stored answer without `sources` or markers cites by document: `[n]` is its n-th document.
const fromChunks = (chunks: readonly ApiChunk[], corpus?: CorpusProfile): SourceDocument[] => {
  const documents = new Map<
    string,
    SourceDocument & { excerpts: SourceDocument['excerpts'][number][] }
  >();
  chunks.forEach((chunk, i) => {
    const documentId = chunk.docNum ?? chunk.chunkId;
    let document = documents.get(documentId);
    if (!document) {
      const url = chunk.docNum ? documentLink(corpus, chunk.docNum) : undefined;
      document = {
        index: documents.size + 1,
        title: chunk.docTitle?.trim() ?? '',
        documentId,
        ...(url ? { url } : {}),
        excerpts: [],
      };
      documents.set(documentId, document);
    }
    document.excerpts.push({ chunkId: chunk.chunkId, text: chunk.contentMarkdown, position: i });
  });
  return [...documents.values()];
};

// The turn's own list; a marker that does not name its excerpt and document is left out.
const storedMarkers = (raw: unknown): AnswerMarker[] | undefined => {
  const found = (Array.isArray(raw) ? (raw as unknown[]) : []).flatMap((m) => {
    if (typeof m !== 'object' || m === null) return [];
    const { marker, chunk_id: chunkId, document: documentId } = m as Record<string, unknown>;
    return typeof marker === 'string' &&
      typeof chunkId === 'string' &&
      typeof documentId === 'string'
      ? [{ marker, chunkId, documentId }]
      : [];
  });
  return found.length > 0 ? found : undefined;
};

// A turn stored with markers only on its excerpts: each leads to the excerpt as drawn.
const markersFromSources = (
  wire: readonly WireSource[],
  drawn: readonly SourceDocument[],
): AnswerMarker[] | undefined => {
  const found = wire.flatMap((source, s) =>
    (source.excerpts ?? []).flatMap((excerpt, e) => {
      const shown = drawn[s]?.excerpts[e];
      const markers: unknown = excerpt.markers;
      if (!shown || !Array.isArray(markers)) return [];
      const documentId = drawn[s]?.documentId;
      return markers
        .filter((marker): marker is string => typeof marker === 'string')
        .map((marker) => ({
          marker,
          chunkId: shown.chunkId,
          ...(documentId ? { documentId } : {}),
        }));
    }),
  );
  return found.length > 0 ? found : undefined;
};

const answerFromMessage = (message: ApiMessage, corpus?: CorpusProfile): AnswerData => {
  const keptMarkers = storedMarkers(message.markers);
  const stored = {
    text: message.text,
    status: 'complete' as const,
    created: message.created,
    ...(message.task ? { runId: message.task } : {}),
  };
  if (message.sources && message.sources.length > 0) {
    const sources = message.sources.map((s, at) => sourceFromWire(s, corpus, at));
    const markers = keptMarkers ?? markersFromSources(message.sources, sources);
    return { ...stored, sources, ...(markers ? { markers } : {}) };
  }
  if (message.chunks.length > 0) {
    const sources = fromChunks(message.chunks, corpus);
    return { ...stored, sources, ...(keptMarkers ? { markers: keptMarkers } : {}) };
  }
  return stored;
};

/**
 * The latest attempt per question, as kunnskapsassistenten's `withoutRetriedAttempts`: genki stores
 * a retry as a new turn, so a reload would show a retried question two or three times.
 */
const withoutRetriedAttempts = (messages: readonly ApiMessage[]): ApiMessage[] => {
  const question = (m: ApiMessage) => m.text.trim().replace(/\s+/g, ' ');
  const lastAsked = new Map<string, number>();
  messages.forEach((m, at) => {
    if (m.role === 'user') lastAsked.set(question(m), at);
  });
  const kept: ApiMessage[] = [];
  let dropping = false;
  messages.forEach((m, at) => {
    if (m.role === 'user') dropping = lastAsked.get(question(m)) !== at;
    if (!dropping) kept.push(m);
  });
  return kept;
};

export interface GenkiApiOptions {
  /** genki's API, with `headers`, or a proxy that adds the key, such as a dev server's `/genki`. */
  baseUrl: string;
  tenant: string;
  profile?: AssistantProfile | undefined;
  /** genki names variants in the language asked for. */
  language?: string | undefined;
  /** The host's credentials, such as the person's Bearer token, asked for before every request. */
  headers?: (() => Record<string, string> | Promise<Record<string, string>>) | undefined;
}

const httpError = async (response: Response) => {
  let detail = response.statusText;
  try {
    const body = (await response.json()) as { title?: string; error?: string; detail?: string };
    detail = body.detail ?? body.title ?? body.error ?? detail;
  } catch {
    // Not JSON; the status says enough.
  }
  return new HttpError(response.status, `${response.status} ${detail}`);
};

/** The assembly's calls against genki's API. Reads, a new thread and a question only. */
export const createGenkiApi = ({
  baseUrl,
  tenant,
  profile,
  language = 'nb',
  headers,
}: GenkiApiOptions): AssistantApi => {
  // Every request, the stream's too: the host's headers, with the request's own over them.
  const send: typeof fetch = async (input, init) => {
    if (!headers) return fetch(input, init);
    const merged = new Headers(await headers());
    new Headers(init?.headers).forEach((value, name) => merged.set(name, value));
    return fetch(input, { ...init, headers: merged });
  };
  const client = createClient({ baseUrl, fetch: send });
  const corpusProfile = (key: string | undefined) => (key ? profile?.corpora?.[key] : undefined);

  const getJson = async <T>(path: string): Promise<T> => {
    const response = await send(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json', 'Accept-Language': language },
    });
    if (!response.ok) throw await httpError(response);
    return (await response.json()) as T;
  };

  const getFacets = <T>(dataset: string, fields: string, filter?: FilterSet | object) => {
    const query = new URLSearchParams({
      tenant,
      'dataset-config-key': dataset,
      fields,
      ...(filter ? { filter: JSON.stringify(filter) } : {}),
    });
    const path = `/api/facets?${query}`;
    const length = `${baseUrl}${path}`.length;
    if (length > FACETS_URL_LIMIT)
      return Promise.reject(
        new HttpError(431, `facets address of ${length} characters, over ${FACETS_URL_LIMIT}`),
      );
    return getJson<T>(path);
  };

  const aboutCache = new Map<string, Promise<readonly string[] | undefined>>();

  return {
    loadModels: async () => (await getJson<{ data: ModelRow[] }>('/v1/models')).data,

    // Every page, not the first 100: the list has no «Vis flere».
    loadThreads: async () => {
      const all: ApiConversation[] = [];
      for (let page = 0; page < 50; page += 1) {
        const body = await getJson<{ conversations: ApiConversation[]; total?: number }>(
          `/api/conversations?page_size=100&page_index=${page}`,
        );
        all.push(...body.conversations);
        if (
          body.conversations.length < 100 ||
          (body.total !== undefined && all.length >= body.total)
        )
          break;
      }
      return all.map((c) => {
        const dataset = corpusOf(c.tags);
        return {
          id: c.id,
          title: c.topic ?? '',
          updatedAt: c.created,
          ...(dataset ? { dataset } : {}),
          ...(c.serviceId ? { service: c.serviceId } : {}),
        };
      });
    },

    loadThread: async (id) => {
      const body = await getJson<{ conversation: ApiConversation; messages: ApiMessage[] }>(
        `/api/conversations/${encodeURIComponent(id)}`,
      );
      const corpus = corpusOf(body.conversation.tags);
      const own = corpusProfile(corpus);
      const turns: Turn[] = [];
      for (const message of withoutRetriedAttempts(body.messages)) {
        if (message.role === 'user') {
          turns.push({ id: message.id, question: message.text, askedAt: message.created });
        } else if (message.role === 'assistant') {
          const last = turns.at(-1);
          // An answer after an answer is a later run for the same question: the latest stands.
          if (last) last.answer = answerFromMessage(message, own);
          else
            turns.push({
              id: message.id,
              question: '',
              askedAt: message.created,
              answer: answerFromMessage(message, own),
            });
        }
      }
      return { title: body.conversation.topic ?? '', turns, ...(corpus ? { corpus } : {}) };
    },

    loadCorpora: async () => {
      const body = await getJson<{
        datasets: { id: string; name: string; description: string | null }[];
      }>('/api/datasets');
      return body.datasets.map((d) => {
        const own = corpusProfile(d.id);
        const description = own?.description ?? d.description;
        return { key: d.id, label: own?.label ?? d.name, ...(description ? { description } : {}) };
      });
    },

    // The collection's multiselect fields; the profile's choice and words where it has them.
    loadFields: async (dataset) => {
      const body = await getJson<{
        dataset?: { filters?: { field: string; kinds?: string[]; 'value-type'?: string }[] };
      }>(`/api/datasets/${encodeURIComponent(dataset)}`);
      const offered = (body.dataset?.filters ?? []).filter((f) => f.kinds?.includes('multiselect'));
      const chosen = corpusProfile(dataset)?.fields;
      if (chosen) return chosen.filter((f) => offered.some((o) => o.field === f.id));
      return offered.map((f) => ({
        id: f.field,
        label: f.field,
        ...(f['value-type'] === 'integer' ? { integer: true } : {}),
      }));
    },

    // One call per field, narrowed by the other fields only: each count is «given the others».
    loadFacets: (selection, dataset, fields, lists) =>
      Promise.all(
        fields.map(async (field) => {
          const others = Object.fromEntries(
            Object.entries(selection).filter(([id]) => id !== field.id),
          );
          const body = await getFacets<{
            fields: { field: string; options: { value: string; count: number }[] }[];
          }>(dataset, field.id, filterSet(others, fields, lists));
          const options = (body.fields.find((f) => f.field === field.id)?.options ?? []).map(
            (o) => ({
              value: String(o.value),
              count: o.count,
            }),
          );
          return {
            id: field.id,
            label: field.label,
            ...(field.heading ? { heading: field.heading } : {}),
            ...(field.kind ? { kind: field.kind } : {}),
            options,
          };
        }),
      ),

    loadAbout: (dataset, documentId) => {
      const about = corpusProfile(dataset)?.about;
      const number = Number(documentId);
      if (!about || !Number.isInteger(number)) return Promise.resolve(undefined);
      const key = `${dataset}:${documentId}`;
      const cached = aboutCache.get(key);
      if (cached) return cached;
      const filter = {
        fields: [
          {
            field: about.idField,
            type: 'multiselect',
            'value-type': 'integer',
            'selected-options': [number],
          },
        ],
      };
      const found = getFacets<{
        fields: { field: string; options: { value: string | number; count: number }[] }[];
      }>(dataset, about.fields.join(','), filter).then(
        (body) => {
          const values = (field: string) =>
            (body.fields.find((f) => f.field === field)?.options ?? [])
              .filter((o) => o.count > 0)
              .map((o) => String(o.value))
              .join(', ');
          const line = about.fields.map(values).filter(Boolean);
          return line.length > 0 ? line : undefined;
        },
        () => undefined,
      );
      aboutCache.set(key, found);
      return found;
    },

    ask: async function* (params) {
      let conversationId = params.conversationId;
      if (!conversationId) {
        const response = await send(`${baseUrl}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            title: params.question.trim().replace(/\s+/g, ' '),
            'agent-id': params.model.split('__')[0],
            tags: params.dataset ? [`corpus:${params.dataset.key}`] : [],
          }),
          signal: params.signal,
        });
        // Not signed in stops here; any other failure asks without a thread.
        if (response.status === 401) throw await httpError(response);
        if (response.ok) {
          const body = (await response.json()) as { conversation?: { id?: string } };
          conversationId = body.conversation?.id;
          if (conversationId) yield { type: 'conversation', conversationId };
        }
      }
      yield* client.stream(
        {
          service: params.model,
          question: params.question,
          ...(conversationId ? { conversationId } : {}),
          ...(params.filters ? { filters: params.filters } : {}),
          ...(params.dataset ? { dataset: params.dataset } : {}),
        },
        { signal: params.signal, live: true, steps: params.steps },
      );
    },
  };
};
