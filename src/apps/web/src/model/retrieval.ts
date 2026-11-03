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

/**
 * What one tool call found, read out of the backend's own report of it
 * (`result-summary`). Each field is there only when the report said it, so
 * «Fremgangsmåte» never draws a number the backend did not send.
 */
export interface StepFindings {
  /** The question as the agent restated it before it searched (`plan_queries`). */
  restatedQuestion?: string;
  /** Hits this search had not seen before in the turn. Summed, they are all the turn found. */
  newHits?: number;
  /** The values the backend narrowed this search to on its own, not the reader («Auto-filtered by»). */
  autoFilter?: string[];
  /** Excerpts this call read. */
  excerptsRead?: number;
  /** The documents this call read, by title, as far as the report names them. */
  documentsRead?: string[];
  /** The report names fewer excerpts than were read: it is cut off, so other documents may be missing. */
  documentsPartial?: boolean;
  /** The read was refused because the turn's read budget was spent. */
  readRefused?: boolean;
}

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
  /** The backend's name for the tool, for steps that are tool calls (`search`, `read_chunks`). */
  tool?: string;
  /** What the call found. Absent on steps stored before the field existed. */
  findings?: StepFindings;
}
