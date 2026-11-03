import { beforeEach, describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { answerFingerprint, recallThread, rememberAnswer } from './sourceStore';

/*
 * «Fremgangsmåte» draws its phases from what each step found. A turn read back after a reload has
 * only what this store kept, so the tool and the findings must survive it, or the reloaded card
 * says what kind of thing was done and nothing of what was found.
 */

const steps: ThinkingStep[] = [
  {
    id: 'tool-1-plan_queries',
    kind: 'search',
    label: 'Jeg søker i dokumentene.',
    tool: 'plan_queries',
    findings: { restatedQuestion: 'Sammenlign de to siste årsrapportene til Digdir' },
  },
  {
    id: 'tool-2-search',
    kind: 'search',
    label: 'Jeg søker i dokumentene.',
    queries: ['Digdir årsrapport 2024'],
    tool: 'search',
    findings: { newHits: 43, autoFilter: ['Digitaliseringsdirektoratet'] },
  },
  {
    id: 'tool-3-read_chunks',
    kind: 'read',
    label: 'Jeg leser utdragene.',
    tool: 'read_chunks',
    findings: {
      excerptsRead: 3,
      documentsRead: ['Årsrapport Digitaliseringsdirektoratet 2024'],
      documentsPartial: true,
    },
  },
  {
    id: 'tool-4-read_chunks',
    kind: 'read',
    label: 'Jeg leser utdragene.',
    tool: 'read_chunks',
    findings: { readRefused: true },
  },
];

describe('stored steps keep what they found', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gives the tool and the findings back as they were stored', () => {
    rememberAnswer('conv-1', 'Svar.', { chunks: [], thinkingSteps: steps });

    expect(recallThread('conv-1')?.get(answerFingerprint('Svar.'))?.thinkingSteps).toEqual(steps);
  });

  it('drops a finding of the wrong type rather than the step', () => {
    const odd = {
      id: 'tool-1-search',
      kind: 'search',
      label: 'Jeg søker i dokumentene.',
      tool: 'search',
      findings: { newHits: '43', autoFilter: ['Digitaliseringsdirektoratet'], readRefused: 'ja' },
    } as unknown as ThinkingStep;

    rememberAnswer('conv-1', 'Svar.', { chunks: [], thinkingSteps: [odd] });

    expect(recallThread('conv-1')?.get(answerFingerprint('Svar.'))?.thinkingSteps).toEqual([
      {
        id: 'tool-1-search',
        kind: 'search',
        label: 'Jeg søker i dokumentene.',
        tool: 'search',
        findings: { autoFilter: ['Digitaliseringsdirektoratet'] },
      },
    ]);
  });
});
