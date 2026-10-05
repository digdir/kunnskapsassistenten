import { describe, expect, it } from 'vitest';
import { groupThreads } from '../views/threads/grouping';
import { threadTime } from './threadTime';

/** A Tuesday, so the weekday cases are not all the same day. */
const now = new Date(2026, 8, 15, 14, 0, 0);
const at = (...args: [number, number, number, number?, number?]) => new Date(...args).toISOString();

describe('threadTime', () => {
  it('shows the clock for today, since the heading already says «I dag»', () => {
    const when = threadTime(at(2026, 8, 15, 14, 32), now);

    expect(when?.text).toBe('14:32');
  });

  it('says «i går» rather than naming the weekday', () => {
    expect(threadTime(at(2026, 8, 14, 9, 5), now)?.text).toBe('i går');
  });

  it('names the weekday inside «Siste 7 dager»', () => {
    // 11 September 2026 is a Friday, two days before the seven-day edge.
    expect(threadTime(at(2026, 8, 11, 9, 5), now)?.text).toBe('fredag');
  });

  it('switches to day and month once the weekday stops being enough', () => {
    // Inside «Siste 30 dager», where a weekday would not say which one.
    expect(threadTime(at(2026, 7, 28, 9, 5), now)?.text).toBe('28. aug.');
  });

  it('writes day and month in the month and year groups', () => {
    expect(threadTime(at(2026, 6, 12, 9, 5), now)?.text).toBe('12. juli');
    // The year belongs to the group heading, which is «2025».
    expect(threadTime(at(2025, 4, 12, 9, 5), now)?.text).toBe('12. mai');
  });

  it('carries the machine date and the whole date, whatever the short text says', () => {
    const iso = at(2025, 4, 12, 9, 5);
    const when = threadTime(iso, now);

    expect(when?.dateTime).toBe(iso);
    expect(when?.title).toBe('12. mai 2025 kl. 09:05');
  });

  it('gives up quietly on a timestamp it cannot read', () => {
    // A row with a broken date shows no time. «Invalid Date» in the list
    // would be worse than saying nothing.
    expect(threadTime('ikke en dato', now)).toBeUndefined();
  });

  it('never contradicts the group heading it sits under', () => {
    // The two read the same `updatedAt` through the same day arithmetic, and
    // this is the test that keeps them that way: every bucket gets the label
    // the rule above says it should, measured against groupThreads itself.
    const threads = [
      { id: 'a', title: 'i dag', createdAt: at(2026, 8, 15), updatedAt: at(2026, 8, 15, 14, 32) },
      { id: 'b', title: 'i går', createdAt: at(2026, 8, 14), updatedAt: at(2026, 8, 14, 9, 5) },
      { id: 'c', title: 'uka', createdAt: at(2026, 8, 11), updatedAt: at(2026, 8, 11, 9, 5) },
      { id: 'd', title: 'måneden', createdAt: at(2026, 7, 28), updatedAt: at(2026, 7, 28, 9, 5) },
      { id: 'e', title: 'juli', createdAt: at(2026, 6, 12), updatedAt: at(2026, 6, 12, 9, 5) },
      { id: 'f', title: 'i fjor', createdAt: at(2025, 4, 12), updatedAt: at(2025, 4, 12, 9, 5) },
    ];

    const labelled = groupThreads(threads, now).map((group) => [
      group.title,
      ...group.threads.map((thread) => threadTime(thread.updatedAt, now)?.text),
    ]);

    expect(labelled).toEqual([
      ['I dag', '14:32'],
      ['Siste 7 dager', 'i går', 'fredag'],
      ['Siste 30 dager', '28. aug.'],
      ['Juli', '12. juli'],
      ['2025', '12. mai'],
    ]);
  });
});
