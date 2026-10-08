import { Details, Paragraph, Spinner, Tag } from '@digdir/designsystemet-react';
import { useId, useState, useSyncExternalStore } from 'react';
import { RobotIcon } from '@navikt/aksel-icons';
import type { RetrievalDetails, ThinkingStep } from '../../model';

/**
 * Where the procedure has room to stand open.
 *
 * 774 px is where the answer column stops being a reading width between two
 * rails and becomes the whole window — 67 + 640 + 67, the same sum
 * `drawerMaxViewport` is built from in src/layout/viewModel.ts. It is written
 * here rather than imported because it answers a different question than any
 * of the shell's breakpoints: not «where does a panel become a drawer» but
 * «is there room to read the procedure and the answer at once».
 *
 * Measured with a four-step answer and five keywords, open: 450 px of a
 * 900 px window at 1440, 487 of 1024 at 768, 783 of 956 at 440 and 965 of
 * 844 at 390. Above the line the answer's first heading is on screen under
 * it. Below it the procedure IS the screen, and someone who asked a question
 * would scroll past all of it to reach what they asked for.
 */
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

/**
 * The search words, less the one that is only the question over again.
 *
 * The agent plans its searches from the question, and the first thing it
 * plans is often the question itself: against the whole of Kudos the reader's
 * own sentence came back as one of the words it «searched for» (#4 on #208).
 * It is true, and it says nothing — the reader wrote it, and it is on screen
 * two lines above. What is worth reading here is what the agent made of it.
 *
 * Only at this level. The detailed panel shows what the machine did, verbatim,
 * and a developer reading it wants the list the backend actually sent.
 */
function worthShowing(keywords: readonly string[], question?: string): string[] {
  if (!question) return [...keywords];
  return keywords.filter((keyword) => !sameWords(keyword, question));
}

/**
 * «Fremgangsmåte»: what the assistant set out to do, in its own words.
 *
 * The standard half of the display level (issue 88), drawn after the sketch
 * in issue 113: one panel over the answer card with the steps under
 * «Tenker …», which becomes «Tenkte» when the answer starts, and the search
 * words under «Nøkkelord som ble brukt i søket».
 *
 * It draws the same steps the detailed panel draws, and nothing else from
 * them: no per-step detail, no per-step search strings, no times. What a step
 * SAYS is the agent's plan read back — «Jeg søker i korpuset», «Jeg leser
 * årsrapporten» — and that is what issue 88 asks to keep. What a step
 * measured is machinery, and that is what it asks to lose. The hit count goes with
 * it: «10 treff i 3 dokumenter» counts chunks, and a chunk is not a thing a
 * reader has ever seen.
 *
 * The keywords stay, and they are the reason the panel opens itself. They are
 * what an answer can be checked against — a search for the wrong words
 * explains a thin answer — and what makes an answer checkable should not be
 * behind a click. That was the old «Fremgangsmåte»'s rule inside the card,
 * and it moves up here with the name.
 *
 * It opens itself where there is room for both it and the answer, and stays
 * shut where there is not; `ROOM_TO_STAND_OPEN` above has the measurements. A
 * reader who has an opinion overrides it either way, for the rest of the turn.
 *
 * `Details`, like the detailed panel: the native `<details>` gives the summary
 * a button role, `aria-expanded` and the keyboard for free.
 *
 * It announces nothing, for the reason `ThinkingPanel` gives: the steps
 * arrive seconds apart, and the view's own region already says once that the
 * assistant is searching.
 */
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

        {/*
          The words the search actually ran on, with the rule above them that
          the design draws. Plain Tags: they are not clickable (answer 13), and
          they wrap inside themselves rather than running out through the side
          of the panel — see `ka-tag--wrapping`.

          The list carries the lead-in as its accessible name, so a reader who
          jumps by list hears what the list is instead of five bare strings.
        */}
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
