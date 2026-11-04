import { Button } from '@digdir/designsystemet-react';
import { BackIcon } from '../../components/icons';

type ReturnToAnswerButtonProps = {
  /** Where the caller places it. */
  className: string;
  onClick: () => void;
};

/**
 * «Tilbake til svaret», on the excerpt a footnote opened and on the card a title in «Kilder brukt
 * i svaret» opened. One component, so both ways back look and read the same. The visible text is
 * the accessible name (WCAG 2.5.3). A button: a fragment would be a route change that remounts
 * the chat slot (see the marker in Markdown.tsx).
 */
export function ReturnToAnswerButton({ className, onClick }: ReturnToAnswerButtonProps) {
  return (
    <Button type="button" variant="tertiary" data-size="sm" className={className} onClick={onClick}>
      <BackIcon aria-hidden />
      Tilbake til svaret
    </Button>
  );
}
