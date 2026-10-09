// Text search shared by every view: texts with ids in, match positions out. Each view builds
// its own items (see `buildSearchIndex` in src/views/sources/search.ts).

/**
 * Where an indexed text came from, so a hit can tell excerpt from document body without a
 * lookup. `answer` is one block, because react-markdown hands the chat a paragraph at a time.
 */
export type SearchableKind = 'excerpt' | 'document' | 'answer';

export type SearchableItem = {
  /** Same id as the thing the text came from, so a hit can be pointed at it. */
  id: string;
  kind: SearchableKind;
  text: string;
};

/** One match: which piece of text, and where in it. */
export type SearchHit = {
  itemId: string;
  kind: SearchableKind;
  /** Index of the first character of the match in `item.text`. */
  start: number;
  /** Index one past the last character. */
  end: number;
};

/** Shortest query we act on. One character matches nearly everything. */
export const MIN_QUERY_LENGTH = 2;

/**
 * All matches in reading order, case-insensitive. Superscripts fold to plain, since a keyboard has
 * no «²». `toLowerCase()` keeps the length of æ ø å and each superscript is one UTF-16 unit like
 * its plain twin, so offsets found in the folded copy are valid in the original.
 */
export function findHits(items: SearchableItem[], query: string): SearchHit[] {
  const raised = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾';
  const plain = '0123456789+-=()';
  const raisedChar = new RegExp(`[${raised}]`, 'g');
  const fold = (text: string) =>
    text.toLowerCase().replace(raisedChar, (char) => plain[raised.indexOf(char)] ?? char);

  const needle = fold(query.trim());
  if (needle.length < MIN_QUERY_LENGTH) return [];

  const hits: SearchHit[] = [];

  for (const item of items) {
    const haystack = fold(item.text);
    let from = 0;

    for (;;) {
      const start = haystack.indexOf(needle, from);
      if (start === -1) break;
      hits.push({ itemId: item.id, kind: item.kind, start, end: start + needle.length });
      from = start + needle.length;
    }
  }

  return hits;
}

/** The hits inside one piece of text, for rendering. */
export function hitsFor(hits: SearchHit[], itemId: string): SearchHit[] {
  return hits.filter((hit) => hit.itemId === itemId);
}

/**
 * Move one hit, and stop at the ends rather than wrap: a wrapping «Forrige» on
 * the first hit looks usable and says nothing about where it lands. The
 * buttons that call this are `aria-disabled` when they would be no-ops.
 */
export function stepHit(total: number, current: number, step: 1 | -1): number {
  if (total === 0) return 0;
  return Math.min(Math.max(current + step, 0), total - 1);
}

/** A run of text, either plain or part of a match. */
export type TextRun = { text: string; hit?: SearchHit };

/**
 * Split a text into plain and matched runs, so the caller can wrap the matched
 * ones in `<mark>`. The runs cover the whole text exactly once, in order.
 */
export function splitByHits(text: string, hits: SearchHit[]): TextRun[] {
  if (hits.length === 0) return [{ text }];

  const runs: TextRun[] = [];
  let cursor = 0;

  for (const hit of hits) {
    if (hit.start > cursor) runs.push({ text: text.slice(cursor, hit.start) });
    runs.push({ text: text.slice(hit.start, hit.end), hit });
    cursor = hit.end;
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor) });

  return runs;
}
