/**
 * The wire format between the browser and Nikolai's BFF, as that server
 * writes it.
 *
 * Copied from `src/packages/contract/src/index.ts` in digdir/kunnskapsassistenten,
 * branch `feat/ny-klient` (`9172aeb`), and only the parts this client reads.
 * A copy and not a dependency, because the package is not published: the day
 * this client moves into that repo as `apps/web`, the import replaces this
 * file (docs/arkitektur/0002-klienten-bak-bff.md).
 *
 * The shapes are the package's, under names with `Bff` in front, so that
 * import is a list of `Source as BffSource` and nothing else changes. One
 * field is here and not there: `sources` on `BffConversationDetail`, which
 * the BFF on that branch sends and the package does not declare yet.
 *
 * The `{ conversations }` around the list is not in the package; it is read
 * off `apps/server/src/server.ts` and checked against a running BFF on
 * 2026-09-28 — see the fixtures beside this file.
 */

import type { FilterDimension } from '../../model';

export interface BffSource {
  docNum: string;
  title: string;
  url: string;
  /**
   * 1-based, and ONE PER CHUNK, which is what `[N]` in the answer counts.
   *
   * It used to be one per document, with a document's chunks joined into a
   * single excerpt. The two only agreed when every document gave exactly one
   * chunk: measured against kudos-full 2026-09-29, a question returned eight
   * chunks of the same document and the answer cited `[1]`..`[8]`, while the
   * BFF offered one source with marker 1.
   */
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
  /**
   * The agent's own words about what it is doing, one per `agent/thinking`.
   *
   * `stage` says which phase the agent is in and nothing about what it did.
   * That was all the BFF sent, so the panel drew four fixed sentences, while
   * live — reading the same frames straight from the backend — showed the
   * agent's reasoning, what each tool call found and how long it took.
   */
  | { type: 'thinking'; reasoning: string }
  /**
   * One tool call, as `agent/turn-completed` reported it. One per call and
   * not per frame: a frame carries several, and three `read_chunks` in a row
   * is ordinary.
   */
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
}

/** `GET /api/conversations/:id`. */
export interface BffConversationDetail {
  conversation: BffConversationSummary;
  messages: BffMessage[];
  /**
   * The LAST answer's sources, kept in the BFF's memory. Empty after a
   * restart, and never there for the earlier answers.
   *
   * Not in the package's `ConversationDetail`, but the BFF on `feat/ny-klient`
   * sends it (`sourceStore.recall` in `apps/server/src/server.ts`).
   */
  sources?: BffSource[];
  /** The filter the thread was started with. The BFF holds it for the thread. */
  filter?: Record<string, string[]>;
}

/**
 * One entry of `GET /api/facets`.
 *
 * `id` and `valueType` come from the BFF's `KA_FILTER_FIELDS` (D16, the pod's
 * `bff/filterkjede`). That BFF sends only the fields it has an id for, so the
 * package has `id` as required, and so does this copy.
 *
 * The BFF on `8639267` predates it and sends no `id`. `fieldsFromFacets`
 * still checks for one, and without it the field names come from this build
 * (docs/arkitektur/0003).
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
 * `400` from `POST /api/ask` when the filter has a key that is not one of the
 * corpus's field names (`field` in `/api/facets`), such as a dimension id.
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
