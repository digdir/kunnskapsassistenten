import { Card, Details, List, Paragraph, Spinner } from '@digdir/designsystemet-react';
import { useId, useState, useSyncExternalStore } from 'react';
import { RobotSmileIcon } from '@navikt/aksel-icons';
import type { SourceDocument, ThinkingStep } from '../../model';
import { procedureFrom, procedureStatus, type ProcedurePhase } from './procedure';
import { reportedDurationMs } from './thinkingTime';

/** Where the procedure has room to stand open. Written here and not imported
    from the shell, because it answers a different question: «is there room to
    read the procedure and the answer at once». */
const ROOM_TO_STAND_OPEN = '(width >= 774px)';

function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia(ROOM_TO_STAND_OPEN);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function hasRoom(): boolean {
  return window.matchMedia(ROOM_TO_STAND_OPEN).matches;
}

type ProcedurePanelProps = {
  /** The steps as they arrived. Sorted into phases, see procedure.ts. */
  steps: ThinkingStep[];
  /** `thinking` until the first token of the answer lands. */
  status: 'thinking' | 'done';
  /** The question this answer is an answer to: a search that only repeats it is not a topic. */
  question?: string;
  /** Which documents the thread reads from, as a sentence. */
  scope?: string;
  /** The documents the answer cites. Absent until the answer has arrived. */
  documents?: SourceDocument[];
  /** How long the thinking took, measured while it happened. See `useChat`. */
  thoughtMs?: number;
};

/** One phase: its title, «pågår» while the assistant is in it, and what it found. A list carries
    the sentence before it as its accessible name, so a screen reader jumping by list hears what
    the list is. */
function Phase({ phase, idBase }: { phase: ProcedurePhase; idBase: string }) {
  return (
    <List.Item
      aria-current={phase.ongoing ? 'step' : undefined}
      className="ka-procedure__phase"
      data-ongoing={phase.ongoing ? 'true' : undefined}
    >
      <span className="ka-procedure__phase-title">{phase.title}</span>
      {phase.ongoing ? <span className="ka-procedure__state"> · pågår</span> : null}
      {phase.body.map((block, index) => {
        const id = `${idBase}-${phase.id}-${index}`;
        if (typeof block === 'string') {
          return (
            <Paragraph className="ka-procedure__text" data-size="sm" id={id} key={id}>
              {block}
            </Paragraph>
          );
        }
        return (
          <List.Unordered
            aria-labelledby={`${idBase}-${phase.id}-${index - 1}`}
            className="ka-procedure__items"
            data-size="sm"
            key={id}
          >
            {block.map((item, position) => (
              <List.Item key={`${position}-${item}`}>{item}</List.Item>
            ))}
          </List.Unordered>
        );
      })}
    </List.Item>
  );
}

/** «Fremgangsmåte» (design canvas, page «00-Fremgangsmåte», board A1c): what the assistant did,
    as up to seven phases in a numbered list, each filled in from what the backend reported. The
    line under the title says where it is while it works, and what it read and used once done. */
export function ProcedurePanel({
  steps,
  status,
  question,
  scope,
  documents,
  thoughtMs,
}: ProcedurePanelProps) {
  const thinking = status === 'thinking';
  // The reader's own choice outranks the automatic state for the rest of the
  // turn, in either direction. Same rule as the detailed panel.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  // One per panel, and `aria-labelledby` points at an id: two answers on
  // screen with the same id would label both lists with the first one's text.
  const idBase = useId();
  const room = useSyncExternalStore(subscribeToWidth, hasRoom);

  if (steps.length === 0) return null;

  const open = chosen ?? room;
  const procedure = procedureFrom({ steps, thinking, question, scope, documents });
  // The measured wait when there is one; a turn read back has only what the steps reported.
  const line = procedureStatus(
    procedure,
    thinking,
    documents?.length ?? 0,
    thoughtMs ?? reportedDurationMs(steps),
  );

  // Details in a Card, as Designsystemet shows it («Du kan bruke details i eit
  // kort for å få ramme rundt innhaldet»): the card gives the frame and the
  // rounded corners, and a tinted card makes the Details in it tinted.
  return (
    <Card className="ka-procedure-card" data-color="neutral" variant="tinted">
      <Details
        className="ka-procedure"
        onToggle={(event) => setChosen((event.currentTarget as HTMLDetailsElement).open)}
        open={open}
      >
        <Details.Summary>
          <span className="ka-procedure__summary">
            <RobotSmileIcon aria-hidden className="ka-procedure__icon" />
            <span className="ka-procedure__title">
              <span className="ka-procedure__name">Fremgangsmåte</span>
              {line ? (
                <span className="ka-procedure__status">
                  {thinking ? <Spinner aria-hidden="true" data-size="xs" /> : null}
                  {line}
                </span>
              ) : null}
            </span>
          </span>
        </Details.Summary>

        <Details.Content>
          {/* Silent on purpose: the view's polite region says once that the
              assistant is working (useChat). `aria-current` tells a reader who
              goes looking which phase it is in, without interrupting anyone. */}
          <List.Ordered className="ka-procedure__phases">
            {procedure.phases.map((phase) => (
              <Phase idBase={idBase} key={phase.id} phase={phase} />
            ))}
          </List.Ordered>
        </Details.Content>
      </Details>
    </Card>
  );
}
