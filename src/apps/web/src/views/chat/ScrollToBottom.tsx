import { Button } from '@digdir/designsystemet-react';
import { ArrowDownIcon } from '@navikt/aksel-icons';

type ScrollToBottomProps = {
  /** Scroll the column to its end. `byKeyboard` when Enter or Space did it. */
  onScroll: (byKeyboard: boolean) => void;
};

/**
 * «Bla til nederst», once for the whole column (runde 3, ekstra 5).
 *
 * It was a button in every answer's action row, which put one in each chat
 * block and none where the reader was when they wanted it: halfway up a long
 * answer, the row with the button is at the end of that answer, below the
 * fold. It now stands over the compose field and moves with it, so it is in
 * the same place wherever the reader is in the conversation.
 *
 * Drawn only when there is something below (answer 17), by the chat view.
 *
 * `detail` is 0 for a click the keyboard made, and a screen reader's click is
 * made the same way. That is how the chat view knows to hand the focus on.
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
