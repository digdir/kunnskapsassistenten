import { Button, Dialog, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef } from 'react';
import type { Thread } from '../../model';

export type DeleteThreadDialogProps = {
  /** The thread to confirm, or undefined while nothing is asked. */
  thread: Thread | undefined;
  onConfirm: (thread: Thread) => void;
  onCancel: () => void;
};

/**
 * «Slette tråden?», before a deletion that cannot be undone.
 *
 * What dialog.md prescribes for exactly this case in KA: modal, closed only
 * by a close request and not by a click on the backdrop, focus on «Avbryt»,
 * and the delete button in `danger`. The focus is set from here rather than
 * with `autoFocus`, which the linter forbids (jsx-a11y) and which
 * Designsystemet only honours at the end of an opening animation — so not
 * at all under `prefers-reduced-motion` (dialog.md, «Kjente begrensninger»). Closing it any other way — Escape, the
 * close button — is «Avbryt», the safe choice («Å lukke uten å velge skal
 * utløse det tryggeste alternativet»).
 *
 * Rendered permanently, with `open` following the thread, so the element is
 * there to animate and to take focus the moment one is asked about.
 */
export function DeleteThreadDialog({ thread, onConfirm, onCancel }: DeleteThreadDialogProps) {
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const asking = thread !== undefined;

  // After Designsystemet's own effect has opened the dialog, which is a child
  // and runs first; opening moves focus to the close button, and this moves
  // it on to «Avbryt».
  useEffect(() => {
    if (asking) cancelRef.current?.focus();
  }, [asking]);

  return (
    <Dialog
      open={asking}
      onClose={onCancel}
      closedby="closerequest"
      closeButton="Lukk"
      aria-labelledby={headingId}
      data-size="sm"
    >
      <Dialog.Block>
        <Heading level={2} data-size="xs" id={headingId}>
          Slette tråden?
        </Heading>
        <Paragraph>
          «{thread?.title}» blir borte for godt, med alle spørsmålene og svarene i den. Det kan ikke
          angres.
        </Paragraph>
      </Dialog.Block>
      <Dialog.Block className="threads-view__dialog-actions">
        <Button data-color="danger" onClick={() => thread && onConfirm(thread)}>
          Slett tråden
        </Button>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          Avbryt
        </Button>
      </Dialog.Block>
    </Dialog>
  );
}
