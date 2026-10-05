import type { Thread } from '../../model';

/**
 * Period grouping for the thread list, decided by Lars 2026-09-11
 * (design/svar-skjema.md, answer 6):
 *
 *   I dag · Siste 7 dager · Siste 30 dager · the month before by name
 *   (e.g. juli) · the month before that · … · earlier years as «2025»
 *
 * The groups are computed, never stored: «måneden før» is relative to today,
 * so a thread moves from one group to another as time passes. That makes this
 * client work, not API work.
 */

export type ThreadGroup = {
  /** Stable within one render; used as the React key and for the heading id. */
  id: string;
  /** Norwegian, user-visible. */
  title: string;
  threads: Thread[];
};

/**
 * Month names in Norwegian, written out rather than taken from
 * `toLocaleDateString`. The list is nine words long, it never changes, and
 * hardcoding it makes the grouping independent of which ICU data the browser
 * or the build agent happens to ship.
 */
const MONTHS_NB = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember',
];

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so «i dag» means the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole calendar days between two dates. Rounded, because a daylight saving
 * change makes one of the days 23 or 25 hours long and truncation would then
 * put a thread in the wrong group twice a year.
 */
function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('nb-NO') + word.slice(1);
}

function bucketFor(date: Date, now: Date): { id: string; title: string } {
  const days = daysBetween(now, date);

  // A date in the future is treated as today rather than dropped: the clock on
  // the machine is not something the list should argue with.
  if (days <= 0) return { id: 'today', title: 'I dag' };
  if (days < 7) return { id: 'last-7-days', title: 'Siste 7 dager' };
  if (days < 30) return { id: 'last-30-days', title: 'Siste 30 dager' };

  if (date.getFullYear() === now.getFullYear()) {
    return {
      id: `month-${date.getFullYear()}-${date.getMonth()}`,
      title: capitalize(MONTHS_NB[date.getMonth()]),
    };
  }

  return { id: `year-${date.getFullYear()}`, title: String(date.getFullYear()) };
}

/**
 * Groups threads newest first. Sorting first means the buckets come out in
 * the correct order on their own: the rule is monotonic in time, so a group
 * can never reappear once it has been passed.
 */
export function groupThreads(threads: Thread[], now: Date = new Date()): ThreadGroup[] {
  /*
   * The id breaks a tie, and a tie is not hypothetical: the mock fixtures are
   * stamped from the same clock, and a real backend can write two threads in
   * the same millisecond. `Array.prototype.sort` is stable, so without a
   * tiebreak the order is the order the caller happened to pass — which is
   * one thing in the list and another after a refetch, and the list would
   * swap two rows for no reason the reader can see.
   */
  const newestFirst = [...threads].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
      a.id.localeCompare(b.id, 'nb-NO'),
  );

  const groups: ThreadGroup[] = [];

  for (const thread of newestFirst) {
    const bucket = bucketFor(new Date(thread.updatedAt), now);
    const current = groups.at(-1);

    if (current?.id === bucket.id) current.threads.push(thread);
    else groups.push({ ...bucket, threads: [thread] });
  }

  return groups;
}
