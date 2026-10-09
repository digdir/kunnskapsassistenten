import type { ThinkingStep } from '../../model';

/** How long the agent spent before writing: the clock for a turn watched
    live, the steps' own durations for one read back, and with neither no
    number at all rather than a guess. */

/** Sum of the durations the steps reported, or undefined when none did. */
export function reportedDurationMs(steps: ThinkingStep[]): number | undefined {
  const reported = steps.filter((step) => typeof step.durationMs === 'number');
  if (reported.length === 0) return undefined;
  return reported.reduce((total, step) => total + (step.durationMs ?? 0), 0);
}

/** The summary text once the thinking is over. Rounded to whole seconds and
    never to zero: «Tenkte i 0 sekunder» reads as a bug. */
export function thoughtForLabel(durationMs: number | undefined): string {
  if (durationMs === undefined) return 'Tenkte';
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return seconds === 1 ? 'Tenkte i 1 sekund' : `Tenkte i ${seconds} sekunder`;
}
