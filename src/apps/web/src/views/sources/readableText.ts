import type { Excerpt, SourceDocument } from '../../model';

// Excerpts as plain text: Marker's markdown, stripped rather than rendered,
// since the search counts hits by offsets in this string. Only drawn as a text
// node, so not a sanitiser; tags go because they are noise.

const HEADING_SEPARATOR = ' › ';

// Backslash escapes become noncharacters (U+FDD0 on) until the end, so an
// escaped `*` or `|` is never markup. Not private-use: Kudos has some in its text.
const ESCAPABLE = '\\`*_{}[]()#+-.!|"\'~<>';
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|"'~<>])/g;
const PLACEHOLDER_BASE = 0xfdd0;
const NONCHARACTER = /[\ufdd0-\ufdef]/g;

function protectEscapes(text: string): string {
  return text
    .replace(NONCHARACTER, '')
    .replace(ESCAPED, (_, char: string) =>
      String.fromCharCode(PLACEHOLDER_BASE + ESCAPABLE.indexOf(char)),
    );
}

function restoreEscapes(text: string): string {
  return text.replace(
    NONCHARACTER,
    (char) => ESCAPABLE[char.charCodeAt(0) - PLACEHOLDER_BASE] ?? '',
  );
}

/** Their content is not text a reader would want either. */
const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const LINE_BREAK_TAG = /<br\s*\/?>/gi;
/** `<` or `</` and a letter; the name ends at a space or `/`, as HTML reads it. */
const TAG = /<\/?[a-z][a-z0-9-]*(?:[\s/][^<>]*)?>/gi;

/**
 * Repeated until nothing changes, since one round of `<scr<script>ipt>` leaves
 * `<script>`. For the reader, not for safety.
 */
function removeUntilStable(text: string, ...patterns: RegExp[]): string {
  let result = text;
  let previous: string;
  do {
    previous = result;
    for (const pattern of patterns) result = result.replace(pattern, '');
  } while (result !== previous);
  return result;
}

/** `<sup>` as superscript characters, «Husleie¹⁾», when every character has one. */
const SUPERSCRIPT_TAG = /<sup\b[^<>]*>([\s\S]*?)<\/sup\s*>/gi;
const RAISED: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
};

function raised(text: string): string | undefined {
  const chars = [...text];
  return chars.every((char) => char in RAISED)
    ? chars.map((char) => RAISED[char]).join('')
    : undefined;
}

/**
 * «Husleie1)» in a table cell is a footnote mark that lost its raise; in prose
 * the shape can mean something else. A `)` that closes an open `(` is kept.
 */
const GLUED_FOOTNOTE = /(?<=\p{L})\d{1,2}\)(?![\p{L}\p{N}])/gu;

function isInsideParentheses(text: string, offset: number): boolean {
  let depth = 0;
  for (const char of text.slice(0, offset)) {
    if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}

function raiseGluedFootnotes(text: string): string {
  return text.replace(GLUED_FOOTNOTE, (mark: string, offset: number) =>
    isInsideParentheses(text, offset) ? mark : (raised(mark) ?? mark),
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi;

/**
 * Last, after the tags are gone: `&lt;span&gt;` is a document that meant the
 * characters, and they are shown as the characters.
 */
function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, decimal?: string, hex?: string, name?: string) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
    const code = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hex ?? '', 16);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole;
  });
}

/**
 * Emphasis, links and code, inside one line or one cell.
 *
 * `_` counts only at a word boundary, so `snake_case` and a file name keep
 * theirs; `*` counts only with no space just inside it, so «5 * 3» keeps its.
 */
function stripInline(text: string): string {
  // Superscript before the other tags go, or it would go with them.
  const withRaised = removeUntilStable(text, SCRIPT_OR_STYLE, HTML_COMMENT).replace(
    SUPERSCRIPT_TAG,
    (_, inner: string) => raised(removeUntilStable(inner, TAG).trim()) ?? inner,
  );
  return (
    removeUntilStable(withRaised, SCRIPT_OR_STYLE, HTML_COMMENT, TAG)
      // ![alt](src) before [text](href), or the image would leave its «!».
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')
      .replace(/(?<![\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1')
      .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')
      .replace(/(?<![\p{L}\p{N}*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}*])/gu, '$1')
      .replace(/(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu, '$1')
  );
}

/** Marker's page marker: the page number alone on its line. */
const PAGE_MARKER = /^\{\d+\}$/;
/** `---`, `***`, `___`, with or without spaces between, and a setext `===`. */
const THEMATIC_BREAK = /^(?:([-*_])(?:\s*\1){2,}|={3,})$/;
const TABLE_ROW = /^\|.*\|$/;
/** `|---|:---:|`, the line under a table's header. */
const TABLE_DELIMITER = /^\|?(?:\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?$/;

// One row as one line, cells joined by « · ». Empty rows and trailing cells go;
// an empty cell before a filled one is «–», so the columns keep their place.
function tableRow(line: string): string | undefined {
  const cells = line
    .slice(1, -1)
    .split('|')
    .map((cell) =>
      raiseGluedFootnotes(stripInline(cell.replace(LINE_BREAK_TAG, ' ')))
        .replace(/\s+/g, ' ')
        .trim(),
    );
  while (cells.length > 0 && cells.at(-1) === '') cells.pop();
  if (cells.length === 0) return undefined;
  return cells.map((cell) => cell || '–').join(' · ');
}

/**
 * An excerpt's markdown as readable text, line structure kept.
 *
 * Paragraphs stay separated by a blank line and list items and table rows by
 * a line break, so the view draws them with `white-space: pre-line`.
 */
export function readableExcerptText(markdown: string): string {
  const lines = removeUntilStable(
    protectEscapes(markdown.replace(/\r\n?/g, '\n')),
    SCRIPT_OR_STYLE,
    HTML_COMMENT,
  ).split('\n');

  const readable: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();

    if (PAGE_MARKER.test(line) || THEMATIC_BREAK.test(line)) continue;

    if (TABLE_ROW.test(line)) {
      if (TABLE_DELIMITER.test(line)) continue;
      const row = tableRow(line);
      if (row !== undefined) readable.push(row);
      continue;
    }

    const block = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/\s+#+$/, '')
      .replace(/^>\s?/, '')
      .replace(/^[-*+]\s+/, '• ');
    readable.push(stripInline(block.replace(LINE_BREAK_TAG, '\n')).replace(/[ \t]+/g, ' '));
  }

  return decodeEntities(
    restoreEscapes(
      readable
        .join('\n')
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    ),
  );
}

/**
 * A heading path as one readable line.
 *
 * Cleaned step by step, so a step that was nothing but an anchor disappears
 * with its separator rather than leaving «… › » behind.
 */
export function readableHeading(heading: string | undefined): string | undefined {
  if (heading === undefined) return undefined;
  const path = heading
    .split(HEADING_SEPARATOR)
    .map((step) =>
      decodeEntities(restoreEscapes(stripInline(protectEscapes(step).replace(LINE_BREAK_TAG, ' '))))
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((step) => step !== '')
    .join(HEADING_SEPARATOR);
  return path || undefined;
}

function readableExcerpt(excerpt: Excerpt): Excerpt {
  return {
    ...excerpt,
    text: readableExcerptText(excerpt.text),
    heading: readableHeading(excerpt.heading),
  };
}

/**
 * The documents with every excerpt made readable. Applied once, where the view
 * receives the documents, so the search and the quote read the same string.
 */
export function readableDocuments(documents: SourceDocument[]): SourceDocument[] {
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map(readableExcerpt),
  }));
}
