import { Button, Paragraph } from '@digdir/designsystemet-react';

type AnswerSwitcherProps = {
  /**
   * «Kilder til svar 2 av 3», built by the view.
   *
   * Handed in rather than built here, because the live region that announces
   * it lives in the view and the two have to be one string, not two that
   * drift apart.
   */
  label: string;
  /** Zero-based position in the thread's answers; the user reads it one-based. */
  index: number;
  count: number;
  onStep: (step: 1 | -1) => void;
};

/**
 * «Kilder til svar 2 av 3», with a way to step between the answers.
 *
 * The panel shows one answer's sources at a time (brukerreiser punkt 5). That
 * is only honest if the reader can see WHICH answer, because the excerpts are
 * numbered from 1 in every answer and two sets look identical from the
 * outside. So this line is not decoration: it is the thing that stops
 * «Utdrag 2» from being ambiguous.
 *
 * The counter is `aria-hidden`, and the live region that announces it sits in
 * `SourcesView` instead. A live region has to be in the document BEFORE its
 * content changes, or the change goes unannounced — and this row mounts on the
 * same commit as the second answer, which is the one moment the announcement
 * matters (KA CC on PR #36). The view builds the label and hands it to both.
 *
 * `aria-disabled` rather than `disabled` at the ends, for the reason spelled
 * out in `ExcerptSearch`: stepping is something you do by pressing the same
 * button repeatedly, and a `disabled` button drops focus to `<body>` the
 * moment it turns off. Designsystemet draws the two alike.
 */
export function AnswerSwitcher({ label, index, count, onStep }: AnswerSwitcherProps) {
  const atFirst = index === 0;
  const atLast = index >= count - 1;

  return (
    <div className="sources-answer-switcher">
      <Paragraph aria-hidden="true" data-size="xs" className="sources-answer-switcher__count">
        {label}
      </Paragraph>

      <div className="sources-answer-switcher__steps">
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label="Forrige svar"
          aria-disabled={atFirst || undefined}
          onClick={() => !atFirst && onStep(-1)}
        >
          Forrige
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label="Neste svar"
          aria-disabled={atLast || undefined}
          onClick={() => !atLast && onStep(1)}
        >
          Neste
        </Button>
      </div>
    </div>
  );
}
