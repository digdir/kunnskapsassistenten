import { apiErrorFrom, ApiError } from './errors.js';
import { dataFrames } from './sse.js';
import type {
  Answer,
  AskHandlers,
  AskRequest,
  Conversation,
  ConversationMessage,
  ConversationPage,
  Dataset,
  FacetField,
  FacetRequest,
  FeedbackRequest,
  FilterField,
  Service,
  Source,
  Step,
  StreamEvent,
  StreamOptions,
} from './types.js';

const withoutTrailingSlashes = (url: string) => {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end -= 1;
  return url.slice(0, end);
};

export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  token?: string | (() => string | Promise<string>);
  userId?: string;
  version?: number;
  actingFor?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export interface CallOptions {
  signal?: AbortSignal;
  userId?: string;
}

type Json = Record<string, unknown>;

const isRecord = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export const selection = (
  field: string,
  values: (string | number)[],
  options: Pick<FilterField, 'type' | 'value-type'> = {},
): FilterField => ({
  field,
  ...(options.type ? { type: options.type } : {}),
  ...(options['value-type']
    ? { 'value-type': options['value-type'] }
    : values.length > 0 && values.every((v) => typeof v === 'number')
      ? { 'value-type': 'integer' as const }
      : {}),
  'selected-options': values,
});

export const citedIndexes = (text: string): number[] => [
  ...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))),
];

export const sourceFor = (sources: Source[], index: number) =>
  sources.find((s) => s.index === index);

const sourceOf = (raw: unknown): Source[] => {
  if (!isRecord(raw)) return [];
  const excerpts = Array.isArray(raw.excerpts)
    ? raw.excerpts.filter(isRecord).map((e) => ({
        chunkId: str(e.chunk_id) ?? '',
        text: str(e.text) ?? '',
        ...(typeof e.position === 'number' ? { position: e.position } : {}),
      }))
    : [];
  const legacy = isRecord(raw.source) ? raw.source : {};
  const url = str(raw.url);
  const documentId = str(raw.document_id);
  const excerpt = str(raw.excerpt);
  const version = str(raw.version);
  const publishedAt = str(raw.published_at);
  return [
    {
      ...(typeof raw.index === 'number' ? { index: raw.index } : {}),
      title: str(raw.title) ?? str(legacy.name) ?? '',
      ...(url === undefined ? {} : { url }),
      ...(documentId === undefined ? {} : { documentId }),
      excerpts,
      ...(excerpt === undefined ? {} : { excerpt }),
      ...(version === undefined ? {} : { version }),
      ...(publishedAt === undefined ? {} : { publishedAt }),
    },
  ];
};

const sourcesOf = (raw: unknown): Source[] => (Array.isArray(raw) ? raw.flatMap(sourceOf) : []);

const citationsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];

const serviceOf = (raw: Json): Service => {
  const title = str(raw.title);
  const description = str(raw.description);
  const agentId = str(raw._agent_id);
  const mode = str(raw._mode);
  const statusReason = str(raw.status_reason);
  return {
    id: str(raw.id) ?? '',
    ...(title === undefined ? {} : { title }),
    ...(description === undefined ? {} : { description }),
    ...(agentId === undefined ? {} : { agentId }),
    ...(mode === undefined ? {} : { mode }),
    default: raw._default === true,
    chat: raw._chat === true,
    ...(raw.status === 'paused' ? { status: 'paused' as const } : {}),
    ...(statusReason === undefined ? {} : { statusReason }),
    ...(Array.isArray(raw.input_fields) ? { inputFields: raw.input_fields.filter(isRecord) } : {}),
  };
};

const stepOf = (raw: Json): Step => raw as Step;

class Accumulator {
  id = '';
  text = '';
  conversationId: string | undefined;
  sources: Source[] = [];
  citations: string[] = [];
  noAnswer = false;
  notice: string | undefined;
  table: unknown;
  csv: string | undefined;
  constructor(
    readonly taskId: string | undefined,
    readonly serviceVersion: number | undefined,
  ) {}

  answer(): Answer {
    return {
      id: this.id,
      text: this.text,
      ...(this.conversationId === undefined ? {} : { conversationId: this.conversationId }),
      ...(this.taskId === undefined ? {} : { taskId: this.taskId }),
      ...(this.serviceVersion === undefined ? {} : { serviceVersion: this.serviceVersion }),
      sources: this.sources,
      citations: this.citations,
      noAnswer: this.noAnswer,
      ...(this.notice === undefined ? {} : { notice: this.notice }),
      ...(this.table === undefined ? {} : { table: this.table }),
      ...(this.csv === undefined ? {} : { csv: this.csv }),
    };
  }
}

