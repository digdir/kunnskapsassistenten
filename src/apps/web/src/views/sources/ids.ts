// `excerptDomId` is in `src/model/source.ts`. It stays `excerpt-n`, or links
// readers have copied would break.

/** The id of a document card. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}
