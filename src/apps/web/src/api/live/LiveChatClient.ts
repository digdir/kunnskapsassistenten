import type { Facet } from '../../../shared/facets.ts';
import {
  isEmptySelection,
  type FilterFacet,
  type FilterSelection,
  type RetrievalDetails,
  type SourceDocument,
  type StreamEvent,
  type Thread,
  type ThreadDetail,
} from '../../model';
import { errorFromBackend, errorFromStatus } from '../backendErrors';
import type { AskParams, ChatClient } from '../chatClient';
import { CORPUS_TAG_PREFIX } from '../corpus';
import { facetsFrom } from '../facets';
import { filterFieldsFor } from '../filterFields';
import type { DatasetFilterFields } from '../filterFields';
import {
  DEFAULT_TOOL_NAME,
  MCP_PROTOCOL_VERSION,
  McpStreamState,
  datasetArguments,
  filterArguments,
  toCitations,
  toSourceDocuments,
  type McpChunk,
} from './mcp';
import { excerptIds, fetchExcerptTexts, withExcerptTexts } from './excerpts';
import { answerFingerprint, recallThread, rememberAnswer } from './sourceStore';
import { TurnRecorder } from './turnRecorder';
import { createSseDecoder } from './sse';
import {
  agentIdFromToolName,
  threadDetailFrom,
  threadFromConversation,
  type ApiConversation,
  type ApiMessage,
} from './conversations';
import { currentUserId } from './userId';

export type LiveChatClientOptions = {
  /** Where the proxy lives. Relative on purpose: same origin, no CORS. */
  basePath?: string;
  toolName?: string;
  /** Which corpus to ask; both or neither. Dataset names, not credentials, so `VITE_` is fine. */
  tenant?: string;
  /** Which corpus to ask, read per call: the corpus can change at runtime, the client cannot. */
  datasetConfigKey?: string | (() => string | undefined);
  /** Field names per dataset key, since the corpus can change between questions. */
  filterFields?: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  /** Which agent owns a conversation this client creates. Defaults to `agentIdFromToolName`. */
  agentId?: string;
};

// The open conversation, module state because the shell and the chat view each build a client.
// A promise while it is being made, so a question asked in that tick joins the creation.
let openConversation: string | Promise<string | undefined> | undefined;

/** For tests: forget which conversation is open. */
export function resetLiveConversation(): void {
  openConversation = undefined;
}

/**
 * The client against the KA backend, through a proxy on the same origin: the API key must not be
 * in the bundle, and the backend sends no CORS headers. Facets come from our own server
 * (server/facets.ts, src/decisions/0004).
 */
