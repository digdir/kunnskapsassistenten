import type { SourceDocument } from '../../model';
import { isOwnDocument } from './origin';

/** Two titles are the same when they differ only in case or spacing. */
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb');
}

/**
 * Each document's name in the panel and under the answer: its title, with
 * «, dokument <Kudos number>» when another corpus document has the same title.
 */
export function distinctTitles(documents: readonly SourceDocument[]): Map<string, string> {
  const counts = new Map<string, number>();
  const corpus = documents.filter((document) => !isOwnDocument(document));
  for (const document of corpus) {
    const key = titleKey(document.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Map(
    documents.map((document) => [
      document.id,
      !isOwnDocument(document) && (counts.get(titleKey(document.title)) ?? 0) > 1
        ? `${document.title}, dokument ${document.id}`
        : document.title,
    ]),
  );
}
