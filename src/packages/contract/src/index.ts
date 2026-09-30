export interface Source {
  docNum: string;
  title: string;
  url: string;
  /** 1-based, matching the `[N]` markers in the answer text. */
  marker: number;
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
  message: string;
  conversationId?: string;
}

export type TurnEvent =
  ConversationEvent | StageEvent | DeltaEvent | SourcesEvent | DoneEvent | ErrorEvent;

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
