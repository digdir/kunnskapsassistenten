import { describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { stepFindings } from '../../api/stepFindings';
import { MAX_SEARCH_PHRASES, procedureFrom, procedureStatus } from './procedure';

function search(id: string, queries: string[], summary: string): ThinkingStep {
  return {
    id,
    kind: 'search',
    label: 'Jeg søker i dokumentene.',
    queries,
    tool: 'search',
    findings: stepFindings('search', queries, summary),
  };
}

function read(id: string, summary: string): ThinkingStep {
  return {
    id,
    kind: 'read',
    label: 'Jeg leser utdragene.',
    tool: 'read_chunks',
    findings: stepFindings('read_chunks', undefined, summary),
  };
}

const bodyOf = (steps: ThinkingStep[], id: string, thinking = false) =>
  procedureFrom({ steps, thinking }).phases.find((phase) => phase.id === id)?.body;

describe('«Fremgangsmåte», sentence by sentence', () => {
  // On genki-test 2026-11-03 the first pass of a comparison was narrowed to two years, the next
  // to Digdir: the reader set neither.
  it('says each filter the backend added, in the order it changed', () => {
    const steps = [
      search(
        's1',
        ['Digdir årsrapport 2025'],
        'Search pass 1: found 20 chunks (20 new). 20 total seen. Auto-filtered by concerned_years: 2025, 2024. Ranking: x.',
      ),
      search(
        's2',
        ['Digdir årsrapport 2024'],
        'Search pass 2: found 30 chunks (25 new). 45 total seen. Auto-filtered by orgs_long: Digitaliseringsdirektoratet. Ranking: x.',
      ),
      search(
        's3',
        ['Digdir årsrapport 2023'],
        'Search pass 3: found 30 chunks (18 new). 63 total seen. Auto-filtered by orgs_long: Digitaliseringsdirektoratet. Ranking: x.',
      ),
    ];

    expect(bodyOf(steps, 'scope')).toEqual([
      'Jeg avgrenset søket først til 2025 og 2024, så til Digitaliseringsdirektoratet.',
    ]);
    expect(bodyOf(steps, 'searched')?.at(-1)).toBe('Søkene fant 63 treff.');
  });

  it('says it read nothing more when the read budget ran out', () => {
    const steps = [
      read(
        'r1',
        'Read 1 chunks (900 chars this call, 900 cumulative):\n\n--- chunk_id=a doc_num=1 chunk_index=0 title="Årsrapport 2024" url=x ---\nTekst',
      ),
      read(
        'r2',
        'Read budget exhausted for the requested read. Remaining budget (131/12000 chars) is too small.',
      ),
    ];

    expect(bodyOf(steps, 'read')).toEqual([
      'Leste 1 utdrag fra disse dokumentene:',
      ['Årsrapport 2024'],
      'Nådde grensen for hvor mye jeg kan lese for ett spørsmål.',
    ]);
  });

  it('says «så langt» while it is still reading', () => {
    const steps = [read('r1', 'Read 3 chunks (900 chars this call, 900 cumulative):')];
    expect(bodyOf(steps, 'read', true)).toEqual(['Har lest 3 utdrag så langt.']);
  });

  it('shows the first searches and says there were more', () => {
    const queries = Array.from({ length: MAX_SEARCH_PHRASES + 2 }, (_, n) => `"tema ${n + 1}"`);
    const [lead, phrases] = bodyOf([search('s1', queries, '')], 'searched') ?? [];

    expect(lead).toBe('Jeg lette etter omtale av blant annet disse temaene:');
    expect(phrases).toHaveLength(MAX_SEARCH_PHRASES);
    expect((phrases as string[])[0]).toBe('tema 1');
  });

  it('reads the agent’s own words before it searched as how it read the question, and no later ones', () => {
    const steps: ThinkingStep[] = [
      { id: 't1', kind: 'reasoning', label: 'Jeg deler spørsmålet i to.' },
      search('s1', ['Nkom'], ''),
      { id: 't2', kind: 'reasoning', label: 'Jeg har nok til å svare.' },
    ];

    expect(bodyOf(steps, 'understood')).toEqual(['Jeg deler spørsmålet i to.']);
    expect(JSON.stringify(procedureFrom({ steps, thinking: false }))).not.toContain(
      'Jeg har nok til å svare.',
    );
  });

  // Steps stored before the findings existed have a kind and nothing else.
  it('draws a step stored before the findings existed under its phase, with nothing made up', () => {
    const steps: ThinkingStep[] = [
      { id: 's1', kind: 'search', label: 'Jeg søker i dokumentene.' },
      { id: 's2', kind: 'read', label: 'Jeg leser utdragene.' },
      { id: 's3', kind: 'finalizing', label: 'Jeg skriver svaret med kildehenvisninger.' },
    ];
    const procedure = procedureFrom({ steps, thinking: false });

    expect(procedure.phases.map((phase) => [phase.id, phase.body])).toEqual([
      ['searched', []],
      ['read', []],
      ['wrote', []],
    ]);
    expect(procedureStatus(procedure, false, 0, undefined)).toBeUndefined();
  });

  it('counts one document and one second in the singular', () => {
    const procedure = procedureFrom({
      steps: [read('r1', 'Read 1 chunks (900 chars this call, 900 cumulative):')],
      thinking: false,
      documents: [{ id: 'd1', title: 'Årsrapport 2024', excerpts: [] }],
    });

    expect(procedure.phases.find((phase) => phase.id === 'selected')?.body[0]).toBe(
      '1 dokument er brukt i svaret:',
    );
    expect(procedureStatus(procedure, false, 1, 400)).toBe(
      'Leste 1 utdrag, brukte 1 dokument · tok 1 sekund',
    );
  });
});
