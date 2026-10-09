// The thread-row timestamp, short because the group heading already says roughly when.
// Distances are measured as in `grouping.ts`, so a row never contradicts its heading.

const MS_PER_DAY = 86_400_000;

// Built once: construction is expensive, and the list rebuilds every row per search keystroke.
// `nb`, not the browser's locale, so an English machine does not get «Sep 3» in a Norwegian panel.
const clock = new Intl.DateTimeFormat('nb', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('nb', { weekday: 'long' });
const dayShortMonth = new Intl.DateTimeFormat('nb', { day: 'numeric', month: 'short' });
const dayMonth = new Intl.DateTimeFormat('nb', { day: 'numeric', month: 'long' });
const full = new Intl.DateTimeFormat('nb', { dateStyle: 'long', timeStyle: 'short' });

/** Midnight local time, so «i dag» means the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Whole calendar days, rounded: a daylight saving day is 23 or 25 hours long, and truncating
// would put a thread in the wrong bucket.
function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

export type ThreadTime = {
  /** Norwegian, short, shown in the row. */
  text: string;
  /** The `datetime` attribute, ISO 8601. */
  dateTime: string;
  /** The `title` attribute: the full date and time. */
  title: string;
};

/**
 * @param updatedAt ISO 8601 from {@link Thread.updatedAt}.
 * @returns undefined when the timestamp cannot be read, so a row shows no time
 *   rather than «Invalid Date».
 */
export function threadTime(updatedAt: string, now: Date = new Date()): ThreadTime | undefined {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return undefined;

  const days = daysBetween(now, date);
  const common = { dateTime: date.toISOString(), title: full.format(date) };

  // A future date reads as today, as in `grouping.ts`: the list should not
  // argue with the machine's clock.
  if (days <= 0) return { ...common, text: clock.format(date) };
  if (days === 1) return { ...common, text: 'i går' };
  if (days < 7) return { ...common, text: weekday.format(date) };
  if (days < 30) return { ...common, text: dayShortMonth.format(date) };

  return { ...common, text: dayMonth.format(date) };
}
