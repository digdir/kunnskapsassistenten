/**
 * The timestamp on a thread row.
 *
 * Every row carries `updatedAt`, and until now nothing drew it: «den jeg
 * kjørte før møtet på tirsdag» was unanswerable in a list where the only
 * thing on screen was a title (brukerreiser 2026-09-15, punkt 3).
 *
 * The text is deliberately short, because it is read next to a group heading
 * that already says roughly when: «I dag», «Siste 7 dager», «Siste 30 dager»,
 * a month name, a year. Repeating the heading on every row would be noise, so
 * each distance says the part the heading does not:
 *
 *   today            → the clock,  «14:32»
 *   yesterday        → «i går»
 *   this week        → the weekday, «tirsdag»
 *   within 30 days   → day and short month, «3. sep.»
 *   this year        → day and month, «12. juli»
 *   an earlier year  → day and month, «12. mai» — the heading is the year
 *
 * The distance is measured the same way `grouping.ts` measures it, and from
 * the same `updatedAt`, so a row can never carry a label that contradicts the
 * heading it sits under.
 *
 * Nothing is lost by shortening: `title` always holds the full date and time,
 * and `datetime` holds the machine-readable one.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Formatters, built once. `Intl.DateTimeFormat` is expensive to construct and
 * a thread list rebuilds every row on every keystroke in the search field.
 *
 * `nb` and not the browser's locale: the service is Norwegian, and a user
 * with an English machine should not get «Sep 3» in a Norwegian panel.
 */
const clock = new Intl.DateTimeFormat('nb', { hour: '2-digit', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat('nb', { weekday: 'long' });
const dayShortMonth = new Intl.DateTimeFormat('nb', { day: 'numeric', month: 'short' });
const dayMonth = new Intl.DateTimeFormat('nb', { day: 'numeric', month: 'long' });
const full = new Intl.DateTimeFormat('nb', { dateStyle: 'long', timeStyle: 'short' });

/** Midnight local time, so «i dag» means the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole calendar days between two dates. Rounded, for the same reason
 * `grouping.ts` rounds: a daylight saving change makes one day 23 or 25 hours
 * long, and truncating would move a thread into the wrong bucket twice a year.
 */
function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

export type ThreadTime = {
  /** Norwegian, short, shown in the row. */
  text: string;
  /** The `datetime` attribute: ISO 8601, what a machine reads. */
  dateTime: string;
  /** The `title` attribute: the whole date and time, for anyone who wants it. */
  title: string;
};

/**
 * @param updatedAt ISO 8601 from {@link Thread.updatedAt}.
 * @returns undefined when the timestamp cannot be read. A row with a broken
 *   date shows no time rather than «Invalid Date»; the list still works.
 */
export function threadTime(updatedAt: string, now: Date = new Date()): ThreadTime | undefined {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return undefined;

  const days = daysBetween(now, date);
  const common = { dateTime: date.toISOString(), title: full.format(date) };

  // A date in the future reads as today, the same choice `grouping.ts` makes:
  // the clock on the machine is not something the list should argue with.
  if (days <= 0) return { ...common, text: clock.format(date) };
  if (days === 1) return { ...common, text: 'i går' };
  if (days < 7) return { ...common, text: weekday.format(date) };
  if (days < 30) return { ...common, text: dayShortMonth.format(date) };

  return { ...common, text: dayMonth.format(date) };
}
