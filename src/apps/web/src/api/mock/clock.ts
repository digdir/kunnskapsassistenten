/**
 * When a fixture happened, counted back from now.
 *
 * Relative and not written-out dates, so the thread list keeps exercising its
 * own grouping — «I dag», «Siste 7 dager», «Siste 30 dager», a month by name,
 * a year — however long after they were written somebody opens the app. Fixed
 * dates would all have drifted into «2025» by themselves.
 *
 * Its own file because two modules need it and neither may import the other:
 * the NKOM fixture in fixtures.ts, and the scripted conversations in
 * conversations/threads.ts, which fixtures.ts reads.
 */

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so a day here is the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * A CALENDAR day back, not 24 hours back: the date is shifted and the clock
 * set outright, so `daysAgo(0)` is today whether the app is opened at 08:00
 * or at 23:00. That is what the grouping asks — see `bucketFor` in
 * src/views/threads/grouping.ts — and a fixture that answered «24 hours»
 * would slide between «I dag» and «Siste 7 dager» over the course of a day.
 *
 * `hour` is what keeps two fixtures on the same day apart, and it is a
 * POSITION in the day rather than a promise about the clock. Before that hour
 * has struck, `hour:30` today is in the FUTURE, and a fixture in the future
 * is not a cosmetic problem: the thread list sorts on `updatedAt`, so a
 * thread the user just created sorted UNDER the fixtures, and `aria-current`
 * pointed at the wrong row. Measured by the conductor at 00:08 on 2026-09-16,
 * with the two top rows both showing «09:30».
 *
 * So a time that has not happened yet is placed proportionally in the part of
 * today that HAS happened. Everything the hour was there for survives —
 * order, distinct timestamps, the right calendar day — and nothing is dated
 * after now, which is the property the list depends on. The branch is only
 * reachable for `days === 0`: any earlier day is over, so `hour:30` on it is
 * always in the past.
 */
export function daysAgo(days: number, hour = 9): string {
  const now = new Date();
  const wanted = new Date(now);
  wanted.setDate(wanted.getDate() - days);
  wanted.setHours(hour, 30, 0, 0);

  if (wanted.getTime() <= now.getTime()) return wanted.toISOString();

  /*
   * `hour + 0.5` over 24, against the milliseconds since midnight. The
   * largest hour a caller can ask for lands at 23.5/24 of the way to now, so
   * every fixture is strictly earlier than now and a thread created this
   * instant is still the newest. Two hours an hour apart stay an hour apart
   * in rank, which is all the list reads them for.
   */
  const midnight = startOfDay(now);
  const elapsed = now.getTime() - midnight;
  return new Date(midnight + Math.round((elapsed * (hour + 0.5)) / 24)).toISOString();
}

/**
 * The inverse: how many calendar days ago a timestamp from `daysAgo` was.
 *
 * Here so that a caller asking «which day is this fixture on» asks it the way
 * `daysAgo` answered, rather than dividing a millisecond difference by a day.
 * That division disagrees with the fixture for most of the clock: today's
 * `daysAgo(0)` rounds up to 1 from half past nine in the evening, and before
 * the clamp above it also gave `-0` in the small hours, which `toBe(0)`
 * rejects. Measured red at 00:05 on 2026-09-16.
 *
 * The same sum as `daysBetween` in grouping.ts and threadTime.ts, and
 * deliberately not shared with them: those are the view's, this is the mock
 * API's, and neither layer may import the other.
 */
export function daysSince(timestamp: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(timestamp))) / MS_PER_DAY);
}
