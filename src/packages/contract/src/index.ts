/**
 * One retrieved chunk, in the order the agent retrieved them.
 *
 * ONE PER CHUNK, not one per document, because `[N]` in the answer is the
 * agent's 1-based index into its flat chunk list. Grouping the chunks by
 * document first and numbering the documents made the two agree only when
 * every document gave exactly one chunk: measured 2026-09-29 against
 * kudos-full, one question returned eight chunks of the same document and the
 * answer cited `[1]`..`[8]`, while the grouped form offered a single source
 * with marker 1 — so `[2]`..`[8]` pointed at nothing and `[1]` pointed at all
 * eight passages glued together.
 *
 * The client groups them back into documents for display, which is what it
 * already does for the chunks it reads straight from the backend.
 */
export interface Source {
  docNum: string;
  title: string;
  url: string;
  /** 1-based, matching the `[N]` markers in the answer text. One per chunk. */
  marker: number;
  /** The chunk this marker points at, when the backend named it. */
  chunkId?: string;
  /** The passage itself. Absent when it could not be looked up. */
  excerpt?: string;
}

export type Stage = 'starting' | 'searching' | 'reading' | 'writing' | 'done';

export interface StageEvent {
  type: 'stage';
  stage: Stage;
  iteration: number;
  maxIterations: number;
  queries?: string[];
}

/**
 * The agent's own words, on its way to an answer.
 *
 * `stage` says which phase the agent is in and nothing about what it did.
 * That was all the client had, so it drew four fixed sentences while the
 * live client — reading the same backend frames directly — showed the
 * agent's reasoning in its own Norwegian, what each tool call found, and how
 * long it took. Measured 2026-09-29 with the same question: live gave three
 * reasoning steps and a `result-summary` under each call; through this server
 * the reader got «Jeg søker i dokumentene.» and nothing else.
 *
 * Passed on as it comes, and not turned into display text here: the sentences
 * the reader sees are Norwegian and belong to the client, which already
 * writes them for the live path.
 */
export interface ThinkingEvent {
  type: 'thinking';
  /** What the agent said it was about to do, in its own words. */
  reasoning: string;
}

/**
 * One tool call the agent ran, as `agent/turn-completed` reported it.
 *
 * One event per call and not per phase: a single frame carries several calls
 * — three `read_chunks` in a row is ordinary — and the reader is meant to see
 * each of them, as the live client does.
 */
export interface ToolCallEvent {
  type: 'tool-call';
  /** `search`, `read_chunks`, `plan_queries`, `generate_response`, … */
  tool: string;
  /** The backend's `result-summary`: what the call found, in English. */
  detail?: string;
  /** The search strings the call actually ran. */
  queries?: string[];
  durationMs?: number;
  /** How many chunks the call asked to read, when it asked for any. */
  chunkCount?: number;
}

export interface DeltaEvent {
  type: 'delta';
  text: string;
}

export interface SourcesEvent {
  type: 'sources';
  sources: Source[];
}

export interface ConversationEvent {
  type: 'conversation';
  id: string;
  topic: string;
}

export interface DoneEvent {
  type: 'done';
  conversationId: string;
  insufficient: boolean;
}

export interface ErrorEvent {
  type: 'error';
  /**
   * What went wrong, in this server's own words. An error the backend
   * reported is a fixed sentence, and the backend's text goes to this
   * server's log, never to the browser.
   */
  message: string;
  /**
   * What kind of failure it was, when that is known.
   *
   * The client writes the reader's two sentences from the code, so a code is
   * the only way it can tell «the language model did not answer» from «the
   * search did not answer» — two cases that ask the reader for opposite
   * things. Without one it has to guess from English prose, and everything it
   * cannot place becomes the same catch-all sentence.
   *
   * Either the backend's own code, passed through untouched, or one of the
   * names this server uses for what it knows by itself:
   * `backend_unreachable`, `backend_http_<status>`, `stream_broken`,
   * `request_aborted`.
   */
  code?: string;
  conversationId?: string;
}

export type TurnEvent =
  | ConversationEvent
  | StageEvent
  | ThinkingEvent
  | ToolCallEvent
  | DeltaEvent
  | SourcesEvent
  | DoneEvent
  | ErrorEvent;

export interface AskRequest {
  query: string;
  model?: string;
  conversationId?: string;
  /**
   * Keyed by `FacetField.field`. A field with every value selected is the
   * same as no filter on it, and is left out.
   */
  filter?: Record<string, string[]>;
}

/** The three filter dimensions the client draws. */
export type FilterFieldId = 'documentType' | 'organisation' | 'year';

export interface FacetOption {
  value: string;
  /** Documents in the whole corpus with this value, as Typesense counts them. */
  count: number;
}

/** One filter field, as `KA_FILTER_FIELDS` configures it for this dataset. */
export interface FacetField {
  id: FilterFieldId;
  /** The corpus's own field name, and the key in `AskRequest.filter`. */
  field: string;
  /** `value-type` on the backend's filter, for a field that is not text. */
  valueType?: 'integer' | 'string';
  /** Norwegian noun in lower case, for a sentence: «dokumenttyper». */
  label: string;
  /** Every value in the corpus, not a top N. */
  options: FacetOption[];
}

export interface FacetsResponse {
  facets: FacetField[];
}

/** The dataset this BFF answers from, as `KA_DATASETS` names it. */
export interface DatasetInfo {
  key: string;
  label: string;
  description?: string;
}

export interface CapabilitiesResponse {
  capabilities: Capabilities;
  settled: boolean;
  dataset?: DatasetInfo;
}

/** `400` from `POST /api/ask` when a value is one the backend refuses. */
export interface FilterInvalidValue {
  error: string;
  code: 'filter-invalid-value';
  field: string;
}

/**
 * `400` from `POST /api/ask` when the filter has a key that is not one of the
 * corpus's field names (`field` in `/api/facets`), such as a facet id.
 */
export interface FilterUnknownField {
  error: string;
  code: 'filter-unknown-field';
  field: string;
}

/** `400` from `POST /api/ask` when one field has more values than the backend takes. */
export interface FilterTooManyValues {
  error: string;
  code: 'filter-too-many-values';
  field: string;
  max: number;
}

export interface ConversationSummary {
  id: string;
  topic: string;
  created: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  created: number;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: Message[];
  filter?: Record<string, string[]>;
}

export interface AgentMode {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface AgentOption {
  id: string;
  label: string;
  description?: string;
  modes: AgentMode[];
}

export interface Capabilities {
  filters: boolean;
  othersThreads: boolean;
  threadTitles: boolean;
}
