import type { SourceDocument } from '../../model';

/**
 * The answer as text rather than as markup.
 *
 * Two places need the answer without its markup: the clipboard («Kopier
 * svaret», answer 15) and the live region that follows a streaming answer.
 * `Markdown` renders; it does not read back, so this is the small amount of
 * text handling that stays here. It deliberately does no block parsing and no
 * component mapping — that is `src/components/Markdown.tsx` and only there.
 */

/*
 * A marker and the space in front of it. The space goes with the marker,
 * because «kvartalsvis [1].» would otherwise be pasted as «kvartalsvis .»
 */
const CITATION = /[ \t]?\[\d{1,3}\]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/;

/**
 * Markdown stripped down to what a reader would paste into a document.
 *
 * The `[1]` markers go by default: on their own they are bookkeeping that
 * points at a panel the clipboard cannot carry. `keepCitations` keeps them,
 * for the one case where the clipboard DOES carry the panel — see
 * {@link answerWithSources}. Headings and list items keep their text and lose
 * their marks. Table rows become tab separated, so a paste into a spreadsheet
 * still has columns.
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

/**
 * How much of a streaming answer is safe to announce.
 *
 * A screen reader must not hear every token, and it must not hear half a
 * sentence either. Everything up to the last blank line is finished text; the
 * tail is still being written, so it waits.
 */
export function announcedText(markdown: string): string {
  const lastBreak = markdown.lastIndexOf('\n\n');
  if (lastBreak < 0) return '';
  return answerAsPlainText(markdown.slice(0, lastBreak));
}

/**
 * The reference list under a copied answer, one line per `[n]`.
 *
 * Norwegian APA-like, as the insight work asked for: «[1] Nasjonal
 * kommunikasjonsmyndighet (2022). Årsrapport …, s. 41. https://…». Every part
 * is dropped when the corpus does not have it — a folder-based corpus has no
 * URL and no page, and a reference with «, s. undefined» in it is worse than
 * one without the page.
 *
 * One line per CITED EXCERPT and not per document: `[n]` points at an
 * excerpt, two excerpts from the same report are `[1]` and `[2]`, and they
 * are on different pages. Excerpts the answer never cited carry no number and
 * are left out — they were retrieved, not used.
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
 * What «Kopier svaret» puts on the clipboard.
 *
 * The answer with its `[n]` markers intact, then the references they point
 * at. Reise 13, 14 and 20 in brukerreiser-2026-09-15.md: the one thing that
 * moves an answer out of KA moved it out without its provenance, which is
 * precisely what KA is for.
 *
 * With nothing behind the answer — a stopped turn, a corpus that returned
 * nothing — it falls back to today's clean text, markers and all removed.
 * Markers pointing at a list that is not there would be worse than no markers.
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
