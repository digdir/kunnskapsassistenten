import { decodeEntities } from '../markdown/Markdown.js';

// Marker's PDF Markdown made fit to quote: its leftovers go and its markup is read as KA reads it.

// Escapes are noncharacters until the end, so an escaped `|` or `<` is never cut or read as a tag.
const ESCAPABLE = '\\`*_{}[]()#+-.!|"\'~<>';
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!|"'~<>])/g;
const BASE = 0xfdd0;
const NONCHARACTER = /[\ufdd0-\ufdef]/g;

// The one tag Markdown draws in an excerpt, kept as a noncharacter while every other goes.
const BREAK = '\ufdec';
const KEPT: Record<string, string> = { [BREAK]: '<br>' };

const escaped = (char: string) => String.fromCharCode(BASE + ESCAPABLE.indexOf(char));

const protect = (text: string) =>
  text
    .replace(NONCHARACTER, '')
    .replace(ESCAPED, (_, char: string) => String.fromCharCode(BASE + ESCAPABLE.indexOf(char)));

const restore = (text: string) =>
  text.replace(
    NONCHARACTER,
    (char) => KEPT[char] ?? `\\${ESCAPABLE[char.charCodeAt(0) - BASE] ?? ''}`,
  );

// `<` or `</` and a letter; the name ends at a space or `/`, as HTML reads it.
const TAG = /<\/?[a-z][a-z0-9-]*(?:[\s/][^<>]*)?>/gi;
const BREAK_TAG = /<br\s*\/?>/gi;
const AUTOLINK = /<(https?:\/\/[^<>\s]+)>/gi;

// The first match at or after a position that only moves forward, so no part is searched twice.
const searcher = (text: string, pattern: RegExp) => {
  let from = Number.POSITIVE_INFINITY;
  let found: RegExpExecArray | null = null;
  return (at: number) => {
    if (at < from || (found && found.index < at)) {
      pattern.lastIndex = at;
      found = pattern.exec(text);
      from = at;
    }
    return found;
  };
};

// `<script>` and `<style>` with all they hold, by hand: the one pattern for them is quadratic.
const dropScriptsAndStyles = (text: string) => {
  const opener = /<(script|style)\b/gi;
  const tagEnd = searcher(text, />/g);
  const closer = {
    script: searcher(text, /<\/script\s*>/gi),
    style: searcher(text, /<\/style\s*>/gi),
  };
  let out = '';
  let kept = 0;
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const end = tagEnd(opener.lastIndex);
    if (!end) continue;
    const close = closer[(open[1] ?? '').toLowerCase() as keyof typeof closer](end.index + 1);
    if (!close) continue;
    out += text.slice(kept, open.index);
    kept = close.index + close[0].length;
    opener.lastIndex = kept;
  }
  return out + text.slice(kept);
};

const dropComments = (text: string) => {
  let out = '';
  let kept = 0;
  for (let open = text.indexOf('<!--'); open !== -1; open = text.indexOf('<!--', kept)) {
    const close = text.indexOf('-->', open + 4);
    if (close === -1) break;
    out += text.slice(kept, open);
    kept = close + 3;
  }
  return out + text.slice(kept);
};

type Pass = RegExp | ((text: string) => string);

// Repeated until nothing changes, since one round of `<scr<script>ipt>` leaves `<script>`.
const removeUntilStable = (text: string, ...passes: Pass[]) => {
  let result = text;
  let previous: string;
  do {
    previous = result;
    for (const pass of passes)
      result = typeof pass === 'function' ? pass(result) : result.replace(pass, '');
  } while (result !== previous);
  return result;
};

