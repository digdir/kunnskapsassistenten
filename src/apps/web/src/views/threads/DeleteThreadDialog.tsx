import { Button, Dialog, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef } from 'react';
import type { Thread } from '../../model';

export type DeleteThreadDialogProps = {
  /** The thread to confirm, or undefined while nothing is asked. */
  thread: Thread | undefined;
  onConfirm: (thread: Thread) => void;
  onCancel: () => void;
};

/** «Slette tråden?»; always rendered, so it can animate and take focus at once. */
export function DeleteThreadDialog({ thread, onConfirm, onCancel }: DeleteThreadDialogProps) {
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const asking = thread !== undefined;

  // Not `autoFocus`: Designsystemet honours it only after the opening animation,
  // so never under `prefers-reduced-motion`. Runs after the dialog's own effect
  // has focused the close button.
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
