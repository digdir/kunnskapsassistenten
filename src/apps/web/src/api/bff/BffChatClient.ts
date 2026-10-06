import type {
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
import { keepDraft, noteQuestionInFlight } from '../session';
import type {
  BffAskRequest,
  BffCapabilities,
  BffConversationDetail,
  BffConversationSummary,
  BffFacet,
  BffFilterRefused,
  BffTurnEvent,
} from './contract';
import { facetsFrom } from '../facets';
import {
  BffTurnState,
  fieldsFromFacets,
  filterBody,
  selectionFromBff,
  threadDetailFromBff,
  threadFromSummary,
} from './mapping';

export type BffChatClientOptions = {
  /** Where the BFF's API is. Relative: the BFF serves this client itself. */
  basePath?: string;
  /**
   * Which corpus the BFF answers from, read per call as in live.
   *
   * The BFF serves one dataset, set in its own environment, and this does not
   * choose it — nothing on the wire says which one it is. It is the
   * deployment's statement of the same thing, and it is used for two jobs:
   * the field names in `VITE_KA_FILTER_FIELDS`, and saying which corpus an
   * answer came from.
   */
  datasetConfigKey?: () => string | undefined;
  /** Defaults to the deployment's configuration, as in live. */
  filterFields?: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  /**
   * What a 401 does, with the address to come back to. Defaults to the BFF's
   * own sign-in, which comes back there. An option so a test can see it
   * happen.
   */
  onUnauthorized?: (returnTo: string) => void;
  /**
   * How long to wait between asking whether the BFF's startup probe has
   * finished. See `#capabilities` and `SETTLE_DELAYS_MS`.
   */
  settleDelaysMs?: number[];
};

let redirecting = false;

/**
 * To the BFF's sign-in, and back to `returnTo`: where the reader was, or where
 * the draft kept for them belongs (session.ts, `keepDraft`).
 *
 * Once per page: several calls fail with 401 at once when a session runs
 * out, and one navigation is enough. Not from `/auth/` itself, which would
 * loop.
 */
function toLogin(returnTo: string): void {
  if (redirecting || window.location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  window.location.assign(`/auth/login?next=${encodeURIComponent(returnTo)}`);
}

/**
 * The conversation the questions that follow belong to. Module state for the
 * reason it is in live (LiveChatClient.ts): the shell and the chat view each
 * build a client, and they have to agree.
 */
let openConversation: string | undefined;

/**
 * A thread the shell is waiting to hear the real id of.
 *
 * The BFF has no endpoint that makes a conversation. `POST /api/ask` does it,
 * and says so in its first event. So `createThread` cannot make one — it
 * waits for the question that is about to be asked, and the `conversation`
 * event of that question is its answer. The shell calls it a tick before it
 * asks (ChatSlotView.tsx), which is why this is a promise and not a callback
 * the ask looks for.
 */
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

/**
 * The BFF's facets, once it has given some. Kept for the page's life, like
 * the probe: they are a corpus's, and the BFF itself holds them ten minutes.
 * An empty answer is not kept, because that is also what a BFF without
 * Typesense says.
 */
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
  redirecting = false;
}

/**
 * How long the filter panel waits for the BFF's startup probe, between asks.
 *
 * Quicker at first, then every 15 seconds for as long as the BFF says the
 * probe is still out (see `#capabilities`). One search in the probe took
 * 12–15 seconds at load 29, and the probe retries for about nine minutes
 * before it decides (#4, 29.09). The first version gave up after 12 seconds,
 * and a page loaded while the BFF was slow then had a dead panel for good.
 * While it waits, the panel says «Henter filtre».
 */
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
 * The client against Nikolai's BFF (`apps/server` in digdir/kunnskapsassistenten).
 *
 * The BFF holds the API key and the sign-in, and the identity comes from the
 * session cookie rather than from anything this client sends — so there is
 * no `X-User-Id` here, and no tenant or dataset on the wire. The browser
 * sends a question; the server decides what it is asked of
 * (src/decisions/0005-client-behind-the-bff.md).
 */
export class BffChatClient implements ChatClient {
  readonly #basePath: string;
  readonly #corpusKey: () => string | undefined;
  readonly #filterFields: (datasetKey: string | undefined) => DatasetFilterFields | undefined;
  readonly #onUnauthorized: (returnTo: string) => void;
  readonly #settleDelaysMs: number[];

  constructor(options: BffChatClientOptions = {}) {
    this.#basePath = options.basePath ?? '/api';
    this.#corpusKey = options.datasetConfigKey ?? (() => undefined);
    this.#filterFields = options.filterFields ?? filterFieldsFor;
    this.#onUnauthorized = options.onUnauthorized ?? toLogin;
    this.#settleDelaysMs = options.settleDelaysMs ?? SETTLE_DELAYS_MS;
  }

  /**
   * Every call goes through here, so a 401 anywhere leads to sign-in, with
   * what the reader had written kept for when they are back (session.ts).
   */
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

  /**
   * What the BFF can do.
   *
   * It probes the backend when it starts, and until that is done it says
   * `filters: false` with `settled: false`. A settled answer is kept; an
   * unsettled one is not, so the next call asks afresh.
   *
   * `patient` is for the filter panel, which is drawn once and would
   * otherwise say «no filters» for good to a page loaded in the seconds the
   * probe takes. So it asks again a few times before it believes it. A
   * question does not wait like that: it asks once, and without a settled yes
   * it goes without the filter — the panel had none to offer anyway.
   *
   * No abort signal, on purpose. The answer is shared, and one caller giving
   * up must not decide it for the others.
   */
  async #capabilities(patient = false, signal?: AbortSignal): Promise<BffCapabilities> {
    if (settledCapabilities) return settledCapabilities;

    const delays = patient ? this.#settleDelaysMs : [];
    for (let attempt = 0; ; attempt += 1) {
      let reached = true;
      const found = await this.#json<BffCapabilities>('/capabilities').catch(() => {
        reached = false;
        return NOT_SETTLED;
      });
      // The corpus is the deployment's and not the probe's, so an unsettled
      // answer names it as well as a settled one.
      if (found.dataset) adoptServerCorpus(found.dataset);
      if (found.settled) {
        settledCapabilities = found;
        return found;
      }
      // Past the first delays, the panel keeps asking at the last one for as
      // long as the BFF says its probe is still out: the probe retries for
      // about nine minutes before it decides (#4's bff/infra-rettelser). A
      // BFF that cannot be reached is not waited for like that; the panel
      // gets an error it can offer «Prøv igjen» on.
      const delay = delays[attempt] ?? (reached ? delays.at(-1) : undefined);
      if (delay === undefined) {
        if (patient && delays.length > 0 && !reached) throw new Error('/capabilities unreachable');
        return found;
      }
      await wait(delay, signal);
    }
  }

  /**
   * Ask the deployment for its corpus, once per page, without waiting for the
   * answer. The shell calls it when it builds the client, so the corpus's
   * name is there before anyone opens the filter panel.
   */
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

  /**
   * The corpus's field names per dimension: the BFF's own when it tags its
   * facets (D16), and this build's configuration for a BFF that does not.
   */
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

  /**
   * Which conversation the next question belongs to.
   *
   * `conversationId`, as in live — and for `id-only`, the id itself. That is
   * the shell saying «the address names this thread, it has not been read
   * yet»; the address is `/threads/<conversation id>`, so the id is the one
   * thing about it that is certain, and it is the conversation's.
   */
  openThread(thread: Thread, certainty?: ThreadCertainty): void {
    openConversation = thread.conversationId ?? (certainty === 'id-only' ? thread.id : undefined);
  }

  /**
   * The thread as the BFF names it, once the question that makes it has been
   * asked. See `creation`.
   */
  async createThread(thread: Thread): Promise<Thread | undefined> {
    openConversation = undefined;
    const id = await awaitCreation().promise;
    return id ? { ...thread, id, conversationId: id } : undefined;
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const corpusKey = this.#corpusKey();
    const askedOf = corpusKey ? { corpusKey } : {};
    const conversationId = params.conversationId ?? openConversation;
    // A question with no conversation makes one, and a thread may be waiting
    // to hear what it is called. It hears it the moment the BFF says, not
    // when the answer is done: the address should not wait for fifteen
    // seconds of answer.
    const creating = conversationId ? undefined : awaitCreation();
    let named = false;
    const made = (id: string) => {
      named = true;
      openConversation = id;
      creating?.settle(id);
    };
    // The field is empty by now, so a 401 before the answer has to keep the
    // question itself. Any 401 while it is out, not only the one on `/ask`:
    // the filter can ask for the capabilities and the facets first. A
    // question that starts a thread belongs on the front page until the BFF
    // has named its conversation: the address it is under until then is a
    // stand-in that leads nowhere after the sign-in.
    const arrived = noteQuestionInFlight(params.query, () =>
      creating && !named ? '/' : undefined,
    );

    try {
      yield* this.#stream(params, conversationId, corpusKey, askedOf, made);
    } finally {
      arrived();
      if (creating) {
        // Nothing was made if the BFF never said so. Settling twice is a
        // no-op, so this only matters for a question that failed first.
        creating.settle(undefined);
        if (creation === creating) creation = undefined;
      }
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

    // The BFF always ends with `done` or `error`. A stream that stops without
    // either was cut off somewhere between the two.
    yield {
      type: 'error',
      error: { code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' },
      ...askedOf,
    };
  }

  /** The reader's conversations, newest first. Empty on failure, as in live. */
  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    try {
      const { conversations } = await this.#json<{ conversations?: BffConversationSummary[] }>(
        '/conversations',
        signal,
      );
      const corpusKey = this.#corpusKey();
      return (conversations ?? []).map((summary) => threadFromSummary(summary, corpusKey));
    } catch {
      return [];
    }
  }

  /**
   * Null for «not there» and «could not ask», as in live.
   *
   * With the filter the BFF has locked the thread to, by dimension, so the
   * panel and «Avgrenset til» can say what the answers were asked with.
   */
  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    let detail: BffConversationDetail;
    try {
      detail = await this.#json<BffConversationDetail>(
        `/conversations/${encodeURIComponent(threadId)}`,
        signal,
      );
    } catch {
      return null;
    }
    if (!detail.conversation) return null;

    const corpusKey = this.#corpusKey();
    const thread = threadDetailFromBff(detail, corpusKey);
    const filter = detail.filter
      ? selectionFromBff(detail.filter, await this.#fields(corpusKey))
      : undefined;
    return filter ? { ...thread, filter } : thread;
  }

  /**
   * The facets the BFF counts, as the filter panel's dropdowns — or none when
   * the BFF says its backend cannot filter, which the panel draws as
   * «Filtrering er ikke tilgjengelig ennå».
   *
   * Throws when the BFF cannot be reached, so the panel can offer to try again.
   */
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    const { capabilities: can } = await this.#capabilities(true, signal);
    // The probe is not the caller's to cancel (see above), so the caller's
    // own abort is honoured here — the panel drops a stale answer by it.
    signal?.throwIfAborted();
    if (!can.filters) return [];
    const facets = await this.#facets(signal);
    return facetsFrom(facets, this.#fieldsFor(facets, this.#corpusKey()), selection);
  }
}

/**
 * An HTTP error from `/api/ask`, as a code — and, when the BFF's sentence is
 * one this client knows, a sentence of its own. The BFF's text is read like
 * the backend's and never shown as it stands: most of it is written for
 * whoever runs the service, and what is not («Spørsmålet er for langt (maks
 * 2000 tegn).») is translated in `errorFromBackend`, so the screen only ever
 * says what this client wrote.
 */
async function errorFromResponse(response: Response): Promise<ChatError> {
  const fromStatus = errorFromStatus(response.status);
  if (fromStatus.code !== 'unknown') return fromStatus;
  const body = (await response.json().catch(() => ({}))) as Partial<BffFilterRefused> & {
    error?: unknown;
  };
  // The panel says so before it gets this far (#2); this is the BFF refusing
  // what a panel let through, in words this client wrote.
  // Its own code, so the reader is told what to change and is not offered a
  // «Prøv igjen» that sends the same filter to the same refusal.
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
