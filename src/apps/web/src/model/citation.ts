/**
 * A `[n]` marker, resolved to the excerpt it points at. `number` indexes the
 * flat excerpt list in arrival order — observed, not promised by the backend,
 * so an unresolvable marker is plain text, not a broken link.
 */
export interface Citation {
  /** 1-indexed, as written in the answer text. */
  number: number;
  excerptId: string;
  documentId: string;
  /** Character range in `Message.content` the marker attaches to. Not provided yet. */
  span?: { start: number; end: number };
}
