import { intlLocale, type Format, type Locale } from '@genai/i18n';

// Calendar days in the zone the platform formats every time in, so «i går» means the day before
// on the clock the reader reads, and a day of 23 or 25 hours counts as one.
const timeZone = 'Europe/Oslo';
const msPerDay = 86_400_000;

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const daySerial = (date: Date) => {
  const parts = dayParts.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / msPerDay;
};

const clockParts = new Intl.DateTimeFormat('en-GB', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * The clock as kunnskapsassistenten writes it, «14:32», in every language. The platform's format
 * writes «14.32» in Norwegian; the blocks follow kunnskapsassistenten, their north star, on this
 * (decided 3 November 2026), as its thread list and its answers do.
 */
export const clock = (date: Date) => {
  const parts = clockParts.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
};

// Built once per locale: a long thread formats a time for every answer on every render.
const dayMonthFormats = new Map<Locale, Intl.DateTimeFormat>();
const dayMonth = (locale: Locale) => {
  let format = dayMonthFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone,
      day: 'numeric',
      month: 'short',
    });
    dayMonthFormats.set(locale, format);
  }
  return format;
};

export interface AnswerTimeText {
  /** Short, as the thread list writes a row's time. */
  text: string;
  /** For the `datetime` attribute. */
  dateTime: string;
  /** The whole date and time: the `title`, and what a screen reader hears. */
  title: string;
}

/** The words a time is written with, from the catalogue: no Norwegian in code. */
export interface AnswerTimeWords {
  yesterday: string;
  /** The whole date and the clock as one: «12. mai 2025 kl. 09:05». */
  dateTime: (date: string, time: string) => string;
}

/** When an answer came: the clock today, «i går», a weekday, else day and month; or undefined. */
export const answerTime = (
  value: string | number | Date,
  f: Format,
  words: AnswerTimeWords,
  now: Date = new Date(),
): AnswerTimeText | undefined => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const days = daySerial(now) - daySerial(date);
  // The whole date as the platform writes it, with the same clock as the short text.
  const title = words.dateTime(f.date(date, 'long'), clock(date));
  const common = { dateTime: date.toISOString(), title };
  // A time ahead of the machine's clock reads as today: the answer does not argue with the clock.
  if (days <= 0) return { ...common, text: clock(date) };
  if (days === 1) return { ...common, text: words.yesterday };
  if (days < 7) return { ...common, text: f.weekday(date) };
  return { ...common, text: dayMonth(f.locale).format(date) };
};
