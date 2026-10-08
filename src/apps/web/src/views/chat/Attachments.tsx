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

/**
 * The files attached to the question being written, over the compose field.
 *
 * A chip per file, as the brief asks, and the chip is `Chip.Removable`: its
 * whole job is to be taken off again, which is what that variant is for. The
 * removable chip is a button, so the file name is inside a control and the
 * accessible name says what pressing it does — «Fjern vedlegget rapport.pdf»,
 * not «rapport.pdf», which would be a button named after a noun.
 *
 * A failed file keeps its chip. A file that silently did not attach is worse
 * than one that says why: the reader asked for it to go along, and the answer
 * is no plus a reason. Where trying again could work, «Prøv igjen» sits
 * beside it — on the general failure only, because a file that is too big is
 * the same size next time (see `uploadRetryable`).
 *
 * Progress is announced rather than only drawn. The bar is a `Spinner` and a
 * percentage in the chip for anyone looking; the polite region under the list
 * is how a screen reader hears that anything is happening at all, and it
 * speaks on whole percent changes rather than on every frame.
 */
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

            {/*
              The reason, outside the chip. Inside it would join the button's
              accessible name, and «Fjern vedlegget rapport.pdf Filen er
              større enn 20 MB» is a name nobody can ask for by voice.
            */}
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

/**
 * What the polite region should say at this moment.
 *
 * Three moments per file and no more: it started, it is ready, it failed.
 *
 * It used to speak on every whole percent, which is eighteen sentences for
 * one 1,5-second upload — a region still reading «12 %» while the file has
 * been ready for a second. Worse, the last of them was «0 %»: between the
 * store swapping the pending row for the finished document and this slot
 * learning about it, there is a render with no row to read a number from, and
 * the fallback nought was announced as though the upload had started over
 * (KA CC on #125). Saying less is not a workaround for that render — a
 * percentage nobody can act on was never worth a sentence — but it does take
 * the wrong number out of the reader's ear. Same as #2 landed in #124.
 *
 * Held as state and written from an effect rather than computed during
 * render, because a live region announces a CHANGE: the same sentence
 * recomputed is silence.
 */
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
