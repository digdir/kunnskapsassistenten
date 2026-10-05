/**
 * The wire format between the browser and Nikolai's BFF, as that server
 * writes it.
 *
 * Copied from `packages/contract/src/index.ts` in digdir/kunnskapsassistenten
 * (`8639267`), and only the parts this client reads. A copy and not a
 * dependency, because the package is not published: the day this client
 * moves into that repo as `apps/web`, the import replaces this file
 * (docs/arkitektur/0002-klienten-bak-bff.md).
 *
 * The response shapes around the types (`{ conversations }`, `{ facets }`,
 * `{ capabilities, settled }`) are not in the package; they are read off
 * `apps/server/src/server.ts` and checked against a running BFF on
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
   * Agentens egne ord om hva den holder på med, ett per `agent/thinking`.
   *
   * `stage` sier hvilken fase agenten er i og ingenting om hva den gjorde.
   * Det var alt BFF-en sendte, så panelet fikk fire faste setninger, mens
   * live — som leser de samme rammene rett fra backenden — viste agentens
   * resonnement, hva hvert verktøykall fant og hvor lang tid det tok.
   */
  | { type: 'thinking'; reasoning: string }
  /**
   * Ett verktøykall, slik `agent/turn-completed` meldte det. Ett per kall og
   * ikke per ramme: en ramme bærer flere, og tre `read_chunks` på rad er
   * vanlig.
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
   */
  sources?: BffSource[];
  /** The filter the thread was started with. The BFF holds it for the thread. */
  filter?: Record<string, string[]>;
}

/**
 * One entry of `GET /api/facets`.
 *
 * `id` and `valueType` come from the BFF's `KA_FILTER_FIELDS` (D16, the pod's
 * `bff/filterkjede`). A BFF without them is the one on `8639267`, and then the
 * field names come from this build instead (docs/arkitektur/0003).
 */
export interface BffFacet {
  /** Which of the three dimensions. */
  id?: FilterDimension;
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

/**
 * `400` from `POST /api/ask` for a filter the backend would refuse: more
 * values in one field than it takes, or a value it does not accept.
 */
export interface BffFilterRefused {
  error: string;
  code: 'filter-too-many-values' | 'filter-invalid-value';
  field: string;
  max?: number;
}
