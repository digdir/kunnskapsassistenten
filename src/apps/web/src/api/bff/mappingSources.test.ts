import { describe, expect, it } from 'vitest';
import type { BffMessage, BffSource } from './contract';
import { BffTurnState, sourceDocumentsFrom, threadDetailFromBff } from './mapping';

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

/**
 * What the BFF does not keep is not known, and an answer read back without
 * sources is not an answer without sources.
 *
 * The BFF passes each message on as text alone, without the chunks the
 * backend stores, and keeps one set of sources per conversation in memory:
 * the last answer's (on its `main`, the last set that was not empty), gone
 * after a restart. Measured 06.10
 * against the BFF on :8791, three questions and a reload: the second answer
 * had sources and no `[n]`, came back with none, and was told it had none.
 */
describe('threadDetailFromBff: sources the BFF did not keep', () => {
  const messages: BffMessage[] = [
    { id: 'm1', role: 'user', text: 'Første', created: 1 },
    { id: 'm2', role: 'assistant', text: 'Et svar uten markører.', created: 2 },
    { id: 'm3', role: 'user', text: 'Andre', created: 3 },
    { id: 'm4', role: 'assistant', text: 'Det siste svaret [1].', created: 4 },
  ];
  const kept = [
    { docNum: '1', title: 'Tildelingsbrev', url: '', marker: 1, chunkId: 'a', excerpt: 'x' },
  ];

  it('marks an earlier answer as not stored, markers or not', () => {
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages,
      sources: kept,
    });

    expect(thread.messages[1]).toMatchObject({ sourcesNotStored: true });
    expect(thread.messages[1]?.sources).toBeUndefined();
  });

  it('leaves the last answer alone when the BFF still has its sources', () => {
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages,
      sources: kept,
    });

    expect(thread.messages[3]?.sources).toHaveLength(1);
    expect(thread.messages[3]?.sourcesNotStored).toBeUndefined();
  });

  it('marks the last answer too when the BFF has nothing, which is also what a restart looks like', () => {
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages,
      sources: [],
    });

    expect(thread.messages.filter((message) => message.sourcesNotStored)).toHaveLength(2);
    expect(thread.messages[0]?.sourcesNotStored).toBeUndefined();
  });

  it('does not mark a failed turn, which had no answer for sources to belong to', () => {
    const thread = threadDetailFromBff({
      conversation: { id: 'c1', topic: 'Første', created: 1 },
      messages: [
        { id: 'm1', role: 'user', text: 'Første', created: 1 },
        { id: 'm2', role: 'assistant', text: 'LLM request failed at iteration 1', created: 2 },
      ],
    });

    expect(thread.messages[1]?.status).toBe('error');
    expect(thread.messages[1]?.sourcesNotStored).toBeUndefined();
  });
});
