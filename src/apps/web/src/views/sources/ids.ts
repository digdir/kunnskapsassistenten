import { documentDomId } from '../../model';

// In `src/model/source.ts`, where the answer's `[n]` finds them too.
export { documentDomId, documentHeadingDomId } from '../../model';

/** The id of an unnumbered excerpt in a document cited whole, for the search to scroll to. */
export function excerptInDocumentDomId(documentId: string, position: number): string {
  return `${documentDomId(documentId)}-utdrag-${position}`;
}
