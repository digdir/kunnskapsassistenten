/**
 * A `[n]` marker in an answer, resolved to the excerpt it points at.
 *
 * `number` is 1-indexed into the flat excerpt list of the answer, in the
 * order the excerpts came back. That mapping is observed, not promised by the
 * contract — see gap 3 in design/eksisterende/api-for-frontend.md — so treat
 * an unresolvable marker as plain text rather than a broken link.
 *
 * Sentence-level attribution (which sentence a marker belongs to) does not
 * exist yet.
 * backend: mangler, se API-bestilling A1
 */
export interface Citation {
  /** 1-indexed, as written in the answer text. */
  number: number;
  excerptId: string;
  documentId: string;
  /**
   * Character range in `Message.content` the marker attaches to.
   * backend: mangler, se API-bestilling A1
   */
  span?: { start: number; end: number };
}
