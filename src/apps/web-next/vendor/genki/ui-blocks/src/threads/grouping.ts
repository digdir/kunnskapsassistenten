import { intlLocale, type Format, type Locale } from '@genai/i18n';
import type { ThreadItem } from './types.js';

// Groups and row times count the same days in the same zone, so they never disagree.
const timeZone = 'Europe/Oslo';
const msPerDay = 86_400_000;

const dayParts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

interface CalendarDay {
  year: number;
  month: number;
  /** Whole days since the epoch, so two days subtract without daylight saving in the way. */
  serial: number;
}

const calendarDay = (date: Date): CalendarDay => {
  const parts = dayParts.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = part('year');
  const month = part('month');
  return { year, month, serial: Date.UTC(year, month - 1, part('day')) / msPerDay };
};

export const toDate = (value: ThreadItem['updatedAt']) =>
  value instanceof Date ? value : new Date(value);

const readable = (date: Date) => !Number.isNaN(date.getTime());

export type ThreadPeriod = 'today' | 'last7' | 'last30' | 'month' | 'year' | 'undated';

export interface ThreadGroup {
  /** Stable within one render, for the React key. */
  id: string;
  period: ThreadPeriod;
  /** The first thread's date, which names a month group. */
  date: Date;
  /** The calendar year, which names a year group. */
  year: number;
  threads: ThreadItem[];
}

const bucketOf = (date: Date, today: CalendarDay): Pick<ThreadGroup, 'id' | 'period'> => {
  if (!readable(date)) return { id: 'undated', period: 'undated' };
  const day = calendarDay(date);
  const days = today.serial - day.serial;
  // A future date counts as today: the list does not argue with the clock.
  if (days <= 0) return { id: 'today', period: 'today' };
  if (days < 7) return { id: 'last-7-days', period: 'last7' };
  if (days < 30) return { id: 'last-30-days', period: 'last30' };
  if (day.year === today.year) return { id: `month-${day.year}-${day.month}`, period: 'month' };
  return { id: `year-${day.year}`, period: 'year' };
};

const byId = (a: ThreadItem, b: ThreadItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Today, 7 days, 30 days, this year's months, then years; an unreadable time comes last. */
export const groupThreads = (
  threads: readonly ThreadItem[],
  now: Date = new Date(),
): ThreadGroup[] => {
  const today = calendarDay(now);
  const timed = threads.map((thread) => ({ thread, date: toDate(thread.updatedAt) }));
  // The id breaks ties, so two threads written in one millisecond never swap on a refetch.
  timed.sort((a, b) => {
    const [x, y] = [a.date.getTime(), b.date.getTime()];
    if (Number.isNaN(x) || Number.isNaN(y))
      return Number(Number.isNaN(x)) - Number(Number.isNaN(y)) || byId(a.thread, b.thread);
    return y - x || byId(a.thread, b.thread);
  });

  const groups: ThreadGroup[] = [];
  for (const { thread, date } of timed) {
    const bucket = bucketOf(date, today);
    const last = groups.at(-1);
    if (last?.id === bucket.id) last.threads.push(thread);
    else
      groups.push({
        ...bucket,
        date,
        year: readable(date) ? calendarDay(date).year : 0,
        threads: [thread],
      });
  }
  return groups;
};

export interface RowTime {
  /** Short, since the group heading already says roughly when. */
  text: string;
  /** For the `datetime` attribute. */
  dateTime: string;
  /** The whole date and time, for the `title` attribute. */
  title: string;
}

const clockParts = new Intl.DateTimeFormat('en-GB', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The clock with a colon, «14:32», in every language, as kunnskapsassistenten writes it. */
export const clock = (date: Date) => {
  const parts = clockParts.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
};

const dayMonthFormats = new Map<string, Intl.DateTimeFormat>();
const dayMonth = (locale: Locale, month: 'short' | 'long') => {
  const key = `${locale}-${month}`;
  let format = dayMonthFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), { timeZone, day: 'numeric', month });
    dayMonthFormats.set(key, format);
  }
  return format;
};

/** The catalogue's words for a row's time: «i går», and the whole date with the clock. */
export interface RowTimeWords {
  yesterday: string;
  /** The whole date and the clock as one phrase, «{date} kl. {clock}» in bokmål. */
  dateAtClock: (date: string, clock: string) => string;
}

/** The row's time: the clock today, «i går», the weekday this week, then day and month. */
export const rowTime = (
  value: ThreadItem['updatedAt'],
  f: Format,
  words: RowTimeWords,
  now: Date = new Date(),
): RowTime | undefined => {
  const date = toDate(value);
  if (!readable(date)) return undefined;
  const days = calendarDay(now).serial - calendarDay(date).serial;
  // The whole date as the platform writes it, with the clock as the row writes it.
  const title = words.dateAtClock(f.date(date), clock(date));
  const common = { dateTime: date.toISOString(), title };
  if (days <= 0) return { ...common, text: clock(date) };
  if (days === 1) return { ...common, text: words.yesterday };
  if (days < 7) return { ...common, text: f.weekday(date) };
  return { ...common, text: dayMonth(f.locale, days < 30 ? 'short' : 'long').format(date) };
};
