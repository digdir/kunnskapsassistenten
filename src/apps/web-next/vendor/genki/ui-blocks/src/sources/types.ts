/** An excerpt as the frontend contract sends it, and what a host knows beyond it. */
export interface SourceExcerpt {
  chunkId: string;
  text: string;
  position?: number | undefined;
  /** Its section path, «Kapittel 3 › 3.4 Digitalisering». */
  heading?: string | undefined;
  page?: number | undefined;
  /** A «Les side N» link is drawn only when this opens that page, `#page=N`. */
  url?: string | undefined;
  textUnavailable?: boolean | undefined;
  textLoading?: boolean | undefined;
}

/** A source document as the frontend contract sends it (`sources[]`). */
export interface SourceDocument {
  index?: number | undefined;
  title: string;
  url?: string | undefined;
  documentId?: string | undefined;
  excerpts: readonly SourceExcerpt[];
  excerpt?: string | undefined;
  version?: string | undefined;
  publishedAt?: string | undefined;
  /** A host's own line under the title, instead of the block's. */
  meta?: readonly string[] | undefined;
}

export interface SourceSelection {
  source: SourceDocument;
  excerpt?: SourceExcerpt;
}

/** Where a footnote sends the reader. */
export interface SourceTarget {
  chunkId?: string | undefined;
  documentId?: string | undefined;
  index?: number | undefined;
}
