/** A `[n]` marker, resolved to one excerpt, or to a whole document when `excerptId` is absent. */
export interface Citation {
  /** 1-indexed, as written in the answer text. */
  number: number;
  /** The excerpt the marker names. Absent when it names the whole document. */
  excerptId?: string;
  documentId: string;
  /** Character range in `Message.content` the marker attaches to. Not provided yet. */
  span?: { start: number; end: number };
}
