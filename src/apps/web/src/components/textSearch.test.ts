import { describe, expect, it } from 'vitest';
import {
  MIN_QUERY_LENGTH,
  findHits,
  hitsFor,
  splitByHits,
  stepHit,
  type SearchableItem,
} from './textSearch';

/**
 * The same assertions these had in src/views/sources/search.test.ts, against
 * literal items instead of an index built from the mock corpus.
 *
 * That is the point of the move: this module knows nothing about documents or
 * excerpts, so its tests should not need any either. The one test that did
 * need a real index — that hits come back in index order across it — stayed
 * with `buildSearchIndex`, which is what produces that order.
 */
const items: SearchableItem[] = [
  { id: 'a', kind: 'excerpt', text: 'Risiko og risikovurdering' },
  { id: 'b', kind: 'excerpt', text: 'Måloppnåelse og ressursbruk' },
  { id: 'c', kind: 'document', text: 'Risiko står også her' },
];

describe('findHits', () => {
  it('ignores a query shorter than the minimum', () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(findHits(items, 'r')).toEqual([]);
    expect(findHits(items, '  ')).toEqual([]);
  });

  it('matches without regard to case, and keeps offsets into the original', () => {
    const hits = findHits([items[0]!], 'RISIKO');

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ itemId: 'a', start: 0, end: 6 });
    // The offsets point into the original string, so the casing survives.
    expect(items[0]!.text.slice(hits[0]!.start, hits[0]!.end)).toBe('Risiko');
    expect(items[0]!.text.slice(hits[1]!.start, hits[1]!.end)).toBe('risiko');
  });

  it('matches Norwegian letters', () => {
    expect(findHits([items[1]!], 'måloppnåelse')).toHaveLength(1);
    expect(findHits([items[1]!], 'MÅLOPPNÅELSE')).toHaveLength(1);
  });

  it('does not overlap matches', () => {
    expect(findHits([{ id: 'a', kind: 'excerpt', text: 'aaaa' }], 'aa')).toHaveLength(2);
  });

  it('carries the kind of the item it found the text in', () => {
    // What tells «found in an excerpt» from «found in the document body»
    // apart, the day both are indexed.
    expect(findHits(items, 'risiko').map((hit) => hit.kind)).toEqual([
      'excerpt',
      'excerpt',
      'document',
    ]);
  });

  it('returns hits in the order the items were given', () => {
    const positions = findHits(items, 'risiko').map((hit) =>
      items.findIndex((item) => item.id === hit.itemId),
    );

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('hitsFor', () => {
  it('picks out the hits inside one item', () => {
    const hits = findHits(items, 'risiko');

    expect(hitsFor(hits, 'a').every((hit) => hit.itemId === 'a')).toBe(true);
    expect(hitsFor(hits, 'a')).toHaveLength(2);
    expect(hitsFor(hits, 'finnes-ikke')).toEqual([]);
  });
});

describe('stepHit', () => {
  it('stops at both ends rather than wrapping', () => {
    expect(stepHit(3, 2, 1)).toBe(2);
    expect(stepHit(3, 0, -1)).toBe(0);
    expect(stepHit(3, 0, 1)).toBe(1);
    expect(stepHit(3, 2, -1)).toBe(1);
  });

  it('stays at zero when there is nothing to step through', () => {
    expect(stepHit(0, 0, 1)).toBe(0);
    expect(stepHit(0, 0, -1)).toBe(0);
  });
});

describe('splitByHits', () => {
  it('covers the whole text exactly once', () => {
    const text = 'Risiko og risikovurdering';
    const hits = findHits([{ id: 'a', kind: 'excerpt', text }], 'risiko');
    const runs = splitByHits(text, hits);

    expect(runs.map((run) => run.text).join('')).toBe(text);
    expect(runs.filter((run) => run.hit !== undefined)).toHaveLength(2);
  });

  it('returns the text untouched when nothing matched', () => {
    expect(splitByHits('Ressursbruk', [])).toEqual([{ text: 'Ressursbruk' }]);
  });
});
