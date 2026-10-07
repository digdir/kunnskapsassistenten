/**
 * Years as periods: the text a reader types, and the set of chosen years
 * drawn as ranges. Pure, so every form the field understands is a unit test.
 *
 * Behind the `year-ranges` flag (#115). The filter is still a list of years —
 * that is what the backend takes, and nothing about the request changes. The
 * periods are only how the field reads and draws that list: three years in a
 * row are one chip, «2022–2024», and a gap makes two.
 */

import { currentYear } from '../../../shared/years.ts';

/** From and to, both included. A single year has `from === to`. */
export type YearRange = { from: number; to: number };

/*
 * Between the two years: a hyphen, an en or em dash, or «til», with or
 * without spaces. Open periods («fra 2015», «til 2010») are not read in this
 * round, so «til» only counts between two years.
 */
const RANGE = /^(\d{2}|\d{4})\s*(?:-|–|—|til)\s*(\d{2}|\d{4})$/u;
const SINGLE = /^(\d{2}|\d{4})$/u;

/**
 * A two-digit year: the 2000s up to this year's last two digits, the 1900s
 * above them. In 2026, «23» is 2023 and «92» is 1992.
 */
function fullYear(digits: string, thisYear: number): number {
  const value = Number(digits);
  if (digits.length === 4) return value;
  return value > thisYear % 100 ? 1900 + value : 2000 + value;
}

/**
 * The end of a range written with two digits, as in «2023–28» or «23-28»: the
 * first year from the start onwards that ends in those digits. The start is
 * read by the rule above and the end follows it, so «23-28» is 2023–2028 and
 * «92-00» is 1992–2000 even when 28 is above this year's two digits.
 */
function endAfter(start: number, digits: string): number {
  const century = start - (start % 100);
  const candidate = century + Number(digits);
  return candidate >= start ? candidate : candidate + 100;
}

/**
 * What a reader typed, as a period. Undefined for anything else; while the
 * text is on its way to one, `suggestPeriods` offers what it may become.
 *
 * Understood: «2021», «2023-2028», «2023–2028», «2023 til 2028», «23-28»,
 * «92-00» and «2023–28». A range of full years written backwards is turned
 * round; one that ends in two digits always ends after its start.
 */
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

/*
 * A start the reader has written in full, then the beginning of a period's
 * end: «2019-», «2019-2», «2019 til 20», or «2019 t» on the way to «til».
 */
const OPEN_RANGE = /^(\d{2}|\d{4})\s*(?:(?:-|–|—|til)\s*(\d{0,4})|ti?)$/u;
const DIGITS = /^\d{1,4}$/u;

/** «23» for 2023 and «05» for 2005, as a period's end may be written. */
function lastTwoDigits(year: number): string {
  return String(year % 100).padStart(2, '0');
}

/**
 * The years the facets hold documents for, in order. A year listed with no
 * count holds some as far as anyone knows: in bff and live the counts are
 * left out once another field is ticked (`facetsFrom`).
 */
function yearsWithDocuments(values: readonly { value: string; count?: number }[]): number[] {
  const years = values
    .filter((value) => value.count === undefined || value.count > 0)
    .map((value) => asYear(value.value))
    .filter((year) => Number.isInteger(year));
  return [...new Set(years)].sort((a, b) => a - b);
}

/**
 * What the list offers while the reader is still writing.
 *
 *   - The text read as a period by `parseYearInput`, when it is one, with or
 *     without documents, as before.
 *   - Digits that begin a year: the years with documents that begin with
 *     them. «2» is every year from 2000 on, «202» the 2020s.
 *   - A start and the beginning of an end: the periods from that start to a
 *     later year with documents whose end begins so, written in full or with
 *     two digits. «2019-2» and «2019-20» are 2019–2020, 2019–2021 and on.
 *
 * Years newest first, as the year field without the flag lists them (the
 * facets come so from the mock and the server). Periods from one start
 * shortest first, the order their ends are typed in.
 *
 * Empty when nothing fits, which is when the field shows its hint.
 */
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

/**
 * A set of years as periods: years in a row are one range, a gap starts the
 * next. Duplicates and order do not matter, and anything that is not a whole
 * year is left out.
 */
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

/**
 * How many documents a period holds, summed from the facet's counts. A year
 * the facet does not list holds none. Undefined when the facet has no counts
 * at all, as in live mode, so the field shows no number rather than a 0 that
 * is not true.
 */
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
