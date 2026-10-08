import { describe, expect, it } from 'vitest';
import type { ThinkingStep } from '../../model';
import { reportedDurationMs, thoughtForLabel } from './thinkingTime';

function step(id: string, durationMs?: number): ThinkingStep {
  return { id, kind: 'reasoning', label: `Steg ${id}`, durationMs };
}

describe('reportedDurationMs', () => {
  it('adds up what the steps reported', () => {
    expect(reportedDurationMs([step('a', 2410), step('b', 980), step('c', 620)])).toBe(4010);
  });

  it('counts the steps that reported something and ignores the rest', () => {
    expect(reportedDurationMs([step('a'), step('b', 980)])).toBe(980);
  });

  it('has nothing to report when no step timed itself', () => {
    expect(reportedDurationMs([step('a'), step('b')])).toBeUndefined();
    expect(reportedDurationMs([])).toBeUndefined();
  });
});

describe('thoughtForLabel', () => {
  it('counts whole seconds, in Norwegian', () => {
    expect(thoughtForLabel(4010)).toBe('Tenkte i 4 sekunder');
    expect(thoughtForLabel(1400)).toBe('Tenkte i 1 sekund');
  });

  it('never says zero seconds', () => {
    // Faster than half a second is still not «no time at all».
    expect(thoughtForLabel(120)).toBe('Tenkte i 1 sekund');
  });

  it('says nothing about time it does not know', () => {
    expect(thoughtForLabel(undefined)).toBe('Tenkte');
  });
});
