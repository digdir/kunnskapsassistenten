import { Details, Paragraph, Spinner, Tag } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import type { ThinkingStep } from '../../model';
import { reportedDurationMs, thoughtForLabel } from './thinkingTime';

export type ThinkingStatus = 'thinking' | 'done';

type ThinkingPanelProps = {
  /** The steps as they arrived. Rendered in that order, never reordered. */
  steps: ThinkingStep[];
  /** `thinking` until the first token of the answer lands. */
  status: ThinkingStatus;
  /** How long the thinking took, measured while it happened. Absent for a
      turn nobody watched; the steps' own durations then stand in. */
  thoughtMs?: number;
};

// What the agent searched for: the one part of the thinking a reader can
// check the answer against. The list carries the lead-in as its accessible
// name, so a screen reader jumping by list hears what the list is.
function StepQueries({ id, queries }: { id: string; queries: string[] }) {
  return (
    <div className="ka-thinking__queries">
      <Paragraph data-size="sm" id={id} variant="long">
        Søkte etter:
      </Paragraph>
      <ul aria-labelledby={id} className="ka-thinking__query-list">
        {queries.map((query, index) => (
          <li key={`${index}-${query}`}>
            <Tag className="ka-tag--wrapping" data-color="neutral" data-size="sm">
              {query}
            </Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * «Tenker …»: the agent's own words while the search takes its time. Open
 * while it thinks, shut when the answer starts, `chosen` outranking both. It
 * announces nothing; the view's region says it once (useChat).
 */
export function ThinkingPanel({ steps, status, thoughtMs }: ThinkingPanelProps) {
  const thinking = status === 'thinking';
  // One per panel, and the step id makes it one per step. Two answers on
  // screen each have a panel, and `aria-labelledby` points at an id — the
  // same id twice would point both lists at the first one's text.
  const queryLabelId = useId();

  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const open = chosen ?? thinking;

  // The number is READ, never run here: a clock in this panel exists only
  // while the conversation is on screen, so the same unchanged turn reports
  // one number live and another after a reload. See `useChat`.
  if (steps.length === 0) return null;

  const lastIndex = steps.length - 1;

  return (
    <Details
      className="ka-thinking"
      data-color="neutral"
      onToggle={(event) => setChosen((event.currentTarget as HTMLDetailsElement).open)}
      open={open}
    >
      <Details.Summary>
        <span className="ka-thinking__summary">
          {thinking ? (
            <>
              <Spinner aria-hidden="true" data-size="xs" />
              Tenker …
            </>
          ) : (
            thoughtForLabel(thoughtMs ?? reportedDurationMs(steps))
          )}
        </span>
      </Details.Summary>

      <Details.Content>
        <ol className="ka-thinking__steps">
          {steps.map((step, index) => {
            // The step being worked on right now. `aria-current` says so
            // without a live region, so a reader who goes looking is told
            // where the agent is and nobody is interrupted who is not.
            const ongoing = thinking && index === lastIndex;
            return (
              <li
                aria-current={ongoing ? 'step' : undefined}
                className="ka-thinking__step"
                data-ongoing={ongoing ? 'true' : undefined}
                key={step.id}
              >
                <Paragraph variant="long">{step.label}</Paragraph>
                {step.detail ? (
                  <Paragraph className="ka-thinking__detail" data-size="sm" variant="long">
                    {step.detail}
                  </Paragraph>
                ) : null}
                {step.queries?.length ? (
                  <StepQueries id={`${queryLabelId}-${step.id}`} queries={step.queries} />
                ) : null}
              </li>
            );
          })}
        </ol>
      </Details.Content>
    </Details>
  );
}
