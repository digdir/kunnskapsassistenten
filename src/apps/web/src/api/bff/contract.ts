// The BFF wire format, copied from `src/packages/contract/src/index.ts` in
// digdir/kunnskapsassistenten (branch `feat/ny-klient`) under `Bff` names; a copy because the
// package is unpublished (src/decisions/0005). Types the package lacks say so where they are.

import type { FilterDimension } from '../../model';

export interface BffSource {
  docNum: string;
  title: string;
  url: string;
  /** 1-based and one per CHUNK, which is what `[N]` in the answer counts. */
  marker: number;
  /** The chunk this marker points at, when the backend named it. */
  chunkId?: string;
  /** The passage. Absent when the BFF could not look it up. */
  excerpt?: string;
}

export type BffStage = 'starting' | 'searching' | 'reading' | 'writing' | 'done';

export type BffTurnEvent =
  | { type: 'conversation'; id: string; topic: string }
  | {
      type: 'stage';
      stage: BffStage;
      iteration: number;
      maxIterations: number;
      queries?: string[];
    }
  /** The agent's own words, one per `agent/thinking`; `stage` only names the phase. */
  | { type: 'thinking'; reasoning: string }
  /** One per tool call, not per `agent/turn-completed` frame, which can carry several. */
  | {
      type: 'tool-call';
      tool: string;
      detail?: string;
      queries?: string[];
      durationMs?: number;
      chunkCount?: number;
    }
  | { type: 'delta'; text: string }
  | { type: 'sources'; sources: BffSource[] }
  | { type: 'done'; conversationId: string; insufficient: boolean }
  | { type: 'error'; message: string; code?: string; conversationId?: string };

/** `POST /api/ask`. `filter` is keyed by the corpus's own field names. */
export interface BffAskRequest {
  query: string;
  conversationId?: string;
  model?: string;
  filter?: Record<string, string[]>;
}

/** One mode of an agent in `GET /api/models`. */
export interface BffAgentMode {
  /** The backend's tool name, which is what `model` in `POST /api/ask` takes. */
  id: string;
  label: string;
  isDefault: boolean;
}

/** One agent in `GET /api/models`, as the BFF groups `/v1/models` (`toAgents`). */
export interface BffAgentOption {
  id: string;
  label: string;
  description?: string;
  modes: BffAgentMode[];
}

/**
 * `GET /api/models`, not in the package. `{ models: [] }` and `{ agents: [] }` both mean none.
 * Calling it also sets which `model` values the BFF accepts (`setAllowedTools` in its `mcp.ts`).
 */
export interface BffModels {
  agents?: BffAgentOption[];
}

/** `GET /api/me`, not in the package. `tool` is the tool the BFF answers with by default. */
export interface BffMe {
  tool?: string;
  /** Who is signed in, as the BFF names them to the backend. */
  userId?: string;
}

/**
 * `GET /api/conversations` wraps these in `{ conversations }`, which the package does not declare.
 */
export interface BffConversationSummary {
  id: string;
  topic: string;
  /** Epoch milliseconds. */
  created: number;
}

export interface BffMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  created: number;
  /** A turn the backend stored as failed (digdir/digdir-headless-rag#22); the text is empty. */
  failed?: boolean;
}

/** `GET /api/conversations/:id`. */
export interface BffConversationDetail {
  conversation: BffConversationSummary;
  messages: BffMessage[];
  /**
   * The last answer's sources, from the BFF's memory (gone after a restart). Not in the package.
   */
  sources?: BffSource[];
  /** The filter the thread was started with. The BFF holds it for the thread. */
  filter?: Record<string, string[]>;
}

/**
 * One entry of `GET /api/facets`. `id` and `valueType` come from the BFF's `KA_FILTER_FIELDS`;
 * an older BFF sends no `id`, so `fieldsFromFacets` still checks (src/decisions/0006).
 */
export interface BffFacet {
  /** Which of the three dimensions. */
  id: FilterDimension;
  field: string;
  valueType?: 'integer' | 'string';
  /** Norwegian noun in lower case: «dokumenttyper», «år». */
  label: string;
  options: { value: string; count: number }[];
}

/** The dataset the BFF answers from, as its `KA_DATASETS` names it. */
export interface BffDataset {
  key: string;
  label: string;
  description?: string;
}

/** `GET /api/capabilities`. */
export interface BffCapabilities {
  capabilities: { filters: boolean; othersThreads: boolean; threadTitles: boolean };
  /** False until the BFF's startup probe of the backend has finished. */
  settled: boolean;
  dataset?: BffDataset;
}

/** `400` from `POST /api/ask` when a value is one the backend refuses. */
export interface BffFilterInvalidValue {
  error: string;
  code: 'filter-invalid-value';
  field: string;
}

/**
 * `400` from `POST /api/ask` when the filter has a key that is not one of the corpus's field names
 * (`field` in `/api/facets`), such as a dimension id.
 */
export interface BffFilterUnknownField {
  error: string;
  code: 'filter-unknown-field';
  field: string;
}

/** `400` from `POST /api/ask` when one field has more values than the backend takes. */
export interface BffFilterTooManyValues {
  error: string;
  code: 'filter-too-many-values';
  field: string;
  max: number;
}

/** A filter the BFF refused, told apart by `code`. */
export type BffFilterRefused =
  BffFilterInvalidValue | BffFilterUnknownField | BffFilterTooManyValues;
