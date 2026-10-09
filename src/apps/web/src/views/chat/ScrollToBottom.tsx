import { Button } from '@digdir/designsystemet-react';
import { ArrowDownIcon } from '@navikt/aksel-icons';

type ScrollToBottomProps = {
  /** Scroll the column to its end. `byKeyboard` when Enter or Space did it. */
  onScroll: (byKeyboard: boolean) => void;
};

/**
 * «Bla til nederst», once for the whole column and over the compose field, so
 * it stays in one place. `detail` is 0 for a click the keyboard made, which
 * is how the chat view knows to hand the focus on.
 */
export function ScrollToBottom({ onScroll }: ScrollToBottomProps) {
  return (
    <Button
      className="ka-scroll-to-bottom"
      data-color="neutral"
      data-size="sm"
      onClick={(event) => onScroll(event.detail === 0)}
      variant="secondary"
    >
      <ArrowDownIcon aria-hidden />
      Bla til nederst
    </Button>
  );
}
