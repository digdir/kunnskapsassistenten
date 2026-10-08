import type { ThinkingStep } from '../../model';

/**
 * How long the agent spent before it started writing.
 *
 * Two sources, and they answer slightly different questions. A turn watched
 * live is measured on the clock, from the first step to the first token —
 * that is the wait the reader actually sat through, and it is the number the
 * brief asks for. A conversation opened from the list was not watched by
 * anyone, so the only thing left is what the steps themselves reported.
 *
 * Neither is available for a stored answer whose steps carry no durations, and
 * then the summary says «Tenkte» and no number. Inventing one from the step
 * count would be a guess dressed as a measurement.
 */

/** Sum of the durations the steps reported, or undefined when none did. */
export function reportedDurationMs(steps: ThinkingStep[]): number | undefined {
  const reported = steps.filter((step) => typeof step.durationMs === 'number');
  if (reported.length === 0) return undefined;
  return reported.reduce((total, step) => total + (step.durationMs ?? 0), 0);
}

/**
 * The summary text once the thinking is over.
 *
 * Rounded to whole seconds, and never to zero: «Tenkte i 0 sekunder» reads as
 * a bug, and anything fast enough to round down was still more than nothing.
 */
export function thoughtForLabel(durationMs: number | undefined): string {
  if (durationMs === undefined) return 'Tenkte';
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return seconds === 1 ? 'Tenkte i 1 sekund' : `Tenkte i ${seconds} sekunder`;
}
