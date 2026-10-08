/**
 * Finding a string in a piece of text, and saying where it was found.
 *
 * **One** search mechanism was asked for, not two (answers 27 and 55): the
 * sources panel searches excerpts today, the answer and whole documents are
 * next. That is why this is not «excerpt search» — it knows nothing about
 * excerpts, documents or sources. It takes a flat list of pieces of text with
 * an id each, and gives back where the matches are.
 *
 * What stays with the caller is what the pieces ARE.
 * `buildSearchIndex` in src/views/sources/search.ts turns documents into
 * items, because only that view knows what a document is. The day the chat
 * view searches an answer it writes its own three lines and reuses
 * everything here.
 *
 * Moved out of the sources view 2026-09-15 at #3's request, unchanged: the
 * matching, the counter and the previous/next navigation were already general,
 * and the only thing holding them in one view was the folder they sat in.
 */

/**
 * What kind of thing a piece of indexed text came from.
 *
 * A hit carries it so the caller can tell «found in an excerpt» from «found in
 * the document body» without looking the id up again. `answer` is one block of
 * a rendered answer in the main column — the chat searches a paragraph at a
 * time, because that is the shape react-markdown hands it (brukerreiser punkt
 * 13).
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
 * All matches, in reading order: index order first, then position in the text.
 *
 * Matching is a plain case-insensitive substring search. `toLowerCase()` keeps
 * the length of every Norwegian character, æ ø å included, so the offsets stay
 * valid against the original string — which is what lets us search a
 * lowercased copy and highlight the original.
 *
 * Superscript digits and signs compare as the plain ones, so «m2» finds the
 * «m²» the sources panel shows for `m<sup>2</sup>`
 * (src/views/sources/readableText.ts): a keyboard has no «²». Each is one
 * UTF-16 unit, as the character it stands for is, so the offsets hold here
 * too.
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
 * Move one hit, and stop at the ends.
 *
 * It used to wrap, and wrapping is what made «Forrige» look usable on hit 1 of
 * 8 (docs/review/brukerblikk-2026-09-15.md, funn 11): the button was the same
 * blue as «Neste» and said nothing about where it would land. The review left
 * the choice open — disable it, or say that it goes round — and the decision
 * was to disable. So the ends are ends here too, and the buttons that call
 * this are `aria-disabled` when they would be no-ops.
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
