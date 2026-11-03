import { describe, expect, it } from 'vitest';
import type { SourceDocument, StreamEvent } from '../../model';
import { asGenkiCites, citedMockAnswer } from './excerptContract';
import { MockChatClient } from './MockChatClient';

/*
 * The mock in the shape genki is asked to send (digdir/genki#273), so CI runs the live mapping.
 * The scripts write `[n]` for their n-th excerpt; genki would write one marker per excerpt.
 */
const documents: SourceDocument[] = [
  {
    id: 'doc-a',
    title: 'Årsrapport Nkom 2025',
    excerpts: [
      { id: 'a-1', text: 'Første.', relevance: 'high', citationNumber: 2 },
      { id: 'a-2', text: 'Andre, ikke sitert.', relevance: 'low' },
    ],
  },
  {
    id: 'doc-b',
    title: 'Tildelingsbrev Nkom 2026',
    excerpts: [{ id: 'b-1', text: 'Tredje.', relevance: 'high', citationNumber: 1 }],
  },
];

describe('the mock, shaped as genki#273', () => {
  it('writes genki’s markers, one per excerpt, with the excerpt each one means', () => {
    const contract = asGenkiCites('Brevet [1], og rapporten [2] [9].', documents);

    expect(contract.answer).toBe('Brevet [2.1], og rapporten [1.1] [9.0].');
    expect(contract.markers).toEqual([
      { marker: '1.1', chunkId: 'a-1', documentId: 'doc-a' },
      { marker: '1.2', chunkId: 'a-2', documentId: 'doc-a' },
      { marker: '2.1', chunkId: 'b-1', documentId: 'doc-b' },
    ]);
    // The scripts' own numbers are gone; only the mapping gives numbers.
    expect(contract.documents.flatMap((document) => document.excerpts)).toSatisfy(
      (excerpts: { citationNumber?: number }[]) =>
        excerpts.every((excerpt) => excerpt.citationNumber === undefined),
    );
  });

  it('shows what live shows: first citation first, only cited excerpts, no marker without one', () => {
    const shown = citedMockAnswer('Brevet [1], og rapporten [2] [9].', documents);

    expect(shown.content).toBe('Brevet [1], og rapporten [2].');
    expect(
      shown.documents.map((document) => [
        document.id,
        document.excerpts.map((excerpt) => [excerpt.id, excerpt.citationNumber]),
      ]),
    ).toEqual([
      ['doc-b', [['b-1', 1]]],
      ['doc-a', [['a-1', 2]]],
    ]);
  });

  it('streams a scripted answer with only its cited excerpts and every footnote paired', async () => {
    const client = new MockChatClient({
      thinkingStepMs: 0,
      firstTokenMs: 0,
      tokenMs: 0,
      sourcesMs: 0,
      requestMs: 0,
    });
    const events: StreamEvent[] = [];
    for await (const event of client.ask({
      query:
        'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
    })) {
      events.push(event);
    }
    const text = events.flatMap((event) => (event.type === 'token' ? [event.text] : [])).join('');
    const sources = events.find((event) => event.type === 'sources');
    if (sources?.type !== 'sources') throw new Error('no sources');

    const footnotes = new Set([...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
    const excerpts = sources.documents.flatMap((document) => document.excerpts);
    // One to one: every footnote has an excerpt, and every excerpt shown has a footnote.
    expect([...footnotes].sort()).toEqual(excerpts.map((excerpt) => excerpt.citationNumber));
    // The script's third excerpt of the 2025 report is cited by no marker, so it is not shown.
    expect(
      excerpts.some((excerpt) => excerpt.text.startsWith('Årsrapporten for 2025 beskriver')),
    ).toBe(false);
  });
});