export const createClient = (options: ClientOptions) => {
  const base = withoutTrailingSlashes(options.baseUrl);
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  const headersFor = async (call: CallOptions, json: boolean): Promise<Headers> => {
    const headers = new Headers(options.headers);
    if (options.apiKey) headers.set('x-api-key', options.apiKey);
    else if (options.token) {
      const token = typeof options.token === 'function' ? await options.token() : options.token;
      headers.set('authorization', `Bearer ${token}`);
    }
    const user = call.userId ?? options.userId;
    if (user) headers.set('x-user-id', user);
    if (options.version !== undefined) headers.set('genai-version', String(options.version));
    if (options.actingFor) headers.set('genai-acting-for', options.actingFor);
    if (json) headers.set('content-type', 'application/json');
    return headers;
  };

  const send = async (
    method: string,
    path: string,
    body: unknown,
    call: CallOptions = {},
    accept = 'application/json',
  ): Promise<Response> => {
    const headers = await headersFor(call, body !== undefined);
    headers.set('accept', accept);
    const response = await doFetch(`${base}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(call.signal ? { signal: call.signal } : {}),
    });
    if (!response.ok) throw await apiErrorFrom(response);
    return response;
  };

  const json = async (method: string, path: string, body?: unknown, call?: CallOptions) =>
    (await (await send(method, path, body, call)).json()) as Json;

  const query = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) search.set(k, String(v));
    const text = search.toString();
    return text ? `?${text}` : '';
  };

  const bodyFor = (request: AskRequest, extra: Json = {}): Json => ({
    model: request.service,
    messages: request.messages ?? [{ role: 'user', content: request.question ?? '' }],
    ...(request.conversationId ? { conversation_id: request.conversationId } : {}),
    ...(request.newConversation ? { genai_conversation: true } : {}),
    ...(request.filters ? { filters: request.filters } : {}),
    ...(request.dataset
      ? { tenant: request.dataset.tenant, dataset_config_key: request.dataset.key }
      : {}),
    ...(request.input ? { input: request.input } : {}),
    ...(request.overrides ? { overrides: request.overrides } : {}),
    ...extra,
  });

  const taskOf = (response: Response) => response.headers.get('genai-task') ?? undefined;
  const versionOf = (response: Response) => {
    const raw = response.headers.get('genai-service-version');
    return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  };

  async function* stream(
    request: AskRequest,
    streamOptions: StreamOptions = {},
  ): AsyncGenerator<StreamEvent, void> {
    const response = await send(
      'POST',
      '/v1/chat/completions',
      bodyFor(request, {
        stream: true,
        ...((streamOptions.live ?? true) ? { genai_stream: 'live' } : {}),
        ...(streamOptions.steps ? { genai_steps: true } : {}),
      }),
      streamOptions.signal ? { signal: streamOptions.signal } : {},
      'text/event-stream',
    );
    if (!response.body) throw new ApiError(502, 'The response has no body.');
    const acc = new Accumulator(taskOf(response), versionOf(response));
    let failure: ApiError | undefined;
    for await (const frame of dataFrames(response.body)) {
      if (frame === '[DONE]') break;
      let chunk: Json;
      try {
        chunk = JSON.parse(frame) as Json;
      } catch {
        continue;
      }
      if (typeof chunk.id === 'string') acc.id = chunk.id;
      const conversationId = str(chunk.conversation_id);
      if (conversationId && acc.conversationId === undefined) {
        acc.conversationId = conversationId;
        yield { type: 'conversation', conversationId };
      }
      const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
      const delta = isRecord(choice) && isRecord(choice.delta) ? choice.delta : {};
      const finish = isRecord(choice) ? choice.finish_reason : undefined;
      if (chunk.retract === true) {
        acc.text = '';
        yield { type: 'retract' };
      }
      const text = str(delta.content);
      if (text) {
        acc.text += text;
        yield { type: 'text', text };
      }
      const reasoning = str(delta.reasoning_content);
      if (reasoning) yield { type: 'reasoning', text: reasoning };
      if (isRecord(chunk.genai_step)) yield { type: 'step', step: stepOf(chunk.genai_step) };
      if (Array.isArray(chunk.sources) || Array.isArray(chunk.citations)) {
        acc.sources = sourcesOf(chunk.sources);
        acc.citations = citationsOf(chunk.citations);
        yield { type: 'sources', sources: acc.sources, citations: acc.citations };
      }
      if (chunk.no_answer === true) {
        acc.noAnswer = true;
        acc.notice = str(chunk.notice);
      }
      if (chunk.table !== undefined) acc.table = chunk.table;
      if (typeof chunk.csv === 'string') acc.csv = chunk.csv;
      if (finish === 'error') {
        const error = isRecord(chunk.error) ? chunk.error : {};
        failure = new ApiError(
          500,
          str(error.message) ?? 'The answer failed.',
          str(error.failure_code) ?? str(error.code),
        );
      }
    }
    if (failure) throw failure;
    yield { type: 'done', answer: acc.answer() };
  }

  const ask = async (request: AskRequest, handlers?: AskHandlers): Promise<Answer> => {
    if (!handlers) {
      const response = await send('POST', '/v1/chat/completions', bodyFor(request));
      const body = (await response.json()) as Json;
      const choice = Array.isArray(body.choices) ? body.choices[0] : undefined;
      const message = isRecord(choice) && isRecord(choice.message) ? choice.message : {};
      const usage = isRecord(body.usage) ? body.usage : undefined;
      const conversationId = str(body.conversation_id);
      const taskId = taskOf(response);
      const serviceVersion = versionOf(response);
      const notice = str(body.notice);
      const csv = str(body.csv);
      return {
        id: str(body.id) ?? '',
        text: str(message.content) ?? '',
        ...(conversationId === undefined ? {} : { conversationId }),
        ...(taskId === undefined ? {} : { taskId }),
        ...(serviceVersion === undefined ? {} : { serviceVersion }),
        sources: sourcesOf(body.sources),
        citations: citationsOf(body.citations),
        noAnswer: body.no_answer === true,
        ...(notice === undefined ? {} : { notice }),
        ...(usage
          ? {
              usage: {
                promptTokens: Number(usage.prompt_tokens ?? 0),
                completionTokens: Number(usage.completion_tokens ?? 0),
                totalTokens: Number(usage.total_tokens ?? 0),
              },
            }
          : {}),
        ...(body.table === undefined ? {} : { table: body.table }),
        ...(csv === undefined ? {} : { csv }),
      };
    }
    let answer: Answer | undefined;
    for await (const event of stream(request, {
      live: true,
      steps: handlers.onStep !== undefined,
      ...(handlers.signal ? { signal: handlers.signal } : {}),
    })) {
      if (event.type === 'text') handlers.onText?.(event.text);
      else if (event.type === 'retract') handlers.onRetract?.();
      else if (event.type === 'step') handlers.onStep?.(event.step);
      else if (event.type === 'sources') handlers.onSources?.(event.sources);
      else if (event.type === 'done') answer = event.answer;
    }
    if (!answer) throw new ApiError(502, 'The stream ended without an answer.');
    return answer;
  };

  const conversationOf = (raw: unknown): Conversation => raw as Conversation;

  return {
    listServices: async (call?: CallOptions): Promise<Service[]> => {
      const body = await json('GET', '/v1/models', undefined, call);
      return Array.isArray(body.data) ? body.data.filter(isRecord).map(serviceOf) : [];
    },
    ask,
    stream,
    conversations: {
      list: async (
        params: { pageSize?: number; pageIndex?: number; tags?: string[] } = {},
        call?: CallOptions,
      ): Promise<ConversationPage> =>
        (await json(
          'GET',
          `/api/conversations${query({
            page_size: params.pageSize,
            page_index: params.pageIndex,
            tags: params.tags?.join(','),
          })}`,
          undefined,
          call,
        )) as unknown as ConversationPage,
      create: async (
        params: { service?: string; title?: string; tags?: string[] } = {},
        call?: CallOptions,
      ): Promise<Conversation> =>
        conversationOf(
          (
            await json(
              'POST',
              '/api/conversations',
              {
                ...(params.service ? { 'agent-id': params.service } : {}),
                ...(params.title ? { title: params.title } : {}),
                ...(params.tags ? { tags: params.tags } : {}),
              },
              call,
            )
          ).conversation,
        ),
      get: async (
        id: string,
        params: { branches?: 'all'; diagnostics?: boolean } = {},
        call?: CallOptions,
      ): Promise<{ conversation: Conversation; messages: ConversationMessage[] }> =>
        (await json(
          'GET',
          `/api/conversations/${encodeURIComponent(id)}${query({
            branches: params.branches,
            include_diagnostics: params.diagnostics ? 'true' : undefined,
          })}`,
          undefined,
          call,
        )) as unknown as { conversation: Conversation; messages: ConversationMessage[] },
      update: async (
        id: string,
        changes: { title?: string; tags?: string[] },
        call?: CallOptions,
      ): Promise<Conversation> =>
        conversationOf(
          (await json('PUT', `/api/conversations/${encodeURIComponent(id)}`, changes, call))
            .conversation,
        ),
      delete: async (id: string, call?: CallOptions): Promise<void> => {
        await json('DELETE', `/api/conversations/${encodeURIComponent(id)}`, undefined, call);
      },
    },
    datasets: {
      list: async (call?: CallOptions): Promise<Dataset[]> => {
        const body = await json('GET', '/api/datasets', undefined, call);
        return Array.isArray(body.datasets) ? (body.datasets as Dataset[]) : [];
      },
      get: async (id: string, call?: CallOptions): Promise<Dataset> =>
        (await json('GET', `/api/datasets/${id}`, undefined, call)).dataset as Dataset,
    },
    facets: async (request: FacetRequest, call?: CallOptions): Promise<FacetField[]> => {
      const body = await json(
        'GET',
        `/api/facets${query({
          tenant: request.tenant,
          'dataset-config-key': request.datasetConfigKey,
          fields: request.fields.join(','),
          filter: request.filter ? JSON.stringify(request.filter) : undefined,
        })}`,
        undefined,
        call,
      );
      return Array.isArray(body.fields) ? (body.fields as FacetField[]) : [];
    },
    feedback: async (request: FeedbackRequest, call?: CallOptions): Promise<void> => {
      await json(
        'POST',
        '/api/feedback',
        {
          task: request.taskId,
          rating: request.rating,
          ...(request.comment ? { comment: request.comment } : {}),
          ...(request.reasons ? { reasons: request.reasons } : {}),
        },
        call,
      );
    },
  };
};

export type Client = ReturnType<typeof createClient>;
