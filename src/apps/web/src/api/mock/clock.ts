// Fixture times counted back from now, so every thread-list group stays exercised whenever the
// app is opened. Its own file because fixtures.ts and conversations/threads.ts both need it.

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so a day here is the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * A CALENDAR day back, as `bucketFor` (src/views/threads/grouping.ts) expects; `hour` only
 * orders fixtures within a day. Never date one in the future, or a new thread sorts under it:
 * an hour not yet reached today is scaled into the part of today that has passed.
 */
export function daysAgo(days: number, hour = 9): string {
  const now = new Date();
  const wanted = new Date(now);
  wanted.setDate(wanted.getDate() - days);
  wanted.setHours(hour, 30, 0, 0);

  if (wanted.getTime() <= now.getTime()) return wanted.toISOString();

  // `hour + 0.5` over 24 of the time since midnight: strictly before now, order of hours kept.
  const midnight = startOfDay(now);
  const elapsed = now.getTime() - midnight;
  return new Date(midnight + Math.round((elapsed * (hour + 0.5)) / 24)).toISOString();
}

/**
 * Calendar days since a `daysAgo` timestamp (dividing milliseconds rounds today up late in the
 * evening). Same sum as `daysBetween` in the views, deliberately not shared across layers.
 */
export function daysSince(timestamp: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(timestamp))) / MS_PER_DAY);
}