// Each `<sup>` or `<sub>` and its text, as `replace` gives it back.
const replaceRaisable = (text: string, replace: (name: string, inner: string) => string) => {
  const opener = /<(sup|sub)\b/gi;
  const tagEnd = searcher(text, /[<>]/g);
  const closer = { sup: searcher(text, /<\/sup\s*>/gi), sub: searcher(text, /<\/sub\s*>/gi) };
  let out = '';
  let kept = 0;
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const name = open[1] ?? '';
    const end = tagEnd(opener.lastIndex);
    if (end?.[0] !== '>') continue;
    const close = closer[name.toLowerCase() as keyof typeof closer](end.index + 1);
    if (!close) continue;
    out += text.slice(kept, open.index) + replace(name, text.slice(end.index + 1, close.index));
    kept = close.index + close[0].length;
    opener.lastIndex = kept;
  }
  return out + text.slice(kept);
};

// Where a link's `(address)` ends, or -1; openers that share a `]` ask about one place in turn.
const addressEnd = (text: string) => {
  const address = /\((?:[^()\s]|\([^()\s]*\))*\)/y;
  let asked = -1;
  let end = -1;
  return (at: number) => {
    if (at !== asked) {
      address.lastIndex = at;
      end = address.test(text) ? address.lastIndex : -1;
      asked = at;
    }
    return end;
  };
};

// Each `[words](address)` after `opener` as its words; the words end at the first `stop`.
const linkWords = (
  text: string,
  opener: string,
  stop: RegExp,
  least: number,
  address: (at: number) => number,
) => {
  const close = searcher(text, stop);
  let out = '';
  let kept = 0;
  for (let open = text.indexOf(opener); open !== -1;) {
    const start = open + opener.length;
    const bracket = close(start);
    if (!bracket) break;
    const end =
      bracket[0] === ']' && bracket.index - start >= least ? address(bracket.index + 1) : -1;
    if (end === -1) {
      open = text.indexOf(opener, open + 1);
      continue;
    }
    out += text.slice(kept, open) + text.slice(start, bracket.index);
    kept = end;
    open = text.indexOf(opener, kept);
  }
  return out + text.slice(kept);
};

const images = (text: string) => linkWords(text, '![', /\]/g, 0, addressEnd(text));
// A link in a quotation is its words, as KA draws it; the document link is at the card's end.
const links = (text: string) => linkWords(text, '[', /[\]\n]/g, 1, addressEnd(text));

// The text between an opening and a closing mark, `**` and `~~` among them, by hand.
const unwrap = (text: string, opener: RegExp, closer: RegExp, width: number) => {
  const close = searcher(text, closer);
  let out = '';
  let kept = 0;
  for (let open = opener.exec(text); open; open = opener.exec(text)) {
    const start = open.index + width;
    const end = close(start + 1);
    if (!end) break;
    out += text.slice(kept, open.index) + text.slice(start, end.index);
    kept = end.index + width;
    opener.lastIndex = kept;
  }
  return out + text.slice(kept);
};

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

const LOWERED: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '−': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

const shifted = (text: string, characters: Record<string, string>) => {
  const chars = [...text];
  return chars.every((char) => char in characters)
    ? chars.map((char) => characters[char]).join('')
    : undefined;
};
const raised = (text: string) => shifted(text, RAISED);
const shiftedBy = (tag: string) => (tag.toLowerCase() === 'sup' ? RAISED : LOWERED);

// «Husleie1)» in a table cell is a footnote mark that lost its raise; one closing a `(` is kept.
const GLUED_FOOTNOTE = /(?<=\p{L})\d{1,2}\)(?![\p{L}\p{N}])/gu;

const raiseGluedFootnotes = (text: string) => {
  let depth = 0;
  let read = 0;
  return text.replace(GLUED_FOOTNOTE, (mark: string, offset: number) => {
    for (; read < offset; read += 1) {
      if (text[read] === '(') depth += 1;
      else if (text[read] === ')') depth = Math.max(0, depth - 1);
    }
    return depth > 0 ? mark : (raised(mark) ?? mark);
  });
};

