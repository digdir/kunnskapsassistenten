import { describe, expect, it } from 'vitest';
import run from '../../api/fixtures/genki-steps-compare.json';
import type { BffTurnEvent } from '../../api/bff/contract';
import { BffTurnState } from '../../api/bff/mapping';
import { McpStreamState } from '../../api/live/mcp';
import type { SourceDocument, StreamEvent, ThinkingStep } from '../../model';
import { procedureFrom, procedureStatus } from './procedure';

/*
 * One real turn on genki-test (service version 4, 2026-11-03): «Sammenlign det fem største
 * forskjellene mellom de to siste årsrapportene til digdir». It is run through both clients, the
 * way each one receives it, and «Fremgangsmåte» must come out the same.
 */

type Frame = Record<string, unknown> & { event?: string };
type Call = {
  tool: string;
  args?: { query?: string; queries?: string[]; chunk_ids?: string[] };
  'duration-ms'?: number;
  'result-summary'?: string;
};

const frames = run.steps as Frame[];

/** What MCP carries, by genki's adapter-mcp/src/progress.ts: every frame with an `event`, a
    `tool/call` with its call under `tool-call`. Stage-only frames (`gate`) are never sent. The
    recording kept no arguments on `tool/call`, so live sees them at the turn's end here. */
function mcpSteps(upTo = frames.length): ThinkingStep[] {
  const state = new McpStreamState();
  const out: StreamEvent[] = [];
  for (const frame of frames.slice(0, upTo)) {
    if (!frame.event) continue;
    const meta =
      frame.event === 'tool/call'
        ? { event: 'tool/call', 'tool-call': { tool: frame.tool as string } }
        : frame;
    out.push(...state.progress(meta));
  }
  return stepsOf(out);
}

/** What the BFF sends for the same frames, by apps/server/src/mcp.ts: one `tool-call` per call in
    an `agent/turn-completed`, with the report as `detail`, and `stage: 'done'` at the end. */
function bffSteps(upTo = frames.length): ThinkingStep[] {
  const state = new BffTurnState();
  const out: StreamEvent[] = [];
  for (const frame of frames.slice(0, upTo)) {
    const events: BffTurnEvent[] = [];
    if (frame.event === 'agent/turn-completed') {
      for (const call of frame['tool-calls'] as Call[]) {
        const queries = call.args?.queries ?? (call.args?.query ? [call.args.query] : []);
        events.push({
          type: 'tool-call',
          tool: call.tool,
          ...(call['result-summary'] ? { detail: call['result-summary'] } : {}),
          ...(queries.length ? { queries } : {}),
          ...(call['duration-ms'] === undefined ? {} : { durationMs: call['duration-ms'] }),
          ...(call.args?.chunk_ids?.length ? { chunkCount: call.args.chunk_ids.length } : {}),
        });
      }
    }
    if (frame.event === 'agent/finalized') {
      events.push({ type: 'stage', stage: 'done', iteration: 3, maxIterations: 30 });
    }
    for (const event of events) out.push(...state.read(event));
  }
  return stepsOf(out);
}

/** The steps as the view keeps them: one per id, the later report replacing the earlier one. */
function stepsOf(events: StreamEvent[]): ThinkingStep[] {
  const steps: ThinkingStep[] = [];
  for (const event of events) {
    if (event.type !== 'thinking-step') continue;
    const at = steps.findIndex((step) => step.id === event.step.id);
    if (at === -1) steps.push(event.step);
    else steps[at] = event.step;
  }
  return steps;
}

const documents: SourceDocument[] = run.sources.map((source, index) => ({
  id: `doc-${index}`,
  title: source.name,
  excerpts: [],
}));

const finished = (steps: ThinkingStep[]) =>
  procedureFrom({
    steps,
    thinking: false,
    question: run.question,
    scope: 'Alle dokumentene i Kudos.',
    documents,
  });

describe('«Fremgangsmåte» from a real genki turn', () => {
  it('is the same through the live and the bff client', () => {
    expect(finished(bffSteps())).toEqual(finished(mcpSteps()));
  });

  it('says what the assistant searched for, read and used, phase by phase', () => {
    const { phases } = finished(mcpSteps());

    expect(phases.map((phase) => [phase.title, phase.body])).toEqual([
      [
        'Forsto spørsmålet',
        [
          'Jeg tolket spørsmålet slik: «Sammenlign de to siste årsrapportene til Digitaliseringsdirektoratet Digdir».',
        ],
      ],
      [
        'Så på hvilke kilder tråden leser fra',
        ['Alle dokumentene i Kudos.', 'Jeg avgrenset søket til Digitaliseringsdirektoratet.'],
      ],
      [
        'Lette etter steder som handler om spørsmålet',
        [
          'Jeg lette etter omtale av blant annet disse temaene:',
          [
            'Digdir årsrapport 2025',
            'Digitaliseringsdirektoratet årsrapport 2025',
            'Digdir årsrapport 2024',
            'Årsrapport Digitaliseringsdirektoratet 2023',
            'Årsrapport Digitaliseringsdirektoratet 2024 Hovedtall',
            'Årsrapport Digitaliseringsdirektoratet 2023 Hovedtall',
          ],
          'Søkene fant 75 treff.',
        ],
      ],
      [
        'Leste de relevante delene nøye',
        [
          'Leste 18 utdrag, blant annet fra disse dokumentene:',
          [
            'Årsrapport Digitaliseringsdirektoratet 2024',
            'Årsrapport Digitaliseringsdirektoratet 2023',
          ],
        ],
      ],
      [
        'Valgte ut det som svarer på spørsmålet',
        [
          '2 dokumenter er brukt i svaret:',
          [
            'Årsrapport Digitaliseringsdirektoratet 2024',
            'Årsrapport Digitaliseringsdirektoratet 2023',
          ],
        ],
      ],
      ['Skrev svaret', []],
    ]);
    expect(phases.some((phase) => phase.ongoing)).toBe(false);
  });

  it('ends with what it read, used and how long it took', () => {
    const procedure = finished(mcpSteps());
    expect(procedureStatus(procedure, false, documents.length, run.seconds * 1000)).toBe(
      'Leste 18 utdrag, brukte 2 dokumenter · tok 24 sekunder',
    );
  });

  // Up to the six `tool/call` frames of the reading turn: live knows the reads have started,
  // and nothing yet of what they found.
  it('says which phase it is in while it reads, and only what has been reported', () => {
    const reading = frames.findLastIndex((frame) => frame.event === 'tool/call') + 1;
    const procedure = procedureFrom({
      steps: mcpSteps(reading),
      thinking: true,
      question: run.question,
      scope: 'Alle dokumentene i Kudos.',
    });

    expect(procedure.phases.map((phase) => [phase.title, phase.ongoing])).toEqual([
      ['Forsto spørsmålet', false],
      ['Så på hvilke kilder tråden leser fra', false],
      ['Lette etter steder som handler om spørsmålet', false],
      ['Leste de relevante delene nøye', true],
    ]);
    expect(procedure.phases.at(-1)?.body).toEqual([]);
    expect(procedureStatus(procedure, true, 0, undefined)).toBe('Jobber · steg 4');
  });

  it('draws no phase the turn did not reach', () => {
    const searched = frames.findIndex(
      (frame) => frame.event === 'agent/iteration-started' && frame.iteration === 2,
    );
    const { phases } = procedureFrom({ steps: bffSteps(searched), thinking: true });
    expect(phases.map((phase) => phase.id)).toEqual(['understood', 'scope', 'searched']);
  });
});
