import type { SourceDocument } from '../../model';

/* The answer as text rather than markup, for the clipboard and the live
  region. `Markdown` renders and does not read back, so this much stays here;
  it deliberately does no block parsing and no component mapping. */

// A marker and the space in front of it: the space goes with the marker, or
// «kvartalsvis [1].» is pasted as «kvartalsvis .»
const CITATION = /[ \t]?\[\d{1,3}\]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/;

/**
 * Markdown stripped to what a reader would paste into a document. The `[1]`
 * markers go by default, since alone they point at a panel the clipboard
 * cannot carry; `keepCitations` is for when it does. Tables go tab separated.
 */
export function answerAsPlainText(markdown: string, keepCitations = false): string {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line.startsWith('|')
        ? line
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim())
            .join('\t')
        : line.replace(BLOCK_SYNTAX, ''),
    )
    .join('\n')
    .replace(CITATION, keepCitations ? '$&' : '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** How much of a streaming answer is safe to announce: everything up to the
   last blank line is finished text, and the tail is still being written. */
export function announcedText(markdown: string): string {
  const lastBreak = markdown.lastIndexOf('\n\n');
  if (lastBreak < 0) return '';
  return answerAsPlainText(markdown.slice(0, lastBreak));
}

/**
 * The reference list under a copied answer, Norwegian APA-like, with each
 * part dropped when the corpus lacks it. One line per CITED EXCERPT and not
 * per document: two excerpts from one report are on different pages.
 */
export function referenceList(documents: SourceDocument[]): string[] {
  return documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .sort((a, b) => (a.excerpt.citationNumber ?? 0) - (b.excerpt.citationNumber ?? 0))
    .map(({ document, excerpt }) => {
      const author = [document.organisation, document.year && `(${document.year})`]
        .filter(Boolean)
        .join(' ');
      const where =
        excerpt.page === undefined ? document.title : `${document.title}, s. ${excerpt.page}`;
      const url = document.url ?? excerpt.kudosUrl;

      return [`[${excerpt.citationNumber}]`, author && `${author}.`, `${where}.`, url]
        .filter(Boolean)
        .join(' ');
    });
}

/** The heading over the reference list, so a paste explains itself. */
const REFERENCE_HEADING = 'Kilder';

/**
 * What «Kopier svaret» puts on the clipboard: the answer with its `[n]` and
 * the references under it, since an answer must not leave KA without its
 * provenance. With no sources it falls back to clean text.
 */
export function answerWithSources(markdown: string, documents: SourceDocument[] = []): string {
  const references = referenceList(documents);
  if (references.length === 0) return answerAsPlainText(markdown);

  return [answerAsPlainText(markdown, true), '', REFERENCE_HEADING, ...references].join('\n');
}

/** «Svaret og 3 kilder er kopiert.», with the singular form when it is one. */
export function copyReceipt(referenceCount: number): string {
  if (referenceCount === 0) return 'Svaret er kopiert.';
  const sources = referenceCount === 1 ? '1 kilde' : `${referenceCount} kilder`;
  return `Svaret og ${sources} er kopiert.`;
}
