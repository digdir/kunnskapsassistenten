import type { SourceDocument } from '../../model';

/**
 * Telling the reader's own file from a Kudos document.
 *
 * Read off `origin`, never off the title. A document the reader uploaded and
 * called «Årsrapport 2025.pdf» is not the corpus's «Årsrapport Nasjonal
 * kommunikasjonsmyndighet 2025»: it has no Kudos address, nobody else can
 * open it, and the panel has to say so. #5 put the field on the model for
 * exactly this (see `src/model/source.ts`).
 *
 * Absent means corpus, because every document that existed before uploads did
 * came from one.
 */
export function isOwnDocument(source: SourceDocument): boolean {
  return source.origin === 'user';
}

/**
 * The line under the document title.
 *
 * A corpus document has type, organisation and year to say what it is. An
 * uploaded one has none of the three — it has a file name, and the reader
 * already knows whose file it is — so it says the one thing that matters
 * here: this is yours, not something from Kudos. Without it the card is a
 * title and nothing else, and looks like a corpus document with missing
 * metadata rather than a different kind of thing.
 */
export function documentSubtitle(source: SourceDocument): string {
  if (isOwnDocument(source)) return OWN_DOCUMENT_LABEL;

  return [source.documentType, source.organisation, source.year]
    .filter((part) => part !== undefined)
    .join(' · ');
}

/** What an uploaded document is called, in the subtitle and in link names. */
export const OWN_DOCUMENT_LABEL = 'Ditt dokument';

/**
 * Why there is no link out of an uploaded document's card.
 *
 * Not the folder-corpus sentence («Dokumentet har ingen offentlig lenke»),
 * which is true but says the wrong thing: that one is about a corpus whose
 * documents happen to lack public addresses, and it reads as something
 * missing. The reader's own file is not missing a link — it never had one,
 * and that is the normal and correct state for a file only they hold.
 */
export const OWN_DOCUMENT_NO_LINK =
  'Bare du har dette dokumentet, så det finnes ingen lenke til det.';

/**
 * Which corpus key the panel should name for the answer on screen.
 *
 * The answer's own, whenever it has one. Switching corpus starts a new
 * thread, so the answer's corpus and the chooser agree while a reader moves
 * forward — they part the moment an older thread is opened, and KA CC
 * measured «fra Wikipedia (mock)» standing over the Nkom card of a Kudos
 * thread (bør on #129). The excerpts do not change when the chooser moves, so
 * nothing naming them may either.
 *
 * The active key is the fallback and only that: an answer from before the key
 * travelled, or a turn where nothing said which corpus answered. Naming the
 * current choice there is a guess, but it is the best one available and it is
 * right in the common case, where nobody has switched.
 */
export function corpusKeyFor(
  answerKey: string | undefined,
  activeKey: string | undefined,
): string | undefined {
  return answerKey ?? activeKey;
}
