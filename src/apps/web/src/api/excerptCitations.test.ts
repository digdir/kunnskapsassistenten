import { describe, expect, it } from 'vitest';
import type { SourceDocument } from '../model';
import { citeExcerpts, type MarkerRef } from './excerptCitations';

/*
 * The documents are the chunks of a real genki-test answer (2026-11-03, «Hva krever
 * tildelingsbrevet til Mattilsynet for 2023 av rapportering?»): nine chunks in three documents,
 * ids and titles as stored. The markers are shaped as digdir/genki#273 asks, which genki does not
 * send yet: one per excerpt, written `[document.excerpt]`.
 */
function excerpt(id: string) {
  return { id, text: `Utdrag ${id}.`, relevance: 'high' as const };
}
const documents: SourceDocument[] = [
  {
    id: '103358',
    title: 'Tildelingsbrev Mattilsynet 2023',
    excerpts: ['273de169a3a9', '848deffb098b', 'c158c44d875d'].map(excerpt),
  },
  {
    id: '91399',
    title: 'Årsrapport Mattilsynet 2023',
    excerpts: ['dfcb979fca79', '2ea95b4b5210', '505500e63a79'].map(excerpt),
  },
  {
    id: '103325',
    title: 'Årsrapport Mattilsynet 2023',
    excerpts: ['b24fc1db5985', 'b1a2264e3a66', '1c48ed27077b'].map(excerpt),
  },
];
const markers: MarkerRef[] = documents.flatMap((document, d) =>
  document.excerpts.map((item, e) => ({
    marker: `${d + 1}.${e + 1}`,
    chunkId: item.id,
    documentId: document.id,
  })),
);

describe('citeExcerpts, footnotes and excerpts one to one', () => {
  it('numbers the excerpts 1, 2, 3 in the order the answer first cites them', () => {
    const cited = citeExcerpts(
      'Varsling [1.3]. Risikobildet [2.2]. Beløpene [1.1]. Varsling igjen [1.3].',
      documents,
      markers,
    );

    expect(cited.content).toBe('Varsling [1]. Risikobildet [2]. Beløpene [3]. Varsling igjen [1].');
    expect(cited.citations).toEqual([
      { number: 1, excerptId: 'c158c44d875d', documentId: '103358' },
      { number: 2, excerptId: '2ea95b4b5210', documentId: '91399' },
      { number: 3, excerptId: '273de169a3a9', documentId: '103358' },
    ]);
  });

  it('shows only cited excerpts, under their documents, in number order', () => {
    const cited = citeExcerpts(
      'Varsling [1.3]. Risikobildet [2.2]. Beløpene [1.1].',
      documents,
      markers,
    );

    expect(
      cited.documents.map((document) => [
        document.id,
        document.excerpts.map((item) => [item.citationNumber, item.id]),
      ]),
    ).toEqual([
      [
        '103358',
        [
          [1, 'c158c44d875d'],
          [3, '273de169a3a9'],
        ],
      ],
      ['91399', [[2, '2ea95b4b5210']]],
    ]);
  });

  it('draws no footnote whose excerpt is not among the sources, and keeps the sentence', () => {
    // `[3.9]` names no marker; `[2.1]` names a chunk the 20-chunk list cut off.
    const cut = documents.map((document) =>
      document.id === '91399'
        ? { ...document, excerpts: document.excerpts.filter((item) => item.id !== 'dfcb979fca79') }
        : document,
    );
    const cited = citeExcerpts('Krav [1.1] [3.9]. Leders beretning [2.1].', cut, markers);

    expect(cited.content).toBe('Krav [1]. Leders beretning.');
    expect(cited.citations.map((citation) => citation.number)).toEqual([1]);
    expect(cited.documents.map((document) => document.id)).toEqual(['103358']);
  });

  it('makes two markers for one excerpt, side by side, one footnote', () => {
    const doubled: MarkerRef[] = [...markers, { marker: '9', chunkId: 'c158c44d875d' }];

    expect(citeExcerpts('Varsling [1.3][9].', documents, doubled).content).toBe('Varsling [1].');
  });

  it('reads one running number per excerpt as well as `[document.excerpt]`', () => {
    const running: MarkerRef[] = [
      { marker: '4', chunkId: '505500e63a79' },
      { marker: '7', chunkId: '1c48ed27077b' },
    ];
    const cited = citeExcerpts('Oppdraget [7]. Direktoratet [4].', documents, running);

    expect(cited.content).toBe('Oppdraget [1]. Direktoratet [2].');
    expect(cited.documents.map((document) => document.id)).toEqual(['103325', '91399']);
  });

  it('leaves an answer with no markers as it is, with nothing to show', () => {
    const cited = citeExcerpts('Ingen kilder her, og et år [2023] i teksten.', documents, markers);

    expect(cited.content).toBe('Ingen kilder her, og et år [2023] i teksten.');
    expect(cited.documents).toEqual([]);
    expect(cited.citations).toEqual([]);
  });
});
