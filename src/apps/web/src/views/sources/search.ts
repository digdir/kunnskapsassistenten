import type { SourceDocument } from '../../model';
import type { SearchableItem } from '../../components';

/**
 * What this view gives the search to look inside.
 *
 * The search itself is in `src/components/textSearch.ts` and knows nothing
 * about documents: it takes a flat list of text with an id each. This is the
 * one piece that has to know what a document is, which is why it stayed here
 * when the rest moved out on 2026-09-15.
 *
 * Lars asked for one mechanism, not two (answers 27 and 55): excerpts today,
 * whole documents later. Adding document bodies is one more `kind` and one
 * more loop here — the matching, the counter and the previous/next navigation
 * do not change.
 */

/**
 * Everything the search can currently look inside.
 *
 * Today that is the excerpt text. The heading is not indexed separately,
 * because a hit in a heading cannot be highlighted in the body. Later the full
 * document text arrives here as `kind: 'document'`.
 */
export function buildSearchIndex(documents: SourceDocument[]): SearchableItem[] {
  // `source`, not `document`: this view uses the DOM global in the same files.
  return documents.flatMap((source) =>
    source.excerpts.map((excerpt) => ({
      id: excerpt.id,
      kind: 'excerpt' as const,
      text: excerpt.text,
    })),
  );
}
