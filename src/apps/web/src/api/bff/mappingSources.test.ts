import { describe, expect, it } from 'vitest';
import type { BffSource } from './contract';
import { BffTurnState, sourceDocumentsFrom } from './mapping';

/**
 * The BFF sends one source per chunk and the answer's `[n]` counts chunks, so
 * the numbers have to survive the grouping into documents. It used to send one
 * per document, and this file is what keeps it from drifting back.
 */
describe('sourceDocumentsFrom', () => {
  const source = (over: Partial<BffSource> & { marker: number }): BffSource => ({
    docNum: '1',
    title: 'Tildelingsbrev',
    url: 'https://kudos.example/documents/1',
    ...over,
  });

  it('groups chunks of one document, and every marker survives', () => {
    const documents = sourceDocumentsFrom([
      source({ marker: 1, chunkId: 'a', excerpt: 'først' }),
      source({ marker: 2, chunkId: 'b', excerpt: 'så' }),
      source({ marker: 3, chunkId: 'c', docNum: '2', title: 'Annen', excerpt: 'tredje' }),
    ]);

    expect(documents).toHaveLength(2);
    expect(documents[0]?.excerpts.map((e) => e.citationNumber)).toEqual([1, 2]);
    expect(documents[0]?.excerpts.map((e) => e.text)).toEqual(['først', 'så']);
    expect(documents[1]?.excerpts.map((e) => e.citationNumber)).toEqual([3]);
  });

  it('the shape measured against kudos-full: eight chunks, one document, [1]..[8]', () => {
    const documents = sourceDocumentsFrom(
      Array.from({ length: 8 }, (_, i) =>
        source({ marker: i + 1, chunkId: `c${i}`, docNum: '347922', excerpt: `bit ${i + 1}` }),
      ),
    );

    expect(documents).toHaveLength(1);
    expect(documents[0]?.excerpts.map((e) => e.citationNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('a chunk whose passage is missing says so, rather than carrying an empty quote', () => {
    const [document] = sourceDocumentsFrom([source({ marker: 1, chunkId: 'a' })]);
    expect(document?.excerpts[0]?.text).toBe('');
    expect(document?.excerpts[0]?.textUnavailable).toBe(true);
  });

  it('a passage that did arrive is not flagged', () => {
    const [document] = sourceDocumentsFrom([source({ marker: 1, chunkId: 'a', excerpt: 'tekst' })]);
    expect(document?.excerpts[0]?.textUnavailable).toBeUndefined();
  });

  it('counts hits by chunk and documents by document', () => {
    const state = new BffTurnState();
    state.read({ type: 'delta', text: 'Svar [1][2].' });
    state.read({
      type: 'sources',
      sources: [
        source({ marker: 1, chunkId: 'a', excerpt: 'en' }),
        source({ marker: 2, chunkId: 'b', excerpt: 'to' }),
      ],
    });
    const out = state.read({ type: 'done', conversationId: 'c1', insufficient: false });
    const sources = out.find((event) => event.type === 'sources');
    expect(sources?.retrieval.hitCount).toBe(2);
    expect(sources?.retrieval.documentCount).toBe(1);
  });
});
