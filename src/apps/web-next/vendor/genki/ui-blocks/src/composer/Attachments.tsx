import { Button, Chip, Spinner } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n.js';
import type { ComposerAttachment, ComposerAttachmentError, ComposerAttachments } from './types.js';

export const useAttachmentText = (attachments: ComposerAttachments | undefined) => {
  const t = useT();
  const f = useFormat();
  const named = attachments?.types ?? attachments?.fileTypes;
  const types = named?.length ? f.list(named, 'disjunction') : undefined;
  // Megabytes of 1024 × 1024 bytes, to one decimal.
  const max =
    attachments?.maxBytes !== undefined
      ? Math.round((attachments.maxBytes * 10) / 1024 / 1024) / 10
      : attachments?.maxMegabytes;
  const error = (code: ComposerAttachmentError) => {
    if (code === 'too-large')
      return max === undefined ? t('composer.tooLargeUnknown') : t('composer.tooLarge', { max });
    if (code === 'wrong-type')
      return types ? t('composer.wrongType', { types }) : t('composer.wrongTypeUnknown');
    return t(code === 'failed' ? 'composer.failed' : 'composer.unavailable');
  };
  return {
    attach: types ? t('composer.attachTypes', { types }) : t('composer.attach'),
    error,
  };
};

/** Three moments per file, never one per percent, and each said once. */
export const useUploadAnnouncement = (
  items: readonly ComposerAttachment[],
  error: (code: ComposerAttachmentError) => string,
) => {
  const t = useT();
  const [announcement, setAnnouncement] = useState('');
  const said = useRef(new Map<string, string>());
  useEffect(() => {
    for (const item of items) {
      const now =
        item.status === 'uploading'
          ? t('composer.uploading', { name: item.name })
          : item.status === 'ready'
            ? t('composer.uploaded', { name: item.name })
            : item.error
              ? t('composer.notAttached', { name: item.name, reason: error(item.error) })
              : '';
      if (now && said.current.get(item.id) !== now) {
        said.current.set(item.id, now);
        setAnnouncement(now);
      }
    }
    const live = new Set(items.map((item) => item.id));
    for (const id of [...said.current.keys()]) if (!live.has(id)) said.current.delete(id);
  }, [items]);
  return announcement;
};

export const AttachmentList = ({
  items,
  error,
  onRemove,
  onRetry,
}: {
  items: readonly ComposerAttachment[];
  error: (code: ComposerAttachmentError) => string;
  onRemove: (id: string) => void;
  onRetry: ((id: string) => void) | undefined;
}) => {
  const t = useT();
  const f = useFormat();
  if (items.length === 0) return null;
  return (
    <ul aria-label={t('composer.attachments')} className="uib-composer-attachments">
      {items.map((item) => (
        <li className="uib-composer-attachment" key={item.id}>
          <Chip.Removable
            data-color={item.status === 'failed' ? 'danger' : 'neutral'}
            data-wrap="wrap"
            aria-label={t('composer.remove', { name: item.name })}
            onClick={() => onRemove(item.id)}
          >
            {item.status === 'uploading' ? <Spinner aria-hidden="true" data-size="xs" /> : null}
            {item.name}
            {item.status === 'uploading' ? ` ${f.percent((item.progress ?? 0) / 100)}` : null}
          </Chip.Removable>
          {item.status === 'failed' && item.error ? (
            <span className="uib-composer-attachment-error">{error(item.error)}</span>
          ) : null}
          {item.status === 'failed' && item.error === 'failed' && onRetry ? (
            <Button
              aria-label={t('composer.retryLabel', { name: item.name })}
              // Pinned to neutral, as kunnskapsassistenten draws it: beside a file, not the action.
              data-color="neutral"
              data-size="sm"
              onClick={() => onRetry(item.id)}
              variant="tertiary"
            >
              {t('composer.retry')}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
};