export class LiveChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #toolName: string;
  readonly #tenant: string | undefined;
  readonly #corpusKey: () => string | undefined;
  readonly #filterFields: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  readonly #agentId: string;

  constructor(options: LiveChatClientOptions = {}) {
    this.#basePath = options.basePath ?? '/api';
    this.#toolName = options.toolName ?? DEFAULT_TOOL_NAME;
    this.#tenant = options.tenant;
    this.#corpusKey =
      typeof options.datasetConfigKey === 'function'
        ? options.datasetConfigKey
        : () => options.datasetConfigKey as string | undefined;
    this.#filterFields = options.filterFields ?? filterFieldsFor;
    this.#agentId = options.agentId ?? agentIdFromToolName(this.#toolName);
  }

  /** The corpus arguments, resolved per call because the corpus is a runtime choice. */
  #dataset(): Record<string, string> {
    return datasetArguments(this.#tenant, this.#corpusKey());
  }

  // Only `conversationId` is read: a stand-in thread minted by the shell has a made-up `id`.
  // Undefined clears it, so a new thread does not continue the last one.
  openThread(thread: Thread): void {
    openConversation = thread.conversationId;
  }

  // Returns the thread under the conversation's id, so its address resolves. The pending creation
  // is published before it is awaited, so a question asked in the same tick joins it.
  async createThread(thread: Thread, signal?: AbortSignal): Promise<Thread | undefined> {
    const dataset = this.#dataset();
    const pending = this.#createConversation(
      thread.title,
      dataset.dataset_config_key,
      signal,
      thread.filter,
    );
    openConversation = pending;

    const id = await pending;
    if (id === undefined) {
      // Nothing was made, so nothing is open. `ask` will try again on its own.
      openConversation = undefined;
      return undefined;
    }

    openConversation = id;
    return { ...thread, id, conversationId: id };
  }

  /** The conversation store. Every call needs `X-User-Id`; the proxy adds the API key. */
  async #conversations(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.#basePath}/conversations${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId(),
        ...init?.headers,
      },
    });
  }

  // Made here because one made by `tools/call` is owned by the API key's client id and never
  // listed for the reader. Undefined on failure: the turn still streams without it.
  async #createConversation(
    title: string,
    corpusKey: string | undefined,
    signal?: AbortSignal,
    filter?: FilterSelection,
  ): Promise<string | undefined> {
    try {
      const response = await this.#conversations('', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          title: title.trim().replace(/\s+/g, ' '),
          'agent-id': this.#agentId,
          // The thread's corpus, kept on the thread: the backend returns `tags` as given, so the
          // corpus is known on any machine. Prefixed, because `tags` is a shared list.
          ...(corpusKey ? { tags: [`${CORPUS_TAG_PREFIX}${corpusKey}`] } : {}),
          // The filter locks the thread (issue 90). The backend keeps `filter-value` from the
          // create call, but not the filter a turn is asked with. Not sent when empty (`lockOf`).
          ...(filter && !isEmptySelection(filter) ? { 'filter-value': filter } : {}),
        }),
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { conversation?: ApiConversation };
      return body.conversation?.id;
    } catch {
      return undefined;
    }
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const state = new McpStreamState();
    // Resolved once and used for both calls, so the conversation is tagged with the corpus the
    // tool call searches.
    const dataset = this.#dataset();
    // Absent when the pair is not configured: the backend then picks a dataset this side cannot
    // name, and the frames leave the field out.
    const askedOf = dataset.dataset_config_key ? { corpusKey: dataset.dataset_config_key } : {};
    // The caller's conversation, then the open one; only without either is one made here.
    const conversationId =
      params.conversationId ??
      (await openConversation) ??
      (await this.#createConversation(
        params.query,
        dataset.dataset_config_key,
        params.signal,
        params.filters,
      ));
    // From the same `dataset` as the query, so the field names belong to the corpus being asked.
    const filters = filterArguments(params.filters, this.#filterFields(dataset.dataset_config_key));
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: this.#toolName,
        arguments: {
          query: params.query,
          ...dataset,
          ...filters,
          ...(conversationId ? { conversation_id: conversationId } : {}),
        },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
          // Setting this makes the server stream; without it, it answers with one JSON body.
          progressToken: `ka-${Date.now()}`,
        },
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.#basePath}/mcp`, {
        method: 'POST',
        signal: params.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          // These three must agree with the body or the server answers 400 with -32020. The API key
          // is added by the proxy, never here.
          'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
          'Mcp-Method': 'tools/call',
          'Mcp-Name': this.#toolName,
        },
        body: JSON.stringify(body),
      });
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? { code: 'aborted' }
          : // The browser could not reach the proxy. Whether the corpus behind it is up is
            // unknown, so the code stays `unknown`.
            { code: 'unknown', message: 'Fikk ikke kontakt med tjenesten.' },
        ...askedOf,
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: errorFromStatus(response.status), ...askedOf };
      return;
    }
    if (!response.body) {
      yield {
        type: 'error',
        error: { code: 'unknown', message: 'Tomt svar fra tjeneren.' },
        ...askedOf,
      };
      return;
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const decoder = createSseDecoder();
    const turn = new TurnRecorder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        const frames = done ? decoder.flush() : decoder.push(value ?? '');

        for (const frame of frames) {
          const events = readFrame(frame.data, state, conversationId, askedOf, {
            withTexts: (documents) => this.#withTexts(documents, askedOf.corpusKey, params.signal),
            remember: (id, answerText, chunks, retrieval) =>
              rememberAnswer(id, answerText, {
                chunks,
                retrieval,
                thinkingSteps: turn.thinkingSteps,
                thoughtMs: turn.thoughtMs,
              }),
          });
          // Through the recorder on their way out, so what was shown can be written down with the
          // answer. See turnRecorder.ts.
          for await (const event of events) {
            turn.observe(event);
            yield event;
          }
        }

        if (done) return;
      }
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? { code: 'aborted' }
          : { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
        ...askedOf,
      };
    } finally {
      await reader.cancel().catch(() => {});
    }
  }

  // Newest first. An empty list on failure, never a throw, so the thread list cannot take the page
  // down. `page_size` is the backend's maximum (100).
  async listThreads(): Promise<Thread[]> {
    try {
      const response = await this.#conversations('?page_size=100');
      if (!response.ok) return [];
      const body = (await response.json()) as { conversations?: ApiConversation[] };
      return (body.conversations ?? []).map(threadFromConversation);
    } catch {
      return [];
    }
  }

  // Null for both «not found» and «could not ask»: the route draws «Fant ikke tråden» for both.
  async getThread(threadId: string): Promise<ThreadDetail | null> {
    try {
      const response = await this.#conversations(`/${encodeURIComponent(threadId)}`);
      if (!response.ok) return null;
      const body = (await response.json()) as {
        conversation?: ApiConversation;
        messages?: ApiMessage[];
      };
      if (!body.conversation) return null;
      return await this.#withRemembered(threadDetailFrom(body.conversation, body.messages));
    } catch {
      return null;
    }
  }

  // The excerpts' text from our server (excerpts.ts); fails soft, never holding back the answer.
  async #withTexts(
    documents: SourceDocument[],
    dataset: string | undefined,
    signal?: AbortSignal,
  ): Promise<SourceDocument[]> {
    if (documents.length === 0) return documents;
    const texts = await fetchExcerptTexts(this.#basePath, dataset, excerptIds(documents), signal);
    return withExcerptTexts(documents, texts);
  }

  // Adds what this browser stored for each answer (sourceStore.ts), only where the backend gave
  // none and only when the stored text matches, so an answer never gets another's sources.
  async #withRemembered(detail: ThreadDetail): Promise<ThreadDetail> {
    const remembered = recallThread(detail.id);
    if (!remembered) return detail;

    const messages = await Promise.all(
      detail.messages.map(async (message) => {
        if (message.role !== 'assistant' || message.status !== 'complete') return message;
        const answer = remembered.get(answerFingerprint(message.content));
        if (!answer) return message;

        const restored = { ...message };
        if (!message.thinkingSteps?.length && answer.thinkingSteps?.length) {
          restored.thinkingSteps = answer.thinkingSteps;
        }
        if (!message.retrieval && answer.retrieval) restored.retrieval = answer.retrieval;
        if (message.thoughtMs === undefined && answer.thoughtMs !== undefined) {
          restored.thoughtMs = answer.thoughtMs;
        }
        if (!message.sources?.length && answer.chunks.length > 0) {
          const documents = await this.#withTexts(
            toSourceDocuments(answer.chunks, detail.corpusKey),
            detail.corpusKey,
          );
          restored.sources = documents;
          restored.citations = toCitations(documents);
        }
        return restored;
      }),
    );
    return { ...detail, messages };
  }

  // Counted by our own server from Typesense (server/facets.ts); the backend has no facet API.
  // None without a dataset pair or field names; throws on failure, so the panel can offer a retry.
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    const dataset = this.#dataset().dataset_config_key;
    const fields = this.#filterFields(dataset);
    if (!dataset || !fields) return [];

    const response = await fetch(
      `${this.#basePath}/facets?dataset=${encodeURIComponent(dataset)}`,
      { signal },
    );
    if (!response.ok) throw new Error(`Filtrene svarte ${response.status}.`);
    const body = (await response.json()) as { facets?: Facet[] };
    return facetsFrom(body.facets ?? [], fields, selection);
  }
}

