import { afterEach, describe, expect, it, vi } from 'vitest';
import { daysAgo, daysSince } from './clock';

/**
 * A fixture's day has to be its day at every hour of the clock.
 *
 * `conversations.test.ts` asserted it with a millisecond difference divided
 * by a day, and that suite was red between midnight and 09:30 with every
 * fixture correct: the first scripted conversation is `daysAgo(0, 9)`, and
 * before 09:30 the difference is negative and rounds to `-0`. Nobody would
 * have seen it in office hours. These run the clock instead of waiting for
 * it.
 */
describe('daysAgo og daysSince', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Local midnight, a quarter past nine, and a minute to midnight — the three
  // places the two readings of «a day» come apart. 2026-09-16 is a Wednesday
  // well clear of a daylight saving change, so nothing here rides on one.
  const hours = [
    ['midnatt', '2026-09-16T00:05:00'],
    ['rett før fixturens klokkeslett', '2026-09-16T09:15:00'],
    ['midt på dagen', '2026-09-16T12:00:00'],
    ['rett før midnatt', '2026-09-16T23:59:00'],
  ] as const;

  for (const [when, now] of hours) {
    it(`gir samme dag ${when}`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));

      for (const days of [0, 1, 3, 6, 29, 400]) {
        // `Object.is`, not `toBe` alone: `-0` is the failure this exists to
        // catch, and it is equal to 0 under `==` and under `===`.
        expect(Object.is(daysSince(daysAgo(days)), days), `${days} dager siden`).toBe(true);
      }
    });
  }

  it('teller kalenderdøgn, ikke 24 timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:30:00'));

    // 23 hours ago, but yesterday: the grouping says «I går», not «I dag».
    expect(daysSince('2026-09-15T01:30:00')).toBe(1);
    // 30 minutes ago, and today.
    expect(daysSince('2026-09-16T00:00:00')).toBe(0);
  });

  it('legger aldri en fixtur i framtida', () => {
    /*
     * The thread list sorts on `updatedAt`, so a fixture dated later today
     * sorts above a thread the user created a second ago — and `aria-current`
     * then points at the wrong row. Measured by the conductor at 00:08, where
     * the two top rows both showed «09:30».
     *
     * Every hour a caller uses, at the hour of the night where the naive sum
     * fails worst.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:08:00'));

    const now = Date.now();
    for (const hour of [0, 8, 9, 12, 23]) {
      expect(Date.parse(daysAgo(0, hour)), `daysAgo(0, ${hour})`).toBeLessThan(now);
      // And still today, so the grouping still says «I dag».
      expect(daysSince(daysAgo(0, hour)), `daysAgo(0, ${hour})`).toBe(0);
    }
  });

  it('holder rekkefølgen mellom fixturer på samme dag', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:08:00'));

    // `hour` is what keeps two fixtures on one day apart — the NKOM thread is
    // created at 8 and updated at 9 — so the order has to survive the clamp.
    const created = Date.parse(daysAgo(0, 8));
    const updated = Date.parse(daysAgo(0, 9));
    expect(created).toBeLessThan(updated);

    // A thread the user makes right now is newer than all of them.
    expect(updated).toBeLessThan(Date.now());
  });

  it('bruker klokkeslettet når det har passert', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T14:00:00'));

    // Nothing is clamped in daylight, so the fixtures read as they were
    // written: «09:30» in the row, not a time derived from the clock.
    expect(new Date(daysAgo(0, 9)).getHours()).toBe(9);
    expect(new Date(daysAgo(0, 9)).getMinutes()).toBe(30);
    // An earlier day is over, so its hour is never clamped at any time of day.
    expect(new Date(daysAgo(3, 9)).getHours()).toBe(9);
  });
});
