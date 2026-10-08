import type { ThinkingStep } from '../../model';

/** Same text, allowing for case and for how the whitespace is broken up. */
function sameText(a: string, b: string): boolean {
  const plain = (text: string) => text.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('nb-NO');
  return plain(a) === plain(b);
}

/**
 * The thinking steps, less the one that is the answer over again, which
 * happens on an iteration with no tool call. Only a word-for-word match goes:
 * nobody has measured how much overlap is enough to drop more than that.
 */
export function thinkingWithoutAnswer(
  steps: ThinkingStep[] | undefined,
  answer: string,
): ThinkingStep[] | undefined {
  if (!steps?.length || !answer.trim()) return steps;
  const kept = steps.filter((step) => !(step.kind === 'reasoning' && sameText(step.label, answer)));
  return kept.length === steps.length ? steps : kept;
}
