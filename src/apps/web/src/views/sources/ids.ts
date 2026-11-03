// `excerptDomId` is in `src/model/source.ts`. It stays `excerpt-n`, or links
// readers have copied would break.

/** The id of a document card. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}

/**
 * The id of a document card's heading, where «Kilder brukt i svaret» sends the reader: to the
 * document, not to one of its excerpts.
 */
export function documentHeadingDomId(documentId: string): string {
  return `${documentDomId(documentId)}-tittel`;
}
