import type { StreamEvent, ThinkingStep } from '../../model';

/**
 * The steps and thinking time one answer showed, taken from the events on their way to the chat so
 * they can be stored with the answer (sourceStore.ts). Measured the way `useChat` measures
 * `Message.thoughtMs`, so the number after a reload is the one that was on screen.
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
