import { Button, Dialog, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef } from 'react';
import { useT } from './i18n.js';

export interface DeleteThreadDialogProps {
  /** The title of the thread to confirm, or undefined while nothing is asked. */
  title: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

/** «Slette tråden?»: always rendered, so it can animate and take focus at once. */
export const DeleteThreadDialog = ({ title, onConfirm, onCancel }: DeleteThreadDialogProps) => {
  const t = useT();
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const asking = title !== undefined;

  // Not autoFocus, which Designsystemet honours only after the opening animation.
  useEffect(() => {
    if (asking) cancelRef.current?.focus();
  }, [asking]);

  return (
    <Dialog
      open={asking}
      onClose={onCancel}
      closedby="closerequest"
      closeButton={t('threads.close')}
      aria-labelledby={headingId}
      data-size="sm"
    >
      <Dialog.Block>
        <Heading level={2} data-size="xs" id={headingId}>
          {t('threads.deleteQuestion')}
        </Heading>
        <Paragraph>{t('threads.deleteWarning', { title: title ?? '' })}</Paragraph>
      </Dialog.Block>
      <Dialog.Block className="uib-threads-actions">
        <Button data-color="danger" onClick={onConfirm}>
          {t('threads.deleteConfirm')}
        </Button>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {t('threads.cancel')}
        </Button>
      </Dialog.Block>
    </Dialog>
  );
};
