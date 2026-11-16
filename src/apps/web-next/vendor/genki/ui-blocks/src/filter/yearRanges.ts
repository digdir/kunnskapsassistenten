// Years as periods for `yearPeriods`; the filter itself stays a list of years.

/** From and to, both included. A single year has `from === to`. */
export interface YearRange {
  from: number;
  to: number;
}

const currentYear = () => new Date().getFullYear();

// A hyphen, an en or em dash, «til» or «to» between two years; open periods are not read.
const RANGE = /^(\d{2}|\d{4})\s*(?:-|–|—|til|to)\s*(\d{2}|\d{4})$/u;
const SINGLE = /^(\d{2}|\d{4})$/u;

/** Two digits are the 2000s up to this year's last two, else the 1900s. */
const fullYear = (digits: string, thisYear: number): number => {
  const value = Number(digits);
  if (digits.length === 4) return value;
  return value > thisYear % 100 ? 1900 + value : 2000 + value;
};

/** A two-digit end, «92-00»: the first year from the start that ends in those digits. */
const endAfter = (start: number, digits: string): number => {
  const century = start - (start % 100);
  const candidate = century + Number(digits);
  return candidate >= start ? candidate : candidate + 100;
};

/** What a reader typed as a period, «2023-2028» or «23-28», or undefined. */
export const parseYearInput = (text: string, thisYear = currentYear()): YearRange | undefined => {
  const input = text.trim().toLocaleLowerCase('nb-NO');

  const single = SINGLE.exec(input);
  if (single?.[1]) {
    const year = fullYear(single[1], thisYear);
    return { from: year, to: year };
  }

  const range = RANGE.exec(input);
  const first = range?.[1];
  const second = range?.[2];
  if (!first || !second) return undefined;
  const from = fullYear(first, thisYear);
  const to = second.length === 2 ? endAfter(from, second) : fullYear(second, thisYear);
  return from <= to ? { from, to } : { from: to, to: from };
};

// A full start and the beginning of an end: «2019-», «2019 til 20»; «to» is «til».
const OPEN_RANGE = /^(\d{2}|\d{4})\s*(?:(?:-|–|—|til|to)\s*(\d{0,4})|ti?)$/u;
const DIGITS = /^\d{1,4}$/u;

/** «23» for 2023 and «05» for 2005, as a period's end may be written. */
const lastTwoDigits = (year: number) => String(year % 100).padStart(2, '0');

/** A year as the filter holds it, a string of digits, or NaN. */
const asYear = (year: number | string): number => {
  if (typeof year === 'number') return year;
  return /^\d+$/u.test(year.trim()) ? Number(year) : Number.NaN;
};

type Counted = readonly { value: string; count?: number | undefined }[];

/** Years with documents, in order. No count counts as some: a platform may leave counts out. */
const yearsWithDocuments = (values: Counted): number[] => {
  const years = values
    .filter((value) => value.count === undefined || value.count > 0)
    .map((value) => asYear(value.value))
    .filter((year) => Number.isInteger(year));
  return [...new Set(years)].sort((a, b) => a - b);
};

/** A stable key for a period, for a chip or a list option: «2022-2024». */
export const rangeKey = ({ from, to }: YearRange) => `${from}-${to}`;

/** What the list offers for the text so far, newest first, then shortest first. */
export const suggestPeriods = (
  text: string,
  values: Counted,
  thisYear = currentYear(),
): YearRange[] => {
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
  if (open?.[1]) {
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
};

/**
 * The years a period stands for: those in it that the field lists with documents. Not every
 * calendar year, so «1800-2015» is as many values as the collection has years, never more than
 * the field holds.
 */
export const listedYearsIn = (range: YearRange, values: Counted): number[] =>
  yearsWithDocuments(values).filter((year) => year >= range.from && year <= range.to);

/** Every year in a period, in order. */
export const yearsIn = ({ from, to }: YearRange): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Years as periods, years in a row as one; anything not a whole year is left out. */
export const toRanges = (years: Iterable<number | string>): YearRange[] => {
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
};

/** «2019», or «2022–2024» with an en dash, as Norwegian writes a period. */
export const formatRange = ({ from, to }: YearRange) =>
  from === to ? String(from) : `${from}–${to}`;

/** The period a key stands for, or undefined if it is not one. */
export const rangeFromKey = (key: string): YearRange | undefined => {
  const match = /^(\d{4})-(\d{4})$/u.exec(key);
  if (!match) return undefined;
  const from = Number(match[1]);
  const to = Number(match[2]);
  return from <= to ? { from, to } : undefined;
};

/**
 * Documents in a period from the facet's counts; undefined without counts. Exact for a year; for
 * longer periods it is the sum over its years, and a document with several years counts in each.
 */
export const documentsIn = (range: YearRange, values: Counted): number | undefined => {
  if (values.length > 0 && values.every((value) => value.count === undefined)) return undefined;
  let total = 0;
  for (const value of values) {
    const year = Number(value.value);
    if (year >= range.from && year <= range.to) total += value.count ?? 0;
  }
  return total;
};
