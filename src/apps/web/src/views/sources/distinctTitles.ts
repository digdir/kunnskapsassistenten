import type { SourceDocument } from '../../model';
import { isOwnDocument } from './origin';

/** Two titles are the same when they differ only in case or spacing. */
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb');
}

/**
 * The name each document goes by in the sources panel and under the answer:
 * its title, and its number when another document in the same answer has the
 * same title.
 *
 * Two documents can arrive with the same title. Measured 05.10: documents
 * 90777 and 88640 are both «Årsrapport Datatilsynet 2023» in the index the
 * search reads, with 150 and 152 chunks. In Kudos they are two documents with
 * a PDF each, and 90777 is «Årsrapport Datatilsynet 2023 (DFD)», published
 * 1.1.2024; 88640 was published 2.5.2024. The index lost the «(DFD)» that
 * tells them apart. One answer took chunks from both, and the panel drew two
 * cards with the same heading and two Kudos links with the same name and
 * different addresses, and «Kilder brukt i svaret» two links with the same
 * name and different targets.
 *
 * The number and not «1 av 2»: «1 av 2» reads as part one of a report, and
 * the order can change from answer to answer, so the same document would go
 * by different names. The number stays, and it is the one in the Kudos
 * address the reader lands on (the dirigent, 05.10). The data has nothing
 * else that tells the two apart: a chunk carries no date, and in live mode
 * there is no type, publisher or year either. A publication date can take the
 * number's place the day the data has one.
 *
 * `id` is the document's number in Kudos in both live and bff mode
 * (`doc_num`). Only without one does it fall back to a chunk's id, and then it
 * is still distinct and still stable.
 *
 * Only documents from the corpus count, and only they get a number. A file the
 * reader uploaded has no number in Kudos, and it is told apart already: «Ditt
 * dokument» on its card, «ditt dokument» in its name, and no Kudos link.
 *
 * A comma before it, not brackets: the Kudos link's name ends in «(åpnes i ny
 * fane)», and two brackets in a row read badly.
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
