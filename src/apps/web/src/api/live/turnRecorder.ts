import type { StreamEvent, ThinkingStep } from '../../model';

/**
 * What one answer showed while it was being written, taken from the events on
 * their way to the chat, so it can be written down with the answer
 * (sourceStore.ts, issue 88).
 *
 * The steps, as they arrived, and how long the agent thought: from the first
 * step to the first word of the answer. That is the interval `useChat`
 * measures for `Message.thoughtMs`, read off the same events in the same
 * order, so the number brought back after a reload is the one that was on
 * screen (brukerblikk runde 2, funn 5: two honest numbers for one turn is one
 * too many).
 */
export class TurnRecorder {
  readonly #steps: ThinkingStep[] = [];
  #firstStepAt: number | undefined;
  #thoughtMs: number | undefined;
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  get thinkingSteps(): ThinkingStep[] {
    return [...this.#steps];
  }

  /** Undefined when no step came before the answer's first word. */
  get thoughtMs(): number | undefined {
    return this.#thoughtMs;
  }

  observe(event: StreamEvent): void {
    if (event.type === 'thinking-step') {
      this.#steps.push(event.step);
      this.#firstStepAt ??= this.#now();
      return;
    }
    // Only the first word ends the thinking; the rest is the answer.
    if (
      event.type === 'token' &&
      this.#thoughtMs === undefined &&
      this.#firstStepAt !== undefined
    ) {
      this.#thoughtMs = this.#now() - this.#firstStepAt;
    }
  }
}
