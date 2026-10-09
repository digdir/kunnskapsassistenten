import { Button, Paragraph } from '@digdir/designsystemet-react';

type AnswerSwitcherProps = {
  /** Built by the view, so the live region there says the same string. */
  label: string;
  /** Zero-based position in the thread's answers; the user reads it one-based. */
  index: number;
  count: number;
  onStep: (step: 1 | -1) => void;
};

/**
 * «Kilder til svar 2 av 3», which keeps «Utdrag 2» unambiguous. The live region
 * is in `SourcesView`, mounted before this row; `aria-disabled` keeps focus.
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
