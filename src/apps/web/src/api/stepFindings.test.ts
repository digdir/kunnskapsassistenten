import { describe, expect, it } from 'vitest';
import run from './fixtures/genki-steps-compare.json';
import { stepFindings } from './stepFindings';

type Call = {
  tool: string;
  args?: { query?: string; queries?: string[] };
  'result-summary'?: string;
};

/** The tool calls of the recorded genki run, in the order they were reported. */
const calls: Call[] = run.steps.flatMap((step) =>
  'tool-calls' in step ? (step['tool-calls'] as Call[]) : [],
);

function findingsOf(call: Call) {
  const queries = call.args?.queries ?? (call.args?.query ? [call.args.query] : undefined);
  return stepFindings(call.tool, queries, call['result-summary']);
}

describe('stepFindings on a real genki run', () => {
  it('reads the restated question from plan_queries', () => {
    const plan = calls.find((call) => call.tool === 'plan_queries');
    expect(plan && findingsOf(plan)).toEqual({
      restatedQuestion:
        'Sammenlign de to siste årsrapportene til Digitaliseringsdirektoratet Digdir',
    });
  });

  it('reads the new hits and the filter genki added on its own from each search', () => {
    const searches = calls.filter((call) => call.tool === 'search').map(findingsOf);
    expect(searches).toEqual([
      { newHits: 43, autoFilter: ['Digitaliseringsdirektoratet'] },
      { newHits: 32, autoFilter: ['Digitaliseringsdirektoratet'] },
    ]);
  });

  /*
   * genki cuts the report at 400 characters, so a read of three excerpts names
   * only the first. The title is right; the other two may be from elsewhere.
   */
  it('reads the excerpts, the titles it can see, and that the report was cut', () => {
    const reads = calls.filter((call) => call.tool === 'read_chunks').map(findingsOf);
    expect(reads).toHaveLength(6);
    expect(reads[0]).toEqual({
      excerptsRead: 3,
      documentsRead: ['Årsrapport Digitaliseringsdirektoratet 2024'],
      documentsPartial: true,
    });
    expect(reads[1]?.documentsRead).toEqual(['Årsrapport Digitaliseringsdirektoratet 2023']);
    expect(reads.reduce((total, read) => total + (read?.excerptsRead ?? 0), 0)).toBe(18);
  });

  it('says nothing about a call it has no reading of', () => {
    const inspect = calls.find((call) => call.tool === 'inspect_filters');
    expect(inspect && findingsOf(inspect)).toBeUndefined();
  });
});

describe('stepFindings on the other reports genki writes', () => {
  // From the same question on genki e54d3ac, 2026-11-03 (compare-r1): the read budget ran out.
  it('reads a refused read as refused, with nothing read', () => {
    const summary =
      'Read budget exhausted for the requested read. Remaining budget (1640/12000 chars) is too ' +
      'small for the requested read. Do not repeat the same read.';
    expect(stepFindings('read_chunks', undefined, summary)).toEqual({ readRefused: true });
  });

  it('reads a filter genki changed to another organisation as that organisation', () => {
    const summary =
      'Search pass 1: found 73 chunks (73 new). 73 total seen. Auto-filtered by orgs_long: ' +
      'Direktoratet for forvaltning og økonomistyring. Ranking: ColBERT semantic rerank (233ms).';
    expect(stepFindings('search', ['Digdir årsrapport 2024'], summary)).toEqual({
      newHits: 73,
      autoFilter: ['Direktoratet for forvaltning og økonomistyring'],
    });
  });

  it('counts a read whose every excerpt is named as whole', () => {
    const summary =
      'Read 1 chunks (2079 chars this call, 10541 cumulative):\n\n<untrusted_data kind="documents">\n' +
      '--- chunk_id=255b6a3786ff doc_num=88642 chunk_index=4 title="Årsrapport Digitaliseringsdirektoratet 2023" url=https://kudos.dfo.no ---\n' +
      'Tekst';
    expect(stepFindings('read_chunks', undefined, summary)).toEqual({
      excerptsRead: 1,
      documentsRead: ['Årsrapport Digitaliseringsdirektoratet 2023'],
    });
  });

  it('does not take a title cut off inside its quotes', () => {
    const summary =
      'Read 2 chunks (9000 chars this call, 9000 cumulative):\n\n' +
      '--- chunk_id=a doc_num=1 chunk_index=0 title="Årsrapport Digi';
    expect(stepFindings('read_chunks', undefined, summary)).toEqual({
      excerptsRead: 2,
      documentsPartial: true,
    });
  });

  it('reads headless-rag’s shorter report the same way', () => {
    expect(stepFindings('search', undefined, 'Search pass 1: found 95 chunks (95 new).')).toEqual({
      newHits: 95,
    });
    expect(stepFindings('read_chunks', undefined, 'Read 4 chunks (6314 chars this call)')).toEqual({
      excerptsRead: 4,
      documentsPartial: true,
    });
  });
});
