import { Details, Paragraph, Spinner, Tag } from '@digdir/designsystemet-react';
import { useId, useState, useSyncExternalStore } from 'react';
import { RobotIcon } from '@navikt/aksel-icons';
import type { RetrievalDetails, ThinkingStep } from '../../model';

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
  /** The steps as they arrived. Rendered in that order, never reordered. */
  steps: ThinkingStep[];
  /** `thinking` until the first token of the answer lands. */
  status: 'thinking' | 'done';
  /** What the answer was built from. Absent until the turn is finished. */
  retrieval?: RetrievalDetails;
  /** The question this answer is an answer to. See `worthShowing`. */
  question?: string;
};

/** Same string, allowing for case, spacing and a closing mark. */
function sameWords(a: string, b: string): boolean {
  const plain = (text: string) =>
    text
      .toLowerCase()
      .replace(/[?.!\s]+$/u, '')
      .replace(/\s+/gu, ' ')
      .trim();
  return plain(a) === plain(b);
}

/** The search words, less the one that is only the question over again,
    which is true and says nothing. Only at this level; the detailed panel
    shows the list the backend actually sent. */
function worthShowing(keywords: readonly string[], question?: string): string[] {
  if (!question) return [...keywords];
  return keywords.filter((keyword) => !sameWords(keyword, question));
}

/** «Fremgangsmåte» (issue 88): the same steps as the detailed panel and
    nothing else from them, since what a step SAYS is the agent's plan and
    what it measured is machinery. The keywords are why it opens itself. */
export function ProcedurePanel({ steps, status, retrieval, question }: ProcedurePanelProps) {
  const thinking = status === 'thinking';
  // The reader's own choice outranks the automatic state for the rest of the
  // turn, in either direction. Same rule as the detailed panel.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  // One per panel, and `aria-labelledby` points at an id: two answers on
  // screen with the same id would label both lists with the first one's text.
  const keywordLabelId = useId();
  const room = useSyncExternalStore(subscribeToWidth, hasRoom);

  if (steps.length === 0) return null;

  const open = chosen ?? room;
  const keywords = worthShowing(retrieval?.keywords ?? [], question);
  const lastIndex = steps.length - 1;

  return (
    <Details
      className="ka-procedure"
      data-color="neutral"
      onToggle={(event) => setChosen((event.currentTarget as HTMLDetailsElement).open)}
      open={open}
    >
      <Details.Summary>
        <span className="ka-procedure__summary">
          <RobotIcon aria-hidden className="ka-procedure__icon" />
          Fremgangsmåte
        </span>
      </Details.Summary>

      <Details.Content>
        <div className="ka-procedure__block">
          <Paragraph className="ka-procedure__label" data-size="sm">
            {thinking ? (
              <>
                <Spinner aria-hidden="true" data-size="xs" />
                Tenker …
              </>
            ) : (
              'Tenkte'
            )}
          </Paragraph>
          <ol className="ka-procedure__steps">
            {steps.map((step, index) => {
              // The step being worked on right now. `aria-current` says so
              // without a live region, so a reader who goes looking is told
              // where the agent is and nobody is interrupted who is not.
              const ongoing = thinking && index === lastIndex;
              return (
                <li
                  aria-current={ongoing ? 'step' : undefined}
                  className="ka-procedure__step"
                  data-ongoing={ongoing ? 'true' : undefined}
                  key={step.id}
                >
                  <Paragraph variant="long">{step.label}</Paragraph>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The words the search actually ran on. Plain Tags, since they are
            not clickable, and the list carries the lead-in as its accessible
            name, so jumping by list hears what the list is. */}
        {keywords.length ? (
          <div className="ka-procedure__block ka-procedure__block--ruled">
            <Paragraph className="ka-procedure__label" data-size="sm" id={keywordLabelId}>
              Nøkkelord som ble brukt i søket
            </Paragraph>
            <ul aria-labelledby={keywordLabelId} className="ka-procedure__keywords">
              {keywords.map((keyword) => (
                <li key={keyword}>
                  <Tag className="ka-tag--wrapping" data-color="neutral" data-size="sm">
                    {keyword}
                  </Tag>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Details.Content>
    </Details>
  );
}
