import type {
  AgentList,
  ChatError,
  FilterFacet,
  FilterSelection,
  StreamEvent,
  Thread,
  ThreadDetail,
} from '../../model';
import type { AskParams, ChatClient, ThreadCertainty } from '../chatClient';
import { filterFieldsFor } from '../filterFields';
import type { DatasetFilterFields } from '../filterFields';
import { FILTER_REFUSED_MESSAGES, errorFromBackend, errorFromStatus } from '../backendErrors';
import { adoptServerCorpus } from '../corpus';
import { createSseDecoder } from '../live/sse';
import { keepDraft, noteQuestionInFlight, noteSignedIn } from '../session';
import type {
  BffAskRequest,
  BffCapabilities,
  BffConversationDetail,
  BffConversationSummary,
  BffFacet,
  BffFilterRefused,
  BffMe,
  BffModels,
  BffTurnEvent,
} from './contract';
import { facetsFrom } from '../facets';
import {
  agentsFromBff,
  BffTurnState,
  fieldsFromFacets,
  filterBody,
  selectionFromBff,
  threadDetailFromBff,
  threadFromSummary,
} from './mapping';
import { BFF_API } from './api';
import { resetSignIn, toLogin } from './signIn';

export type BffChatClientOptions = {
  /** Where the BFF's API is. Relative: the BFF serves this client itself. */
  basePath?: string;
  /**
   * The deployment's name for the one corpus the BFF serves; the wire does not say which it is.
   */
  datasetConfigKey?: () => string | undefined;
  /** Defaults to the deployment's configuration, as in live. */
  filterFields?: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  /** What a 401 does with the address to return to. Defaults to the BFF's sign-in. */
  onUnauthorized?: (returnTo: string) => void;
  /** Waits between asking whether the BFF's startup probe is done. See `SETTLE_DELAYS_MS`. */
  settleDelaysMs?: number[];
};

/** The open conversation; module state since the shell and chat view each build a client. */
let openConversation: string | undefined;

// The BFF has no endpoint that makes a conversation; `POST /api/ask` does, in its first event. So
// `createThread` waits on this promise for the next question's `conversation` event; the shell
// calls it a tick before it asks (ChatSlotView.tsx).
let creation: { promise: Promise<string | undefined>; settle: (id?: string) => void } | undefined;

function awaitCreation(): NonNullable<typeof creation> {
  if (creation) return creation;
  let settle!: (id?: string) => void;
  const promise = new Promise<string | undefined>((resolve) => {
    settle = resolve;
  });
  creation = { promise, settle };
  return creation;
}

/** What the BFF can do, once it has said so for certain. Kept for the page's life. */
let settledCapabilities: BffCapabilities | undefined;

// The BFF's facets, kept for the page's life (the BFF caches them ten minutes). An empty answer is
// not kept: a BFF without Typesense says the same.
let knownFacets: BffFacet[] | undefined;

/** Whether the deployment has been asked for its corpus on this page. */
let primed = false;

/** For tests: forget the open conversation, the waiting thread, the probe and the facets. */
export function resetBffClient(): void {
  openConversation = undefined;
  creation = undefined;
  settledCapabilities = undefined;
  knownFacets = undefined;
  primed = false;
  resetSignIn();
}

// Waits for the BFF's startup probe, then every 15 s while it is out: the probe can retry for
// about nine minutes, and giving up early would leave the filter panel dead for good.
const SETTLE_DELAYS_MS = [2000, 3000, 5000, 5000, 5000, 10_000, 10_000, 15_000, 15_000];

const NOT_SETTLED: BffCapabilities = {
  capabilities: { filters: false, othersThreads: false, threadTitles: false },
  settled: false,
};

/** A pause the caller can cut short, which then throws its abort reason. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', stop, { once: true });
  });
}

/**
 * The client against the BFF in digdir/kunnskapsassistenten. The BFF holds the API key, the
 * sign-in and the corpus choice, so no identity or dataset goes on the wire
 * (src/decisions/0005-client-behind-the-bff.md).
 */
