import { describe, expect, it } from 'vitest';
import type { Thread } from '../../model';
import { groupThreads } from './grouping';

const NOW = new Date(2026, 8, 11, 12, 0, 0); // 11. september 2026

function thread(id: string, date: Date): Thread {
  return { id, title: id, createdAt: date.toISOString(), updatedAt: date.toISOString() };
}

function daysBefore(days: number, hour = 9): Thread {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return thread(`t${days}`, date);
}

describe('groupThreads', () => {
  it('follows the periods Lars decided: today, 7 days, 30 days, month, year', () => {
    const groups = groupThreads(
      [daysBefore(0), daysBefore(3), daysBefore(20), daysBefore(48), daysBefore(310)],
      NOW,
    );

    expect(groups.map((group) => group.title)).toEqual([
      'I dag',
      'Siste 7 dager',
      'Siste 30 dager',
      'Juli',
      '2025',
    ]);
  });

  it('treats «i dag» as the calendar day, not the last 24 hours', () => {
    const earlyToday = new Date(NOW);
    earlyToday.setHours(0, 30, 0, 0);
    const lateYesterday = new Date(NOW);
    lateYesterday.setDate(lateYesterday.getDate() - 1);
    lateYesterday.setHours(23, 30, 0, 0);

    const groups = groupThreads(
      [thread('tidlig-i-dag', earlyToday), thread('sent-i-gaar', lateYesterday)],
      NOW,
    );

    expect(groups.map((group) => group.title)).toEqual(['I dag', 'Siste 7 dager']);
  });

  it('puts day 6 in «Siste 7 dager» and day 7 in «Siste 30 dager»', () => {
    const groups = groupThreads([daysBefore(6), daysBefore(7)], NOW);
    expect(groups.map((group) => group.title)).toEqual(['Siste 7 dager', 'Siste 30 dager']);
  });

  it('names months in Norwegian and only for the current year', () => {
    // 1. januar 2026 is more than 30 days back and still this year.
    const groups = groupThreads([thread('nyttaar', new Date(2026, 0, 1))], NOW);
    expect(groups.map((group) => group.title)).toEqual(['Januar']);
  });

  it('collects everything from an earlier year under that year', () => {
    const groups = groupThreads(
      [thread('desember', new Date(2025, 11, 20)), thread('mars', new Date(2025, 2, 4))],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('2025');
    expect(groups[0].threads.map((entry) => entry.id)).toEqual(['desember', 'mars']);
  });

  it('sorts newest first, whatever order it is given', () => {
    const groups = groupThreads([daysBefore(310), daysBefore(0), daysBefore(3)], NOW);
    expect(groups.map((group) => group.title)).toEqual(['I dag', 'Siste 7 dager', '2025']);
  });

  it('keeps a thread dated in the future in «I dag» rather than dropping it', () => {
    const tomorrow = new Date(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = groupThreads([thread('framtid', tomorrow)], NOW);
    expect(groups.map((group) => group.title)).toEqual(['I dag']);
  });

  it('gir to tråder på samme millisekund en bestemt rekkefølge', () => {
    /*
     * `Array.prototype.sort` is stable, so equal timestamps come out in the
     * order they went in — and that order is whatever the caller happened to
     * build, which changes between a first load and a refetch. Two rows
     * swapping places for no visible reason is what the id tiebreak prevents.
     * The mock fixtures stamp from one clock, and a backend can write two
     * threads in the same millisecond.
     */
    const same = new Date(NOW);
    const ids = ['bravo', 'alfa', 'charlie'];

    const forwards = groupThreads(
      ids.map((id) => thread(id, same)),
      NOW,
    );
    const backwards = groupThreads(
      [...ids].reverse().map((id) => thread(id, same)),
      NOW,
    );

    expect(forwards[0].threads.map((entry) => entry.id)).toEqual(['alfa', 'bravo', 'charlie']);
    expect(backwards[0].threads.map((entry) => entry.id)).toEqual(
      forwards[0].threads.map((entry) => entry.id),
    );
  });

  it('returns nothing for an empty list', () => {
    expect(groupThreads([], NOW)).toEqual([]);
  });
});
