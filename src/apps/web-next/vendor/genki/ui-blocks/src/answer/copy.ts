import type { Locale } from '@genai/i18n';
import { cellsOf, inlineText, type FootnoteLabel } from '../markdown/Markdown.js';
import { excerptMarkdown, headingText } from '../sources/excerptMarkdown.js';
import { documentKeys } from '../sources/pairing.js';
import { distinctNames, sectionOf } from '../sources/Sources.js';
import type { SourceDocument } from '../sources/types.js';
import { readFootnotes, type AnswerMarker } from './citations.js';
import { translator } from './i18n.js';

export interface AnswerCopyOptions {
  /** The contract's `sources[]`. */
  sources?: readonly SourceDocument[] | undefined;
  /** The contract's top-level `markers`, when the service cites excerpts. */
  markers?: readonly AnswerMarker[] | undefined;
  /** The language of the reference list's words, «s.» or «p.». */
  locale?: Locale | undefined;
}

export interface AnswerCopy {
  /** The answer as text, its footnotes numbered as drawn, and the reference list under it. */
  text: string;
  /** How many references went along, for `AnswerActions`' receipt. */
  sources: number;
}

const blockSyntax = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/;

/** What a `[N]` becomes: a new number, nothing (it leads nowhere), or itself (it is prose). */
type Label = number | null | undefined;

