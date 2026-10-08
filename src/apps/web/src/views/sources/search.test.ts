import { describe, expect, it } from 'vitest';
import { findHits, hitsFor } from '../../components';
import { nkomSources } from '../../api/mock/fixtures';
import { readableDocuments } from './readableText';
import { buildSearchIndex } from './search';

describe('buildSearchIndex', () => {
  it('holds one item per excerpt, across documents', () => {
    const index = buildSearchIndex(nkomSources);

    expect(index).toHaveLength(5);
    expect(index.every((item) => item.kind === 'excerpt')).toBe(true);
    // `sourceFrom` numbers an excerpt within its corpus document, so the id
    // is the document's own uuid and the excerpt's place in it.
    expect(index[0]!.id).toBe('a1c6feb9-3a47-4889-b049-92adae575b9f-1');
  });

  /**
   * The order the index is built in is the order hits come back in, and that
   * is what «1 av 8 treff» and «Neste» walk through. It stayed here rather
   * than moving with the search: the matching is in reading order by
   * construction, and it is this function that decides what reading order IS.
   */
  it('gives hits in reading order across the documents', () => {
    const index = buildSearchIndex(nkomSources);
    const hits = findHits(index, 'rapport');
    const order = index.map((item) => item.id);

    expect(hits.length).toBeGreaterThan(1);
    const positions = hits.map((hit) => order.indexOf(hit.itemId));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('lets a hit be traced back to the excerpt it came from', () => {
    const index = buildSearchIndex(nkomSources);
    const hits = findHits(index, 'rapport');

    /*
     * `every` on an empty list is true, so this passed without finding
     * anything: «risiko» stopped being in the fixture and nothing said so.
     * The count is what makes the rest of the assertion mean something.
     */
    const traced = hitsFor(hits, 'a1c6feb9-3a47-4889-b049-92adae575b9f-1');
    expect(traced.length).toBeGreaterThan(0);
    expect(traced.every((hit) => hit.itemId === 'a1c6feb9-3a47-4889-b049-92adae575b9f-1')).toBe(
      true,
    );
    expect(hitsFor(hits, 'finnes-ikke')).toEqual([]);
  });
});

describe('the search in the panel and raised characters', () => {
  /**
   * The panel shows `m<sup>2</sup>` as «m²» (readableText.ts), and a keyboard
   * has no «²». The hit has to be found with the plain digit and still cover
   * exactly what is on screen, or the highlight lands beside it.
   */
  const index = buildSearchIndex(
    readableDocuments([
      {
        id: '375022',
        title: 'Årsrapport 2024',
        excerpts: [
          {
            id: '375022-117',
            citationNumber: 1,
            relevance: 'high',
            text: '| Husleie1) | 3 024 010 |\n\nLokalene er 1 200 m<sup>2</sup>, før var det 900 m2.',
          },
        ],
      },
    ]),
  );
  const text = index[0]!.text;
  const found = (query: string) =>
    findHits(index, query).map((hit) => text.slice(hit.start, hit.end));

  it('finds «m²» with «m2», and the hit covers what is shown', () => {
    expect(text).toContain('1 200 m²');
    expect(found('m2')).toEqual(['m²', 'm2']);
  });

  it('finds a raised footnote mark with the plain one, and the plain with the raised', () => {
    expect(found('husleie1)')).toEqual(['Husleie¹⁾']);
    expect(found('m²')).toEqual(['m²', 'm2']);
  });
});
