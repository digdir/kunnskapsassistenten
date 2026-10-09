import { Button, Chip, Spinner } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState } from 'react';
import {
  ATTACHMENTS_LABEL,
  removeAttachmentLabel,
  retryAttachmentLabel,
  uploadErrorText,
  uploadFailedAnnouncement,
  uploadStartedAnnouncement,
  uploadReadyAnnouncement,
  uploadRetryable,
} from './attachmentText';
import type { AttachmentView } from './useAttachments';

type AttachmentsProps = {
  items: AttachmentView[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
};

/** The files attached to the question being written. A failed file keeps its
    chip, because one that silently did not attach is worse than one that says
    why, and progress is announced as well as drawn. */
export function Attachments({ items, onRemove, onRetry }: AttachmentsProps) {
  const announcement = useUploadAnnouncement(items);

  if (items.length === 0) return null;

  return (
    <>
      <ul aria-label={ATTACHMENTS_LABEL} className="ka-attachments">
        {items.map((item) => (
          <li className="ka-attachments__item" key={item.key}>
            <Chip.Removable
              data-color={item.status === 'failed' ? 'danger' : 'neutral'}
              data-wrap="wrap"
              aria-label={removeAttachmentLabel(item.name)}
              onClick={() => onRemove(item.key)}
            >
              {item.status === 'uploading' ? <Spinner aria-hidden="true" data-size="xs" /> : null}
              {item.name}
              {item.status === 'uploading' ? ` ${Math.round(item.progress)} %` : null}
            </Chip.Removable>

            {/* The reason, outside the chip: inside, it joins the button's
                accessible name, which nobody can then ask for by voice. */}
            {item.status === 'failed' && item.errorCode ? (
              <span className="ka-attachments__error">{uploadErrorText(item.errorCode)}</span>
            ) : null}

            {item.status === 'failed' && item.errorCode && uploadRetryable(item.errorCode) ? (
              <Button
                aria-label={retryAttachmentLabel(item.name)}
                data-color="neutral"
                data-size="sm"
                onClick={() => onRetry(item.key)}
                variant="tertiary"
              >
                Prøv igjen
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="ds-sr-only">
        {announcement}
      </p>
    </>
  );
}

// Three moments per file and no more, NOT one per percent. Held as state and
// written from an effect, because a live region announces a CHANGE and the
// same sentence recomputed is silence.
function useUploadAnnouncement(items: AttachmentView[]): string {
  const [announcement, setAnnouncement] = useState('');
  /** The last thing said about each file, so nothing is said twice. */
  const said = useRef(new Map<string, string>());

  useEffect(() => {
    for (const item of items) {
      const now =
        item.status === 'uploading'
          ? uploadStartedAnnouncement(item.name)
          : item.status === 'ready'
            ? uploadReadyAnnouncement(item.name)
            : item.errorCode
              ? uploadFailedAnnouncement(item.name, item.errorCode)
              : '';

      if (now && said.current.get(item.key) !== now) {
        said.current.set(item.key, now);
        setAnnouncement(now);
      }
    }

    // Forget the ones that are gone, so the same file attached twice is
    // announced twice.
    const live = new Set(items.map((item) => item.key));
    for (const key of [...said.current.keys()]) {
      if (!live.has(key)) said.current.delete(key);
    }
  }, [items]);

  return announcement;
}
