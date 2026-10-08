/**
 * «Fremgangsmåte»: what the search actually did, so the user never has to
 * wonder what is going on.
 *
 * v1 is a frontend placeholder (answer 11). The numbers below exist in the
 * stream as `agent/turn-completed`, but `structuredContent.queries` and
 * `search_attribution` were measured absent, so nothing here is reliable yet.
 * backend: mangler, se API-bestilling A2 for the facet side of the same hole.
 */
export interface RetrievalDetails {
  /**
   * Number of relevant excerpts the search found. One hit is one chunk
   * (answer 12). This counts what was RETRIEVED, not what the answer cited —
   * the answer normally uses fewer, and «10 treff» beside five sources is
   * therefore correct, not a bug.
   */
  hitCount: number;
  /** Number of distinct documents those hits came from. */
  documentCount: number;
  /** «Nøkkelord som ble brukt i søket». Not clickable (answer 13). */
  keywords: string[];
}

/**
 * What the agent did, one step at a time. Rendered as the thinking steps
 * while the answer streams.
 *
 * `search` and `read` come from `agent/turn-completed` tool calls, `reasoning`
 * from `agent/thinking`. The agent writes its reasoning in Norwegian first
 * person, so `label` and `detail` are display text as they arrive.
 */
export type ThinkingStepKind = 'reasoning' | 'search' | 'read' | 'finalizing';

export interface ThinkingStep {
  id: string;
  kind: ThinkingStepKind;
  /** Norwegian, shown to the user. */
  label: string;
  /** Longer text under the label, when the step has one. */
  detail?: string;
  /** Search strings the agent actually ran, for `search` steps. */
  queries?: string[];
  durationMs?: number;
}