/** The answer text in the final frame, if it carried one. */
function finalAnswerText(content: { type?: string; text?: string }[] | undefined): string {
  return content?.find((block) => block.type === 'text')?.text ?? '';
}

/** What the final frame needs: the excerpts' text, and a place to store the answer's chunks. */
type FrameHooks = {
  withTexts: (documents: SourceDocument[]) => Promise<SourceDocument[]>;
  remember: (
    conversationId: string,
    answerText: string,
    chunks: McpChunk[],
    retrieval: RetrievalDetails,
  ) => void;
};

/** Turns one decoded SSE payload into zero or more of our events. */
async function* readFrame(
  data: string,
  state: McpStreamState,
  fallbackConversationId?: string,
  /** `{ corpusKey }` or `{}`, so «not known» leaves the field out rather than `undefined`. */
  askedOf: { corpusKey?: string } = {},
  hooks?: FrameHooks,
): AsyncGenerator<StreamEvent> {
  let message: {
    method?: string;
    params?: { _meta?: Record<string, unknown> };
    result?: {
      isError?: boolean;
      content?: { type?: string; text?: string }[];
      structuredContent?: { chunks?: unknown[]; conversation_id?: string };
      _meta?: { conversation_id?: string; status?: string; error_code?: string; code?: string };
    };
    /** The backend's own snake_case codes or the requested set; `errorFromBackend` reads both. */
    error?: { message?: string; data?: { code?: string } };
  };

  try {
    message = JSON.parse(data);
  } catch {
    // A frame we cannot read is not worth ending the answer over.
    return;
  }

  if (message.error) {
    yield {
      type: 'error',
      error: errorFromBackend(message.error.message, message.error.data?.code),
      ...askedOf,
    };
    return;
  }

  if (message.method === 'notifications/progress') {
    yield* state.progress(message.params?._meta ?? {});
    return;
  }

  const result = message.result;
  if (!result) return;

  // A tool that failed is 200 with `isError: true`; a thin-evidence answer is not an error. The
  // agent's English failure text is read for a code and kept off the screen (`errorFromBackend`).
  // `_meta.code` is what the backend sends today; `_meta.error_code` is the requested name.
  if (result.isError) {
    const text = result.content?.find((block) => block.type === 'text')?.text;
    yield {
      type: 'error',
      error: errorFromBackend(text, result._meta?.error_code ?? result._meta?.code),
      ...askedOf,
    };
    return;
  }

  const chunks = (result.structuredContent?.chunks ?? []) as McpChunk[];
  const listed = toSourceDocuments(chunks, askedOf.corpusKey);

  // Anything still held back was answer text after all: nothing followed it to prove it was the
  // agent's plan.
  yield* state.flushPending();

  // This agent's answer appears only in the final frame, so emit it unless the stream already did.
  const finalText = state.answerText === '' ? finalAnswerText(result.content) : state.answerText;

  // No chunks and no text: an answer with an empty source list, not a failure.
  if (listed.length === 0 && finalText === '') {
    yield { type: 'error', error: { code: 'no-hits' }, ...askedOf };
    return;
  }

  if (state.answerText === '' && finalText !== '') {
    yield { type: 'token', text: finalText };
  }

  const conversationId =
    result._meta?.conversation_id ??
    result.structuredContent?.conversation_id ??
    fallbackConversationId ??
    '';
  // Only the document count is read here, and the lookup below does not change the grouping, so
  // this is the same «Fremgangsmåte» before and after it.
  const retrieval = state.retrieval(listed, chunks.length);

  // Stored under the final frame's text, which is what the backend keeps, and before the lookup,
  // so a reload while the excerpts load (up to 5 s) does not lose it. See sourceStore.ts.
  hooks?.remember(conversationId, finalAnswerText(result.content) || finalText, chunks, retrieval);

  // After the answer's text, so the reader is reading while the excerpts' text is looked up
  // (src/decisions/0008).
  const documents = hooks ? await hooks.withTexts(listed) : listed;

  yield {
    type: 'sources',
    documents,
    citations: toCitations(documents),
    retrieval,
  };

  yield {
    type: 'done',
    messageId: `msg-${Date.now()}`,
    conversationId,
    // Only `needs-clarification` is read: a failed turn already arrived as `isError`, so a status
    // of `error` alone is dropped rather than given a second route to the same state.
    ...(result._meta?.status === 'needs-clarification'
      ? { outcome: 'needs-clarification' as const }
      : {}),
    ...askedOf,
  };
}
