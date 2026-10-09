import type { SourceDocument } from '../../model';
import type { SearchableItem } from '../../components';

// The search (`src/components/textSearch.ts`) takes flat text; this says what a
// document is.

/**
 * Everything the search can look inside: the excerpt text. The heading is not
 * indexed, because a hit in a heading cannot be highlighted in the body.
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
