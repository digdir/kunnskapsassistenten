import type { ThinkingStep } from '../../model';

/** Same text, allowing for case and for how the whitespace is broken up. */
function sameText(a: string, b: string): boolean {
  const plain = (text: string) => text.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('nb-NO');
  return plain(a) === plain(b);
}

/**
 * The thinking steps, less the one that is the answer over again.
 *
 * headless-rag sends `agent/thinking` after every LLM response that carries
 * content, and on an iteration with no tool call that content IS the answer.
 * It arrives as a `reasoning` step and is drawn above the answer, so the
 * reader reads the whole thing and then reads it again (the review of #129).
 *
 * Only a step that is the answer word for word goes. A step that wraps the
 * answer in a sentence of its own — «Her er svaret: …» — stays, and that is
 * on purpose: telling that apart from a step that merely quotes a line of the
 * answer needs a rule about how much overlap is enough, and nobody has
 * measured what the backend actually writes. Dropping too little leaves the
 * reader with the answer twice; dropping too much takes away thinking they
 * asked to see. This errs the first way until there is a measurement.
 *
 * Both display levels, unlike the question-shaped search word next door in
 * `ProcedurePanel`, which only the standard level hides. A search word is a
 * short string the backend sent, and at the detailed level what the backend
 * sent is the point. This is the answer itself, in full, two centimetres
 * above the answer — no level is served by reading it twice.
 *
 * While the answer is still streaming its text does not match yet, so the
 * step stands: at that moment it is the only thing on screen, and it is what
 * the panel is for.
 */
export function thinkingWithoutAnswer(
  steps: ThinkingStep[] | undefined,
  answer: string,
): ThinkingStep[] | undefined {
  if (!steps?.length || !answer.trim()) return steps;
  const kept = steps.filter((step) => !(step.kind === 'reasoning' && sameText(step.label, answer)));
  return kept.length === steps.length ? steps : kept;
}