export class BffChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #corpusKey: () => string | undefined;
  readonly #filterFields: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  readonly #onUnauthorized: (returnTo: string) => void;
  readonly #settleDelaysMs: number[];

  constructor(options: BffChatClientOptions = {}) {
    this.#basePath = options.basePath ?? BFF_API;
    this.#corpusKey = options.datasetConfigKey ?? (() => undefined);
    this.#filterFields = options.filterFields ?? filterFieldsFor;
    this.#onUnauthorized = options.onUnauthorized ?? toLogin;
    this.#settleDelaysMs = options.settleDelaysMs ?? SETTLE_DELAYS_MS;
  }

  /** Every call goes through here, so any 401 leads to sign-in with the draft kept (session.ts). */
  async #fetch(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`${this.#basePath}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (response.status === 401) this.#onUnauthorized(keepDraft());
    return response;
  }

  async #json<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await this.#fetch(path, { signal });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return (await response.json()) as T;
  }

  // The BFF says `settled: false` until its startup probe is done; only a settled answer is kept.
  // `patient` (the filter panel) asks again until it settles; a question asks once. The request
  // itself takes no abort signal, because the answer is shared.
  async #capabilities(patient = false, signal?: AbortSignal): Promise<BffCapabilities> {
    if (settledCapabilities) return settledCapabilities;

    const delays = patient ? this.#settleDelaysMs : [];
    for (let attempt = 0; ; attempt += 1) {
      let reached = true;
      const found = await this.#json<BffCapabilities>('/capabilities').catch(() => {
        reached = false;
        return NOT_SETTLED;
      });
      // The corpus is the deployment's and not the probe's, so an unsettled answer names it too.
      if (found.dataset) adoptServerCorpus(found.dataset);
      if (found.settled) {
        settledCapabilities = found;
        return found;
      }
      // Past the first delays, keep asking at the last one while the probe is out. An unreachable
      // BFF is not waited for: the panel gets an error it can offer a retry on.
      const delay = delays[attempt] ?? (reached ? delays.at(-1) : undefined);
      if (delay === undefined) {
        if (patient && delays.length > 0 && !reached) throw new Error('/capabilities unreachable');
        return found;
      }
      await wait(delay, signal);
    }
  }

  /** Asks for the corpus once per page, so its name is known before the filter panel opens. */
  prime(): void {
    if (primed) return;
    primed = true;
    void this.#capabilities();
  }

  /** The BFF's facets, or none. Throws when the BFF cannot be reached. */
  async #facets(signal?: AbortSignal): Promise<BffFacet[]> {
    if (knownFacets) return knownFacets;
    const { facets } = await this.#json<{ facets?: BffFacet[] }>('/facets', signal);
    if (facets?.length) knownFacets = facets;
    return facets ?? [];
  }

  /** Field names from the BFF's tagged facets, or this build's configuration when it tags none. */
  #fieldsFor(facets: BffFacet[], corpusKey: string | undefined): DatasetFilterFields | undefined {
    return fieldsFromFacets(facets) ?? this.#filterFields(corpusKey);
  }

  /** The field names without failing: a question is asked even if the facets are not there. */
  async #fields(corpusKey: string | undefined): Promise<DatasetFilterFields | undefined> {
    const facets = await this.#facets().catch(() => []);
    return this.#fieldsFor(facets, corpusKey);
  }

  /** Nothing to send when the BFF says its backend cannot filter. */
  async #filter(
    selection: FilterSelection | undefined,
    corpusKey: string | undefined,
  ): Promise<Record<string, string[]> | undefined> {
    if (!selection || Object.values(selection).every((values) => values.length === 0)) {
      return undefined;
    }
    const body = filterBody(selection, await this.#fields(corpusKey));
    if (!body) return undefined;
    const { capabilities: can } = await this.#capabilities();
    return can.filters ? body : undefined;
  }

  // `conversationId` as in live, or for `id-only` the id itself: the address is
  // `/threads/<conversation id>`, so the id is the one thing about it that is certain.
  openThread(thread: Thread, certainty?: ThreadCertainty): void {
    openConversation = thread.conversationId ?? (certainty === 'id-only' ? thread.id : undefined);
  }

  // Resolves when the question that makes the thread gets its `conversation` event (`creation`).
  // If that question fails first, it waits for the next question in the thread.
  async createThread(thread: Thread): Promise<Thread | undefined> {
    openConversation = undefined;
    const id = await awaitCreation().promise;
    return id ? { ...thread, id, conversationId: id } : undefined;
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const corpusKey = this.#corpusKey();
    const askedOf = corpusKey ? { corpusKey } : {};
    const conversationId = params.conversationId ?? openConversation;
    // A question with no conversation makes one, and a thread may be waiting to hear what it is
    // called. It hears it the moment the BFF says, not when the answer is done: the address should
    // not wait for the whole answer.
    const creating = conversationId ? undefined : awaitCreation();
    let named = false;
    const made = (id: string) => {
      named = true;
      openConversation = id;
      creating?.settle(id);
    };
    // The input is empty by now, so a 401 on any call while this is out must keep the question. A
    // question that starts a thread returns to the front page: until the BFF names it, its address
    // is a stand-in that leads nowhere after sign-in.
    const arrived = noteQuestionInFlight(params.query, () =>
      creating && !named ? '/' : undefined,
    );

    try {
      yield* this.#stream(params, conversationId, corpusKey, askedOf, made);
    } finally {
      arrived();
      // A question that failed or was stopped before the BFF named a conversation leaves the thread
      // waiting: it is still a stand-in, and the next question asked in it (a retry or a new one)
      // makes it. Settling here would leave the address on the stand-in for good.
      if (named && creation === creating) creation = undefined;
    }
  }

  async *#stream(
    params: AskParams,
    conversationId: string | undefined,
    corpusKey: string | undefined,
    askedOf: { corpusKey?: string },
    made: (id: string) => void,
  ): AsyncGenerator<StreamEvent> {
    const state = new BffTurnState();
    const aborted = (): ChatError => ({ code: 'aborted' });

    let response: Response;
    try {
      const filter = await this.#filter(params.filters, corpusKey);
      const body: BffAskRequest = {
        query: params.query,
        ...(conversationId ? { conversationId } : {}),
        ...(params.model ? { model: params.model } : {}),
        ...(filter ? { filter } : {}),
      };
      response = await this.#fetch('/ask', {
        method: 'POST',
        signal: params.signal,
        headers: { Accept: 'text/event-stream' },
        body: JSON.stringify(body),
      });
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? aborted()
          : { code: 'unknown', message: 'Fikk ikke kontakt med tjenesten.' },
        ...askedOf,
      };
      return;
    }

    if (!response.ok) {
      yield { type: 'error', error: await errorFromResponse(response), ...askedOf };
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

    try {
      for (;;) {
        const { done, value } = await reader.read();
        const frames = done ? decoder.flush() : decoder.push(value ?? '');

        for (const frame of frames) {
          let event: BffTurnEvent;
          try {
            event = JSON.parse(frame.data) as BffTurnEvent;
          } catch {
            continue;
          }
          if (event.type === 'conversation') made(event.id);

          const translated = state.read(event, askedOf);
          yield* translated;
          if (translated.some((out) => out.type === 'done' || out.type === 'error')) return;
        }

        if (done) break;
      }
    } catch {
      yield {
        type: 'error',
        error: params.signal?.aborted
          ? aborted()
          : { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
        ...askedOf,
      };
      return;
    } finally {
      await reader.cancel().catch(() => {});
    }

    // The BFF always ends with `done` or `error`. A stream that stops without either was cut off.
    yield {
      type: 'error',
      error: { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
      ...askedOf,
    };
  }

  // Throws when the list cannot be read: an empty list is a real answer, and `useThreadList` keeps
  // the last good list on failure.
  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    const { conversations } = await this.#json<{ conversations?: BffConversationSummary[] }>(
      '/conversations',
      signal,
    );
    const corpusKey = this.#corpusKey();
    return (conversations ?? []).map((summary) => threadFromSummary(summary, corpusKey));
  }

  // Null on 404 («Fant ikke tråden»); throws on other failures, since the thread may exist. Adds
  // the filter the BFF locked the thread to, by dimension.
  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    const response = await this.#fetch(`/conversations/${encodeURIComponent(threadId)}`, {
      signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`/conversations ${response.status}`);
    const detail = (await response.json()) as BffConversationDetail;
    if (!detail.conversation) return null;

    const corpusKey = this.#corpusKey();
    const thread = threadDetailFromBff(detail, corpusKey);
    const filter = detail.filter
      ? selectionFromBff(detail.filter, await this.#fields(corpusKey))
      : undefined;
    return filter ? { ...thread, filter } : thread;
  }

  // None when the BFF says its backend cannot filter; throws when the BFF cannot be reached, so the
  // panel can offer a retry.
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    const { capabilities: can } = await this.#capabilities(true, signal);
    // The probe is not the caller's to cancel (see above), so the caller's own abort is honoured
    // here: the panel drops a stale answer by it.
    signal?.throwIfAborted();
    if (!can.filters) return [];
    const facets = await this.#facets(signal);
    return facetsFrom(facets, this.#fieldsFor(facets, this.#corpusKey()), selection);
  }

  // Each call may fail alone: without `/api/me` there is no default, without `/api/models` no
  // choice to show.
  async listAgents(signal?: AbortSignal): Promise<AgentList> {
    const [models, me] = await Promise.all([
      this.#json<BffModels>('/models', signal).catch((): BffModels => ({})),
      this.#json<BffMe>('/me', signal).catch((): BffMe => ({})),
    ]);
    // The same answer says who is signed in, which a draft kept at a 401 is tied to (session.ts).
    noteSignedIn(me.userId);
    return agentsFromBff(models.agents, me.tool);
  }
}

