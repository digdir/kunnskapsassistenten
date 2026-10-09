/** Years as periods for the `year-ranges` flag (digdir/kunnskapsassistenten#115); pure, for
 * unit tests. The filter stays a list of years, which is what the backend takes; periods are
 * only how the field reads and draws it. */

import { currentYear } from '../../../shared/years.ts';

/** From and to, both included. A single year has `from === to`. */
export type YearRange = { from: number; to: number };

// A hyphen, an en or em dash, or «til» between two years; open periods are not read.
const RANGE = /^(\d{2}|\d{4})\s*(?:-|–|—|til)\s*(\d{2}|\d{4})$/u;
const SINGLE = /^(\d{2}|\d{4})$/u;

/** Two digits are the 2000s up to this year's last two, else the 1900s. */
function fullYear(digits: string, thisYear: number): number {
  const value = Number(digits);
  if (digits.length === 4) return value;
  return value > thisYear % 100 ? 1900 + value : 2000 + value;
}

/** A two-digit end («2023–28», «92-00»): the first year from the start that ends in those
 * digits, whatever this year is. */
function endAfter(start: number, digits: string): number {
  const century = start - (start % 100);
  const candidate = century + Number(digits);
  return candidate >= start ? candidate : candidate + 100;
}

/** What a reader typed, as a period, or undefined. Reads «2021», «2023-2028», «2023–2028»,
 * «2023 til 2028», «23-28» and «2023–28». Full years written backwards are turned round; a
 * two-digit end always follows its start. */
export function parseYearInput(text: string, thisYear = currentYear()): YearRange | undefined {
  const input = text.trim().toLocaleLowerCase('nb-NO');

  const single = SINGLE.exec(input);
  if (single) {
    const year = fullYear(single[1], thisYear);
    return { from: year, to: year };
  }

  const range = RANGE.exec(input);
  if (!range) return undefined;
  const [, first, second] = range;
  const from = fullYear(first, thisYear);
  const to = second.length === 2 ? endAfter(from, second) : fullYear(second, thisYear);
  return from <= to ? { from, to } : { from: to, to: from };
}

// A full start and the beginning of an end: «2019-», «2019 til 20», «2019 t».
const OPEN_RANGE = /^(\d{2}|\d{4})\s*(?:(?:-|–|—|til)\s*(\d{0,4})|ti?)$/u;
const DIGITS = /^\d{1,4}$/u;

/** «23» for 2023 and «05» for 2005, as a period's end may be written. */
function lastTwoDigits(year: number): string {
  return String(year % 100).padStart(2, '0');
}

/** Years with documents, in order. No count counts as some: bff and live leave counts out
 * once another field is ticked (`facetsFrom`). */
function yearsWithDocuments(values: readonly { value: string; count?: number }[]): number[] {
  const years = values
    .filter((value) => value.count === undefined || value.count > 0)
    .map((value) => asYear(value.value))
    .filter((year) => Number.isInteger(year));
  return [...new Set(years)].sort((a, b) => a - b);
}

/** What the list offers for the text so far: the text as a period (`parseYearInput`), with
 * documents or not; years with documents that begin with the digits typed; and periods from a
 * typed start to later years with documents whose end, in full or two digits, begins as typed.
 * Sorted by start, newest first, then shortest first. Empty when nothing fits. */
export function suggestPeriods(
  text: string,
  values: readonly { value: string; count?: number }[],
  thisYear = currentYear(),
): YearRange[] {
  const input = text.trim().toLocaleLowerCase('nb-NO');
  const found = new Map<string, YearRange>();
  const add = (range: YearRange) => found.set(rangeKey(range), range);

  const whole = parseYearInput(input, thisYear);
  if (whole) add(whole);

  const years = yearsWithDocuments(values);

  if (DIGITS.test(input)) {
    for (const year of years) if (String(year).startsWith(input)) add({ from: year, to: year });
  }

  const open = OPEN_RANGE.exec(input);
  if (open) {
    const from = fullYear(open[1], thisYear);
    const end = open[2] ?? '';
    for (const year of years) {
      if (year <= from) continue;
      const inFull = String(year).startsWith(end);
      // Two digits end a period within a hundred years of its start (endAfter).
      const short = end.length <= 2 && year - from < 100 && lastTwoDigits(year).startsWith(end);
      if (inFull || short) add({ from, to: year });
    }
  }

  return [...found.values()].sort((a, b) => b.from - a.from || a.to - b.to);
}

/** Every year in a period, in order. */
export function yearsIn({ from, to }: YearRange): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/** A year as the filter holds it, a string of digits, or NaN. */
function asYear(year: number | string): number {
  if (typeof year === 'number') return year;
  return /^\d+$/u.test(year.trim()) ? Number(year) : Number.NaN;
}

/** Years as periods, years in a row as one. Any order, duplicates allowed, and anything not a
 * whole year is left out. */
export function toRanges(years: Iterable<number | string>): YearRange[] {
  const sorted = [...new Set([...years].map(asYear))]
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => a - b);
  const ranges: YearRange[] = [];
  for (const year of sorted) {
    const last = ranges.at(-1);
    if (last && year === last.to + 1) last.to = year;
    else ranges.push({ from: year, to: year });
  }
  return ranges;
}

/** «2019», or «2022–2024» with an en dash, as Norwegian writes a period. */
export function formatRange({ from, to }: YearRange): string {
  return from === to ? String(from) : `${from}–${to}`;
}

/** A stable key for a period, for a chip or a list option: «2022-2024». */
export function rangeKey({ from, to }: YearRange): string {
  return `${from}-${to}`;
}

/** The period a key stands for, or undefined if it is not one. */
export function rangeFromKey(key: string): YearRange | undefined {
  const match = /^(\d{4})-(\d{4})$/u.exec(key);
  if (!match) return undefined;
  const from = Number(match[1]);
  const to = Number(match[2]);
  return from <= to ? { from, to } : undefined;
}

/** Documents in a period, from the facet's counts; an unlisted year holds none. Undefined when
 * the facet has no counts (live), so no false 0 is shown. */
export function documentsIn(
  range: YearRange,
  values: readonly { value: string; count?: number }[],
): number | undefined {
  if (values.length > 0 && values.every((value) => value.count === undefined)) return undefined;
  let total = 0;
  for (const value of values) {
    const year = Number(value.value);
    if (year >= range.from && year <= range.to) total += value.count ?? 0;
  }
  return total;
}
