import { describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { thinkingWithoutAnswer } from './thinkingWithoutAnswer';

const ANSWER = 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.';

const step = (over: Partial<ThinkingStep> & { label: string }): ThinkingStep => ({
  id: 's1',
  kind: 'reasoning',
  ...over,
});

const labels = (steps: ThinkingStep[] | undefined) => steps?.map((s) => s.label);

describe('thinkingWithoutAnswer', () => {
  it('drops the reasoning step that is the answer', () => {
    const kept = thinkingWithoutAnswer([step({ label: ANSWER })], ANSWER);

    expect(kept).toEqual([]);
  });

  it('allows for how the whitespace is broken up', () => {
    // The backend writes its own line breaks; the answer is stored as it was
    // streamed. The two say the same thing.
    const kept = thinkingWithoutAnswer(
      [step({ label: 'Nkom måler måloppnåelse\n  mot målene i tildelingsbrevet. ' })],
      ANSWER,
    );

    expect(kept).toEqual([]);
  });

  it('keeps a step that only says something about the answer', () => {
    const steps = [step({ label: 'Jeg har nok til å svare.' })];

    expect(labels(thinkingWithoutAnswer(steps, ANSWER))).toEqual(['Jeg har nok til å svare.']);
  });

  it('keeps a step of another kind, whatever it says', () => {
    // The fixed labels are ours, and `finalizing` is drawn from the stage the
    // backend reports — never from text a model wrote.
    const steps = [step({ id: 'f1', kind: 'finalizing', label: ANSWER })];

    expect(labels(thinkingWithoutAnswer(steps, ANSWER))).toEqual([ANSWER]);
  });

  it('leaves the other steps where they were', () => {
    const steps = [
      step({ id: 's0', kind: 'search', label: 'Jeg søker i dokumentene.' }),
      step({ label: ANSWER }),
      step({ id: 's2', kind: 'finalizing', label: 'Jeg skriver svaret.' }),
    ];

    expect(labels(thinkingWithoutAnswer(steps, ANSWER))).toEqual([
      'Jeg søker i dokumentene.',
      'Jeg skriver svaret.',
    ]);
  });

  it('hands the same list back when nothing was dropped', () => {
    // The list goes to `useMemo`-less props, and a new array every render
    // would be a new prop every render.
    const steps = [step({ label: 'Jeg leser utdragene.' })];

    expect(thinkingWithoutAnswer(steps, ANSWER)).toBe(steps);
  });

  it('drops nothing while the answer is still empty', () => {
    const steps = [step({ label: ANSWER })];

    expect(thinkingWithoutAnswer(steps, '')).toBe(steps);
  });
});
