import { describe, expect, it } from 'vitest';
import type { StreamEvent, ThinkingStep } from '../../model';
import type { BffTurnEvent } from './contract';
import { BffTurnState } from './mapping';
import stream from './fixtures/ask-tenkesteg.sse?raw';

/**
 * Tenkepanelet i bff-modus skal vise det samme som i live.
 *
 * Målt 2026-09-29 med samme spørsmål mot begge: live viste agentens eget
 * resonnement, hva hvert verktøykall fant og hvor lang tid det tok, mens
 * poden viste fire faste setninger og ingenting mer. Årsaken var at BFF-en
 * bare sendte `stage`, som sier hvilken fase agenten er i og ingenting om
 * hva den gjorde.
 *
 * Fiksturen er tatt opp fra BFF-en med `thinking` og `tool-call`, ved å
 * spille en ekte backend-strøm gjennom `ask()` og skrive ned hendelsene den
 * sendte. Spørsmålet var «Hva skriver DFØ i årsrapporten for 2024 om
 * måloppnåelse?» mot hele Kudos lokalt.
 */
const events: BffTurnEvent[] = stream
  .split('\n\n')
  .filter(Boolean)
  .map((frame) => JSON.parse(frame.replace(/^data: /u, '')) as BffTurnEvent);

function stepsFrom(list: BffTurnEvent[]): ThinkingStep[] {
  const state = new BffTurnState();
  const out: StreamEvent[] = [];
  for (const event of list) out.push(...state.read(event));
  return out.flatMap((event) => (event.type === 'thinking-step' ? [event.step] : []));
}

describe('tenkesteg fra BFF-en', () => {
  it('har agentens egne ord, søkene, lesingen og avslutningen, i rekkefølge', () => {
    const steps = stepsFrom(events);

    expect(steps.map((step) => step.kind)).toEqual([
      'reasoning',
      'search',
      'reasoning',
      'read',
      'search',
      'search',
      'finalizing',
    ]);
  });

  it('bruker agentens egne ord som etikett, ikke en fast setning', () => {
    const [first] = stepsFrom(events);

    expect(first?.kind).toBe('reasoning');
    expect(first?.label).toContain('DFØs årsrapport for 2024');
  });

  it('setter det backenden fant som detalj under den norske setningen', () => {
    const search = stepsFrom(events).find((step) => step.kind === 'search');

    expect(search?.label).toBe('Jeg søker i dokumentene.');
    expect(search?.detail).toContain('Search pass 1: found 63 chunks');
    expect(search?.durationMs).toBeGreaterThan(0);
  });

  it('skiller lesing fra søk på samme regel som live', () => {
    const read = stepsFrom(events).find((step) => step.kind === 'read');

    expect(read?.label).toBe('Jeg leser utdragene.');
    expect(read?.detail).toContain('Read 4 chunks');
  });

  it('gir hvert kall sitt eget steg, også når én ramme bar flere', () => {
    // To kall i samme `agent/turn-completed` ga før ett steg for hele fasen.
    const steps = stepsFrom([
      { type: 'tool-call', tool: 'read_chunks', chunkCount: 4, detail: 'Read 4 chunks' },
      { type: 'tool-call', tool: 'read_chunks', chunkCount: 3, detail: 'Read 3 chunks' },
    ]);

    expect(steps).toHaveLength(2);
    expect(steps.map((step) => step.detail)).toEqual(['Read 4 chunks', 'Read 3 chunks']);
    expect(new Set(steps.map((step) => step.id)).size).toBe(2);
  });

  it('tegner ingen steg av de andre fasene, som bare sier hvor agenten er', () => {
    const steps = stepsFrom([
      { type: 'stage', stage: 'starting', iteration: 1, maxIterations: 10 },
      { type: 'stage', stage: 'searching', iteration: 1, maxIterations: 10 },
      { type: 'stage', stage: 'writing', iteration: 2, maxIterations: 10 },
    ]);

    expect(steps).toEqual([]);
  });

  it('samler søkeordene til «Fremgangsmåte», uten gjentakelser', () => {
    const state = new BffTurnState();
    for (const event of events) state.read(event);
    const done = state.read({ type: 'done', conversationId: 'c1', insufficient: false });
    const sources = done.find((event) => event.type === 'sources');
    const keywords = sources?.retrieval.keywords ?? [];

    expect(keywords.length).toBeGreaterThan(0);
    expect(new Set(keywords).size).toBe(keywords.length);
  });
});
