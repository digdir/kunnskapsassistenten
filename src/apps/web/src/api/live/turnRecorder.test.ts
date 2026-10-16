import { describe, expect, it } from 'vitest';
import type { StreamEvent } from '../../model';
import { TurnRecorder } from './turnRecorder';

const step = (id: string): StreamEvent => ({
  type: 'thinking-step',
  step: { id, kind: 'reasoning', label: `Steg ${id}` },
});
const token = (text: string): StreamEvent => ({ type: 'token', text });

/** A clock that says what the test tells it to. */
function clock() {
  let now = 0;
  return { at: (ms: number) => (now = ms), now: () => now };
}

describe('TurnRecorder', () => {
  it('tar vare på stegene i den rekkefølgen de kom', () => {
    const turn = new TurnRecorder();

    turn.observe(step('1'));
    turn.observe(token('Svar'));
    turn.observe(step('2'));

    expect(turn.thinkingSteps.map((s) => s.id)).toEqual(['1', '2']);
  });

  it('keeps one step when the same one comes again, filled in', () => {
    const turn = new TurnRecorder();

    turn.observe(step('tool-1-search'));
    turn.observe({
      type: 'thinking-step',
      step: {
        id: 'tool-1-search',
        kind: 'search',
        label: 'Jeg søker i dokumentene.',
        detail: '20 treff',
      },
    });
    turn.observe(step('tool-2-read_chunks'));

    // What is stored is what the screen showed: one step per call, with its summary.
    expect(turn.thinkingSteps.map((s) => s.id)).toEqual(['tool-1-search', 'tool-2-read_chunks']);
    expect(turn.thinkingSteps[0].detail).toBe('20 treff');
  });

  it('måler tenketiden fra første steg til første ord, som useChat gjør', () => {
    const time = clock();
    const turn = new TurnRecorder(time.now);

    time.at(1000);
    turn.observe(step('1'));
    time.at(2500);
    turn.observe(step('2'));
    time.at(4200);
    turn.observe(token('Svar '));
    time.at(9000);
    turn.observe(token('fortsetter.'));

    expect(turn.thoughtMs).toBe(3200);
  });

  it('har ingen tenketid når ordene kom før noe steg', () => {
    const turn = new TurnRecorder();

    turn.observe(token('Svar.'));
    turn.observe(step('1'));

    expect(turn.thoughtMs).toBeUndefined();
  });

  it('lar andre hendelser være', () => {
    const turn = new TurnRecorder();

    turn.observe({
      type: 'sources',
      documents: [],
      citations: [],
      retrieval: { hitCount: 0, documentCount: 0, keywords: [] },
    });

    expect(turn.thinkingSteps).toEqual([]);
    expect(turn.thoughtMs).toBeUndefined();
  });

  it('gir en kopi av stegene, så den som får dem, ikke endrer det som skrives ned', () => {
    const turn = new TurnRecorder();
    turn.observe(step('1'));

    turn.thinkingSteps.push({ id: 'x', kind: 'reasoning', label: 'Lagt til utenfra' });

    expect(turn.thinkingSteps).toHaveLength(1);
  });
});
