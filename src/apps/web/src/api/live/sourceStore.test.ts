import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_STORED_CHARS,
  SOURCES_STORAGE_KEY,
  answerFingerprint,
  forgetAllAnswers,
  recallThread,
  rememberAnswer,
} from './sourceStore';

const chunks = [
  {
    chunk_id: 'ef0a96e7e2bb',
    doc_num: '32062',
    title: 'Tildelingsbrev Digdir 2023',
    metadata: '{"Header 1" "Mål"}',
  },
  { chunk_id: '3c399236a70d', doc_num: '32062', docTitle: 'Tildelingsbrev Digdir 2023' },
];

const stored = () => JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) ?? 'null');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('answerFingerprint', () => {
  it('er lik for lik tekst, og for tekst som bare skiller seg i mellomrom i endene', () => {
    expect(answerFingerprint('Svar [1].')).toBe(answerFingerprint('  Svar [1].\n'));
  });

  it('skiller tekster som er ulike', () => {
    expect(answerFingerprint('Svar [1].')).not.toBe(answerFingerprint('Svar [2].'));
    expect(answerFingerprint('ab')).not.toBe(answerFingerprint('ba'));
  });
});

describe('rememberAnswer og recallThread', () => {
  it('finner bitene igjen under tråden og teksten i svaret', () => {
    rememberAnswer('conv-1', 'Svar [1].', { chunks }, 1000);

    const remembered = recallThread('conv-1', 2000);

    expect(remembered?.get(answerFingerprint('Svar [1].'))?.chunks).toEqual([
      {
        chunk_id: 'ef0a96e7e2bb',
        doc_num: '32062',
        title: 'Tildelingsbrev Digdir 2023',
        metadata: '{"Header 1" "Mål"}',
      },
      // One name for the title, whichever it arrived under.
      { chunk_id: '3c399236a70d', doc_num: '32062', title: 'Tildelingsbrev Digdir 2023' },
    ]);
  });

  it('lagrer bare det svaret bar, ikke tekst fra dokumentene', () => {
    rememberAnswer('conv-1', 'Svar.', {
      chunks: [{ ...chunks[0], content_markdown: 'Hele utdraget.' } as never],
    });

    expect(localStorage.getItem(SOURCES_STORAGE_KEY)).not.toContain('Hele utdraget');
  });

  it('lagrer et svar som et objekt, så stegene kan få plass ved siden av bitene senere', () => {
    rememberAnswer('conv-1', 'Svar.', { chunks: [chunks[0]] });

    const answer = JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) ?? '{}').threads['conv-1']
      .answers[answerFingerprint('Svar.')];
    expect(Object.keys(answer)).toEqual(['chunks']);
  });

  it('tar vare på stegene, treffene og tenketiden ved siden av bitene', () => {
    const thinkingSteps = [
      { id: 'thinking-1', kind: 'reasoning' as const, label: 'Jeg søker etter årsrapporten.' },
      {
        id: 'search-2',
        kind: 'search' as const,
        label: 'Søkte',
        queries: ['Nkom måloppnåelse 2022'],
        durationMs: 812,
      },
    ];
    const retrieval = { hitCount: 6, documentCount: 1, keywords: ['Nkom måloppnåelse 2022'] };

    rememberAnswer('conv-1', 'Svar.', { chunks, thinkingSteps, retrieval, thoughtMs: 4200 });

    expect(recallThread('conv-1')?.get(answerFingerprint('Svar.'))).toMatchObject({
      thinkingSteps,
      retrieval,
      thoughtMs: 4200,
    });
  });

  it('tar vare på stegene også for et svar uten biter', () => {
    const thinkingSteps = [{ id: 'thinking-1', kind: 'reasoning' as const, label: 'Jeg leter.' }];

    rememberAnswer('conv-1', 'Fant ingenting om det.', { chunks: [], thinkingSteps });

    expect(recallThread('conv-1')?.get(answerFingerprint('Fant ingenting om det.'))).toEqual({
      chunks: [],
      thinkingSteps,
    });
  });

  it('holder svarene i en tråd fra hverandre', () => {
    rememberAnswer('conv-1', 'Første svar.', { chunks: [chunks[0]] });
    rememberAnswer('conv-1', 'Andre svar.', { chunks: [chunks[1]] });

    const remembered = recallThread('conv-1');
    expect(remembered?.get(answerFingerprint('Første svar.'))?.chunks[0]?.chunk_id).toBe(
      'ef0a96e7e2bb',
    );
    expect(remembered?.get(answerFingerprint('Andre svar.'))?.chunks[0]?.chunk_id).toBe(
      '3c399236a70d',
    );
  });

  it('skriver ingenting uten tråd, uten tekst, eller uten både biter og steg', () => {
    rememberAnswer('', 'Svar.', { chunks });
    rememberAnswer('conv-1', '  ', { chunks });
    rememberAnswer('conv-1', 'Svar.', { chunks: [] });

    expect(localStorage.getItem(SOURCES_STORAGE_KEY)).toBeNull();
    expect(recallThread('conv-1')).toBeUndefined();
  });

  it('regner det som bruk å åpne tråden', () => {
    rememberAnswer('conv-1', 'Svar.', { chunks }, 1000);

    recallThread('conv-1', 5000);

    expect(stored().threads['conv-1'].usedAt).toBe(5000);
  });

  it('fjerner tråden som ble brukt lengst siden når lageret blir for stort', () => {
    // Four threads whose chunks each take a third of the room: only three fit.
    const big = [{ chunk_id: 'a', metadata: 'x'.repeat(MAX_STORED_CHARS / 3) }];
    rememberAnswer('eldst', 'Svar.', { chunks: big }, 1);
    rememberAnswer('nest', 'Svar.', { chunks: big }, 2);
    recallThread('eldst', 3);
    rememberAnswer('nyest', 'Svar.', { chunks: big }, 4);

    // «nest» was used longest ago once «eldst» was opened again.
    expect(Object.keys(stored().threads).sort()).toEqual(['eldst', 'nyest']);
    expect(localStorage.getItem(SOURCES_STORAGE_KEY)?.length).toBeLessThanOrEqual(MAX_STORED_CHARS);
  });

  it('tåler et lager med søppel i', () => {
    localStorage.setItem(SOURCES_STORAGE_KEY, '{ikke json');
    expect(recallThread('conv-1')).toBeUndefined();

    localStorage.setItem(
      SOURCES_STORAGE_KEY,
      JSON.stringify({
        threads: {
          'conv-1': {
            usedAt: 1,
            answers: {
              x: { chunks: [null, 7, { chunk_id: 3 }] },
              y: ['en liste', 'er ikke et svar'],
            },
          },
        },
      }),
    );
    const remembered = recallThread('conv-1');
    expect(remembered?.get('x')).toEqual({ chunks: [{}] });
    expect(remembered?.has('y')).toBe(false);

    localStorage.setItem(
      SOURCES_STORAGE_KEY,
      JSON.stringify({
        threads: {
          'conv-1': {
            usedAt: 1,
            answers: {
              z: {
                chunks: [],
                thinkingSteps: [
                  { id: 's1', kind: 'reasoning', label: 'Beholdes.', durationMs: -5 },
                  { id: 's2', kind: 'ukjent', label: 'Ukjent slag.' },
                  { id: 's3', kind: 'search', label: 'Søkte', queries: ['a', 7] },
                  'ikke et steg',
                ],
                retrieval: { hitCount: 'mange', documentCount: 1, keywords: [] },
                thoughtMs: Number.NaN,
              },
            },
          },
        },
      }),
    );
    // A negative duration and a query that is not text are dropped; a step of
    // an unknown kind, a retrieval with a count that is not a number, and a
    // thinking time that is not a number are not kept at all.
    expect(recallThread('conv-1')?.get('z')).toEqual({
      chunks: [],
      thinkingSteps: [
        { id: 's1', kind: 'reasoning', label: 'Beholdes.' },
        { id: 's3', kind: 'search', label: 'Søkte' },
      ],
    });
  });

  it('kaster ikke når nettleseren nekter å skrive', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(() => rememberAnswer('conv-1', 'Svar.', { chunks })).not.toThrow();
  });

  it('kaster ikke når nettleseren nekter å lese', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blokkert', 'SecurityError');
    });

    expect(recallThread('conv-1')).toBeUndefined();
  });
});

describe('forgetAllAnswers', () => {
  it('tømmer hele lageret', () => {
    rememberAnswer('conv-1', 'Svar.', { chunks });
    rememberAnswer('conv-2', 'Svar.', { chunks });

    forgetAllAnswers();

    expect(localStorage.getItem(SOURCES_STORAGE_KEY)).toBeNull();
    expect(recallThread('conv-1')).toBeUndefined();
  });

  it('lar resten av nettleserens lager stå', () => {
    localStorage.setItem('ka.layout.v1', '{}');
    rememberAnswer('conv-1', 'Svar.', { chunks });

    forgetAllAnswers();

    expect(localStorage.getItem('ka.layout.v1')).toBe('{}');
  });

  it('kaster ikke når nettleseren nekter', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blokkert', 'SecurityError');
    });

    expect(() => forgetAllAnswers()).not.toThrow();
  });
});