// An HTTP error from `/api/ask` as a code, with this client's own sentence where it has one. The
// BFF's text is never shown as it stands; `errorFromBackend` translates what it can.
async function errorFromResponse(response: Response): Promise<ChatError> {
  const fromStatus = errorFromStatus(response.status);
  if (fromStatus.code !== 'unknown') return fromStatus;
  const body = (await response.json().catch(() => ({}))) as Partial<BffFilterRefused> & {
    error?: unknown;
  };
  // The panel says so before it gets this far; this is the BFF refusing what a panel let through,
  // in words this client wrote. Its own code, so the reader is told what to change and is not
  // offered a «Prøv igjen» that sends the same filter to the same refusal.
  if (body.code === 'filter-too-many-values') {
    return { code: 'filter-refused', message: FILTER_REFUSED_MESSAGES.tooManyValues };
  }
  if (body.code === 'filter-invalid-value') {
    return { code: 'filter-refused', message: FILTER_REFUSED_MESSAGES.invalidValue };
  }
  if (body.code === 'filter-unknown-field') {
    return { code: 'filter-refused', message: FILTER_REFUSED_MESSAGES.unknownField };
  }
  if (typeof body.error !== 'string' || !body.error.trim()) return fromStatus;
  const fromText = errorFromBackend(body.error);
  return fromText.code === 'unknown' && !fromText.message ? fromStatus : fromText;
}