const fence = /^\s*```/;
const tableRule = /^\|[\s:|-]+\|$/;

/** One line of prose or of a table as the words drawn, its footnotes as `label` says. */
const words = (line: string, label: FootnoteLabel) =>
  line.startsWith('|')
    ? cellsOf(line)
        .map((cell) => inlineText(cell, label).trim())
        .join('\t')
    : inlineText(line.replace(blockSyntax, ''), label);

// By hand: `/[ \t]+\n/` rescans a long run of blanks from each of its characters.
const withoutTrailingBlanks = (line: string) => {
  let end = line.length;
  while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end -= 1;
  return line.slice(0, end);
};

/**
 * Markdown stripped to the words a reader sees, for the clipboard and for a live region: no block
 * syntax and no inline syntax, so `**viktig**` is «viktig» and a link is its words, as drawn. Tables
 * go tab separated, and a code block's lines stay as written, without the fences.
 */
const plain = (markdown: string, label: (n: number) => Label) => {
  const lines: string[] = [];
  let code = false;
  for (const raw of markdown.split('\n')) {
    if (fence.test(raw)) code = !code;
    else if (code) lines.push(raw);
    else if (!tableRule.test(raw.trim())) lines.push(words(raw.trim(), label));
  }
  return lines
    .map(withoutTrailingBlanks)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** How many of an excerpt's first words tell it apart in a reference line. */
const OPENING_WORDS = 8;

/** An excerpt's first words as drawn, with «…» where it goes on and no full stop where it ends. */
const openingWords = (text: string) => {
  const all = plain(excerptMarkdown(text), () => null)
    .split(/\s+/)
    .filter(Boolean);
  const shown = all.slice(0, OPENING_WORDS).join(' ');
  return all.length > OPENING_WORDS ? `${shown} …` : shown.replace(/[.,;:!?]+$/u, '');
};

const yearOf = (date: string | undefined) => {
  const year = date ? new Date(date).getUTCFullYear() : Number.NaN;
  return Number.isNaN(year) ? undefined : year;
};

/**
 * How much of an answer on its way is finished, as plain text without footnotes, for a live
 * region: everything up to the last blank line, since the tail is still being written. Empty
 * before the first block is done. kunnskapsassistenten's `announcedText`.
 */
export const finishedText = (markdown: string) => {
  const lastBreak = markdown.lastIndexOf('\n\n');
  return lastBreak < 0 ? '' : plain(markdown.slice(0, lastBreak), () => null);
};

/**
 * What «Kopier svaret» puts on the clipboard, as kunnskapsassistenten copies it: the answer with
 * its footnotes, and a reference list under it, since an answer must not leave the app without
 * where it came from. One line per numbered excerpt, and two from one report told apart by their
 * page, section or first words. An answer whose footnotes name only documents is drawn without
 * footnotes, so it is copied without them, with one unnumbered line per cited document. Each part
 * is left out when the source lacks it. With no sources, the clean text alone.
 */
export const answerCopy = (text: string, options: AnswerCopyOptions = {}): AnswerCopy => {
  const { sources = [], markers, locale = 'nb' } = options;
  const t = translator(locale);
  const { pairing, met } = readFootnotes(text, sources, markers);
  const byExcerpt = pairing.mode === 'excerpt';
  const keys = documentKeys(sources);
  const names = distinctNames(sources, (title, id) => t('sources.sameTitle', { title, id })).map(
    (name) => name || t('sources.untitled'),
  );
  const byMarker = new Map(markers?.map((m) => [m.marker, m] as const));

  const where = (title: string, page: number | undefined, part?: string) => {
    const named = part === undefined ? title : t('answer.copyPart', { title, part });
    return page === undefined ? named : t('answer.copyPage', { title: named, page });
  };
  const line = (
    n: number | undefined,
    title: string,
    page: number | undefined,
    at: SourceDocument,
    part?: string,
  ) => {
    const year = yearOf(at.publishedAt);
    const url = at.url;
    return [
      n === undefined ? undefined : `[${n}]`,
      `${where(title, page, part)}${year === undefined ? '' : ` (${year})`}.`,
      url,
    ]
      .filter(Boolean)
      .join(' ');
  };

  const cited = byExcerpt
    ? sources
        .flatMap((source, i) =>
          source.excerpts.flatMap((excerpt) => {
            const n = pairing.numbers.get(excerpt.chunkId);
            return n === undefined ? [] : [{ n, source, title: names[i] ?? '', excerpt }];
          }),
        )
        .toSorted((a, b) => a.n - b.n)
    : [];
  // Two excerpts of one document are told apart as the screen tells them apart: by their page,
  // else by their section («Utdrag 2: Ressursbruk»), else by their first words, since the screen
  // shows each one's text. A line that is the only one of its kind keeps kunnskapsassistenten's.
  type Cited = (typeof cited)[number];
  const sectionIn = (c: Cited) => sectionOf(headingText(c.excerpt.heading));
  const partOf = (c: Cited) => {
    const alike = cited.filter(
      (other) => other.source === c.source && other.excerpt.page === c.excerpt.page,
    );
    if (alike.length < 2) return undefined;
    const section = sectionIn(c);
    if (section && alike.every((other) => other === c || sectionIn(other) !== section))
      return section;
    return openingWords(c.excerpt.text);
  };

  const references = byExcerpt
    ? cited.map((c) => line(c.n, c.title, c.excerpt.page, c.source, partOf(c)))
    : sources.flatMap((source, i) =>
        pairing.uses.has(keys[i] ?? '') ? [line(undefined, names[i] ?? '', undefined, source)] : [],
      );

  // Where a written `[N]` leads, by the contract's rule: the marker it names, or the source with
  // `index: N`. One that names nothing is prose, such as a list number, and stays.
  const label = (n: number): Label => {
    // With nothing to list, a footnote alone points at a panel the clipboard cannot carry.
    if (references.length === 0) return null;
    const marker = markers ? byMarker.get(String(n)) : undefined;
    const at = markers
      ? marker
        ? sources.findIndex(
            (s) =>
              s.excerpts.some((e) => e.chunkId === marker.chunkId) ||
              (marker.documentId !== undefined && s.documentId === marker.documentId),
          )
        : -1
      : sources.findIndex((s) => s.index === n);
    if ((markers && !marker) || (!markers && at < 0)) return undefined;
    // One that names only a document is drawn as nothing, so it is copied as nothing.
    return (byExcerpt && marker && pairing.numbers.get(marker.chunkId)) || null;
  };

  // A footnote the screen drops, such as a repeat beside its twin, is copied as nothing too.
  const seen: number[] = [];
  plain(text, (n) => {
    seen.push(n);
    return undefined;
  });
  const drawn = met.filter((m) => m.n < 1000);
  const inStep = seen.length === drawn.length && seen.every((n, i) => drawn[i]?.n === n);
  let at = 0;
  const body = plain(text, (n) => {
    const dropped = inStep && drawn[at]?.dropped;
    at += 1;
    return dropped ? null : label(n);
  });
  return references.length === 0
    ? { text: body, sources: 0 }
    : {
        text: [body, '', t('answer.copyHeading'), ...references].join('\n'),
        sources: references.length,
      };
};
