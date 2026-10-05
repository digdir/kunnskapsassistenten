/**
 * What names one excerpt apart from the others in the panel.
 *
 * Two places need it, and neither can use the visible text. The toggle says
 * «Åpne» in Figma, and every Kudos link in the panel says «Les dokumentet på
 * Kudos» — six identical link names in one panel, which a screen reader
 * listing the links reads as six identical rows (WCAG 2.4.9; 2.4.4 passes
 * only because the surrounding text carries the meaning). KA CC found the
 * link case on #70.
 *
 * A cited excerpt is named by its citation number, because that number is
 * what the reader already has: it is the `[n]` in the answer and the «Utdrag
 * n» heading on the card, and it is unique across the whole panel.
 *
 * An uncited excerpt has no such number, so it is named by where it sits in
 * its document — «utdrag 2 av 5», the same count the card prints above it.
 * Unique within the document; the document title is what separates it from
 * the next document's, which is why the link appends the title and the
 * toggle, sitting under its own document heading, does not.
 *
 * The mock has no uncited excerpts today (measured 2026-09-17: none in the
 * eleven scripted conversations), so that branch exists for live data, where
 * a retrieved chunk the answer never cited is ordinary.
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
