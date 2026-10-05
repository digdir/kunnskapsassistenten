/**
 * Scroll targets inside the panel that are not already defined by the model.
 *
 * `excerptDomId` is NOT here: it moved to `src/model/source.ts` when the
 * citation convention was settled, so the answer and the panel build the id
 * from the same function. Import it from the model, or from this view's
 * `index.ts`, which re-exports it for the main column.
 *
 * `documentDomId` is Norwegian because it ends up in the address bar as a
 * fragment, which the user can see and share. `excerptDomId` is not: it was
 * already `excerpt-n` when the convention was settled, and the answer links
 * to it, so renaming it now would break links users have copied.
 */

/** Scroll target for a document card, used by the shortcut list. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}
