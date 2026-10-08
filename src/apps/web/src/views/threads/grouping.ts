import type { Thread } from '../../model';

// Period groups: I dag, Siste 7 dager, Siste 30 dager, then months of this year
// by name, then years. Computed, never stored, since they are relative to today.

export type ThreadGroup = {
  /** Stable within one render; used as the React key. */
  id: string;
  /** Norwegian, user-visible. */
  title: string;
  threads: Thread[];
};

/** Written out, so the grouping does not depend on which ICU data is shipped. */
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

/** Whole calendar days; rounded, since a DST change makes a day 23 or 25 hours. */
function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / MS_PER_DAY);
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('nb-NO') + word.slice(1);
}

function bucketFor(date: Date, now: Date): { id: string; title: string } {
  const days = daysBetween(now, date);

  // A future date counts as today: the list does not argue with the clock.
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

/** Groups threads newest first; sorted first, a group never reappears once passed. */
export function groupThreads(threads: Thread[], now: Date = new Date()): ThreadGroup[] {
  // The id breaks ties (fixtures share a clock, a backend can write two
  // threads in one millisecond), so a refetch never swaps two rows.
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
