/**
 * «Fremgangsmåte»: what the search actually did. A placeholder for now: the
 * backend does not send `structuredContent.queries` or `search_attribution`,
 * so nothing here is reliable yet.
 */
export interface RetrievalDetails {
  /** Chunks RETRIEVED, not cited: «10 treff» beside five sources is correct, not a bug. */
  hitCount: number;
  /** Number of distinct documents those hits came from. */
  documentCount: number;
  /** «Nøkkelord som ble brukt i søket». Not clickable. */
  keywords: string[];
}

/**
 * One step of what the agent did, shown while the answer streams. From
 * `agent/turn-completed` tool calls and `agent/thinking`; labels are the
 * agent's own Norwegian.
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
