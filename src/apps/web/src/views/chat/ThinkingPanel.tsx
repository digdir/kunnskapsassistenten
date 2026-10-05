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
  /**
   * How long the thinking took, measured while it happened and carried on the
   * message. Absent for a turn nobody watched, and the steps' own durations
   * then stand in. See `Message.thoughtMs`.
   */
  thoughtMs?: number;
};

/**
 * What the agent actually searched for, under the step that searched.
 *
 * The strings have been in the model, in the mock and in the live client all
 * along (`tool-calls` → `ThinkingStep.queries`), and nothing drew them — so
 * «Jeg søker i korpuset» stood there without saying after what (KA CC,
 * 2026-09-16). They are the one part of the thinking a reader can check the
 * answer against: a search for the wrong words explains a thin answer.
 *
 * Tags, and the same neutral ones as «Nøkkelord som ble brukt i søket» in
 * Fremgangsmåte, because it is the same kind of thing — words the machine
 * used, not words to press. They are not clickable there and not here
 * (answer 13). Search strings are short («DSS årsrapport 2022»), and the one
 * long one there is — the mock's failure step sends the reader's whole
 * question — wraps rather than running out through the side of the card,
 * which is what `ka-tag--wrapping` is for.
 *
 * The list carries the lead-in as its accessible name, so a screen reader
 * that jumps by list hears what the list is instead of two bare strings. The
 * lead-in is visible as well: chips with no label are words without a reason.
 *
 * Nothing here is drawn while the panel is shut — it is `Details.Content` —
 * so a closed panel is exactly as tall as it was.
 */
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
 * «Tenker …»: what the agent is doing while the search takes its time.
 *
 * Lars, 2026-09-15: «når søkingen tar lang tid vil jeg gjerne vite hva
 * modellen driver med». The steps have been in the stream and in the model
 * all along (`agent/thinking` → `StreamEvent` → `Message.thinkingSteps`);
 * until now nothing drew them, so a long search was a blank card.
 *
 * It knows two things: the steps, and whether the answer has started. Not
 * which model, not which backend, not what a step means. The agent writes the
 * steps in Norwegian first person and this renders them as they came —
 * swapping the model out later changes the words and nothing here.
 *
 * `Details` rather than a disclosure of our own: the native `<details>`
 * underneath gives the summary a button role, `aria-expanded` and the
 * keyboard for free, and it sits before the answer in the DOM, so Tab reaches
 * it first.
 *
 * Open while it thinks, shut when the answer starts — the steps are worth
 * watching while they are the only thing happening, and worth folding away
 * the moment there is an answer to read instead. A reader who has an opinion
 * overrides both: `chosen` outranks the automatic state for the rest of the
 * turn, in either direction.
 *
 * It does not announce anything. The steps arrive several seconds apart, and
 * a polite region that speaks once per step would talk over the answer it is
 * waiting for; the one «Kunnskapsassistenten søker …» is said by the view's
 * own region, once, when the first step lands. See useChat.
 */
export function ThinkingPanel({ steps, status, thoughtMs }: ThinkingPanelProps) {
  const thinking = status === 'thinking';
  // One per panel, and the step id makes it one per step. Two answers on
  // screen each have a panel, and `aria-labelledby` points at an id — the
  // same id twice would point both lists at the first one's text.
  const queryLabelId = useId();

  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const open = chosen ?? thinking;

  /*
   * The number is read, not taken. This panel used to run the clock itself,
   * from its first render with `thinking` to the render where that stopped —
   * which meant the number lived in a component that only exists while the
   * conversation is on screen. Reload it and the number was gone, and the sum
   * of the steps' own `durationMs` answered instead: «Tenkte i 2 sekunder»
   * became «Tenkte i 4 sekunder» for a turn that had not changed (brukerblikk
   * runde 2, funn 5).
   *
   * So the measurement moved to where the two ends of the interval are — the
   * stream — and travels with the message. See `useChat` and `Message`.
   */
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
