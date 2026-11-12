import type { ApproachStep } from './Approach.js';

/** One line of the card: a step, or a run of the same step one after another. */
export interface ApproachLine {
  /** The first step's id, so the line keeps its place while the run grows. */
  key: string;
  /** The run's last step, whose account is the newest; in progress if any step of the run is. */
  step: ApproachStep;
  /** How many steps the run has. */
  count: number;
  /** The excerpts the run read, added up. */
  excerpts: number;
}

/** The card's lines: steps that ran one after another with the same title make one line. */
export const linesOf = (steps: readonly ApproachStep[]): ApproachLine[] => {
  const lines: ApproachLine[] = [];
  for (const step of steps) {
    const line = lines.at(-1);
    const excerpts = step.excerptsRead ?? 0;
    const ran = step.status !== 'waiting' && line?.step.status !== 'waiting';
    if (line && ran && line.step.title === step.title) {
      const active = line.step.status === 'active' || step.status === 'active';
      line.step = active ? { ...step, status: 'active' } : step;
      line.count += 1;
      line.excerpts += excerpts;
      continue;
    }
    lines.push({ key: step.id, step, count: 1, excerpts });
  }
  return lines;
};
