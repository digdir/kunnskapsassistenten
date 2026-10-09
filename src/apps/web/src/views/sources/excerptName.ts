/**
 * The accessible name that tells an excerpt apart (WCAG 2.4.9): its citation
 * number, or «utdrag 2 av 5» for one the answer never cited.
 */
export function excerptName(
  citationNumber: number | undefined,
  /** 1-based position of this excerpt among its document's excerpts. */
  position: number,
  /** How many excerpts that document has. */
  total: number,
): string {
  return citationNumber !== undefined
    ? `utdrag ${citationNumber}`
    : `utdrag ${position} av ${total}`;
}
