import type { SourceDocument } from '../../model';

/**
 * True for a file the reader uploaded. Read off `origin`, never the title;
 * absent means corpus.
 */
export function isOwnDocument(source: SourceDocument): boolean {
  return source.origin === 'user';
}

/**
 * The line under the title: type, organisation and year, or «Ditt dokument»,
 * so an upload does not look like a corpus document missing its metadata.
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
 * A file only the reader holds never had a link, so it does not get the
 * folder-corpus sentence, which reads as something missing.
 */
export const OWN_DOCUMENT_NO_LINK =
  'Bare du har dette dokumentet, så det finnes ingen lenke til det.';

/**
 * The answer's corpus key, or the active one when the answer has none: an
 * older thread can be from another corpus than the chooser shows.
 */
export function corpusKeyFor(
  answerKey: string | undefined,
  activeKey: string | undefined,
): string | undefined {
  return answerKey ?? activeKey;
}