// What Markdown would read as markup in a raised mark's text, «*» above all.
const MARKUP = /[\\`*_~[\]|]/g;

// A `<sup>` or `<sub>` as «m²» or «CO₂» when every character has a raised twin, else as its text.
const shiftMark = (name: string, inner: string) => {
  const text = removeUntilStable(inner, dropScriptsAndStyles, dropComments, TAG);
  return shifted(text.trim(), shiftedBy(name)) ?? text.replace(MARKUP, escaped);
};

const inline = (text: string, cell: boolean) => {
  const kept = replaceRaisable(
    removeUntilStable(text, dropScriptsAndStyles, dropComments),
    shiftMark,
  ).replace(BREAK_TAG, cell ? ' ' : BREAK);
  const clean = removeUntilStable(kept, dropScriptsAndStyles, dropComments, TAG);
  const words = links(images(clean)).replace(AUTOLINK, '$1');
  return (cell ? raiseGluedFootnotes(words) : words).replace(/[ \t]+/g, ' ').trim();
};

// Marker's page marker, the page number alone on its line, and its rule.
const PAGE_MARKER = /^\{\d+\}$/;
const THEMATIC_BREAK = /^(?:([-*_])(?:\s*\1){2,}|={3,})$/;
const TABLE_ROW = /^\|.*\|$/;
const DELIMITER_CELL = /^\s*:?-+:?\s*$/;
const FENCE = /^\s*```/;
// A running head, «Årsrapport 2024 | 4»: page numbers and short text, on a line of its own.
const PAGE_NUMBERS = /^\d{1,3}(?: \d{1,3}){0,3}$/;
const HEAD_TEXT = /^[^|]{1,80}$/;
// A page number glued to the title, «Lånekassen 46»; a year has four digits.
const GLUED_NUMBER = /(?:^\d{1,3}\s)|(?:\s\d{1,3}$)/;
const EMPHASIS = /^(\*\*|__|\*|_)([\s\S]*)\1$/;

// «**42**» is the page number Marker emphasised, not a word.
const unemphasised = (cell: string) => {
  const trimmed = cell.trim();
  const marked = EMPHASIS.exec(trimmed);
  return marked ? (marked[2] ?? '').trim() : trimmed;
};

// A head's pages are close; numbers far apart are a row of figures that lost its outer pipes.
const PAGE_SPREAD = 2;

const isRunningHead = (line: string) => {
  if (!line.includes('|') || line.startsWith('|') || line.endsWith('|')) return false;
  const cells = line.split('|').map(unemphasised);
  if (cells.length > 6) return false;
  const numbers: number[] = [];
  let words = 0;
  for (const cell of cells) {
    if (PAGE_NUMBERS.test(cell)) numbers.push(...cell.split(' ').map(Number));
    else if (cell !== '' && HEAD_TEXT.test(cell)) {
      words += 1;
      const glued = GLUED_NUMBER.exec(cell);
      if (glued) numbers.push(Number(glued[0]));
    } else return false;
  }
  if (numbers.length === 0 || words === 0) return false;
  return Math.max(...numbers) - Math.min(...numbers) <= PAGE_SPREAD;
};
// Marker escaping a tag and raising the escape's «&» with it: «<sup>&</sup>lt;sup>5</sup>».
const SPLIT_ENTITY = /<sup>&<\/sup>(lt|gt);/gi;
const ONE_LINE = /^.*$/;

// A heading's text: one to six `#`, a space, the text, and no closing run of `#`.
const headingOf = (line: string) => {
  let level = 0;
  while (line[level] === '#') level += 1;
  const rest = line.slice(level);
  const words = rest.trimStart();
  if (level < 1 || level > 6 || words === rest) return undefined;
  let end = words.length;
  while (end > 0 && words[end - 1] === '#') end -= 1;
  const before = words.slice(0, end);
  const text = end < words.length && /\s$/.test(before) ? before.trimEnd() : words;
  return ONE_LINE.test(text) ? text : undefined;
};

// A line that must read as text, not as a list item or a heading.
const literal = (line: string) =>
  line
    .replace(/^(\d{1,9})([.)])(?=\s)/, (_, n: string, mark: string) => n + escaped(mark))
    .replace(/^([-*+#>])(?=\s|$)/, (_, mark: string) => escaped(mark));

const cellsOf = (row: string) => row.replace(/^\|/, '').replace(/\|$/, '').split('|');

// A table row as one line, cells joined by « · », and an empty cell before a filled one as «–».
const tableRow = (row: string) => {
  const cells = cellsOf(row);
  if (cells.every((cell) => DELIMITER_CELL.test(cell))) return undefined;
  const text = cells.map((cell) => inline(cell, true));
  while (text.length > 0 && text.at(-1) === '') text.pop();
  return text.length ? literal(text.map((cell) => cell || '–').join(' · ')) : undefined;
};

export const excerptMarkdown = (markdown: string): string => {
  const lines = removeUntilStable(
    protect(markdown.replace(/\r\n?/g, '\n')).replace(SPLIT_ENTITY, (_, name: string) =>
      name.toLowerCase() === 'lt' ? '<' : '>',
    ),
    dropScriptsAndStyles,
    dropComments,
  ).split('\n');
  const alone = (i: number) => !lines[i - 1]?.trim() && !lines[i + 1]?.trim();
  const out: string[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    if (FENCE.test(raw)) fenced = !fenced;
    if (fenced || FENCE.test(raw)) {
      out.push(raw);
      continue;
    }
    const line = raw.trim();
    if (PAGE_MARKER.test(line) || THEMATIC_BREAK.test(line)) continue;
    if (isRunningHead(line) && alone(i)) continue;
    // A row the chunk cut off still counts when the row above it is whole.
    if (
      TABLE_ROW.test(line) ||
      (line.startsWith('|') && TABLE_ROW.test(lines[i - 1]?.trim() ?? ''))
    ) {
      const row = tableRow(line);
      if (row) out.push(row);
      continue;
    }
    // A list item is a line with a bullet and a heading a line of its own, as KA draws them.
    const block = line.replace(/^>\s?/, '').replace(/^[-*+]\s+/, '• ');
    const text = inline(headingOf(block) ?? block, false);
    if (text || !line) out.push(literal(text));
  }
  return restore(
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
};

// Back to the characters, for text that is drawn as text and never read as Markdown.
const restorePlain = (text: string) =>
  text.replace(NONCHARACTER, (char) =>
    char in KEPT ? '' : (ESCAPABLE[char.charCodeAt(0) - BASE] ?? ''),
  );

// The `(address)` of a heading's link: everything up to the first `)`.
const anyAddress = (text: string) => {
  const parenthesis = searcher(text, /\)/g);
  return (at: number) => {
    const close = text[at] === '(' ? parenthesis(at + 1) : null;
    return close ? close.index + 1 : -1;
  };
};

// KA's readableHeading: one step of a heading path as plain text, its marks raised.
const plain = (step: string) => {
  const kept = replaceRaisable(
    removeUntilStable(protect(step), dropScriptsAndStyles, dropComments),
    (name, inner) => {
      const text = removeUntilStable(inner, TAG).trim();
      return shifted(text, shiftedBy(name)) || text;
    },
  ).replace(BREAK_TAG, ' ');
  const pictured = images(removeUntilStable(kept, dropScriptsAndStyles, dropComments, TAG));
  let text = linkWords(pictured, '[', /\]/g, 1, anyAddress(pictured)).replace(/`([^`]+)`/g, '$1');
  text = unwrap(text, /\*\*(?=\S)/g, /(?<=\S)\*\*/g, 2);
  text = unwrap(text, /(?<![\p{L}\p{N}_])__(?=\S)/gu, /(?<=\S)__(?![\p{L}\p{N}_])/gu, 2);
  text = unwrap(text, /~~(?=\S)/g, /(?<=\S)~~/g, 2)
    .replace(/(?<![\p{L}\p{N}*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}*])/gu, '$1')
    .replace(/(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu, '$1');
  return decodeEntities(restorePlain(text)).replace(/\s+/g, ' ').trim();
};

const STEP = ' › ';

/** A heading path as one line of text; a step that was only an anchor goes with its separator. */
export const headingText = (heading: string | undefined): string | undefined => {
  if (heading === undefined) return undefined;
  return heading.split(STEP).map(plain).filter(Boolean).join(STEP) || undefined;
};
