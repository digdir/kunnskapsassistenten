import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { ArrowDownIcon, PaperclipIcon, PaperplaneIcon, StopIcon } from '@navikt/aksel-icons';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { classes, hasFiles } from '../dom.js';
import { AttachmentList, useAttachmentText, useUploadAnnouncement } from './Attachments.js';
import { useT } from './i18n.js';
import { shortcutModifier, useComposerShortcut } from './shortcut.js';
import type { ComposerAttachments } from './types.js';

export type * from './types.js';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Sends a question, the field's or a follow-up's: trimmed, and never empty. */
  onSubmit: (question: string) => void;
  /** True while the assistant answers. Nothing is sent meanwhile. */
  working?: boolean | undefined;
  /** Makes the send button «Avbryt» while the assistant answers. */
  onCancel?: (() => void) | undefined;
  placeholder?: string | undefined;
  /** What the assistant is called, in the field's name and the disclaimer. */
  assistantName?: string | undefined;
  showDisclaimer?: boolean | undefined;
  /** Questions under the field that are sent as they are. */
  followUps?: readonly string[] | undefined;
  attachments?: ComposerAttachments | undefined;
  /** Draws «Bla til bunnen» over the field. Leave it out when the conversation is at its end. */
  onScrollToBottom?: (() => void) | undefined;
  /** The host's controls beside the send button, such as the variant picker. */
  actions?: ReactNode;
  /** A line right under the field, docked with it, such as what the next question reads from. */
  note?: ReactNode;
  /** Ctrl+/ or Cmd+/ anywhere on the page puts the caret in the field. On unless switched off. */
  shortcut?: boolean | undefined;
  /**
   * Stays at the foot of a scrolling conversation, with a fade over it. Its height is then kept
   * clear at the foot of what the browser scrolls to in the same column, so the field never
   * hides the focus (WCAG 2.4.11).
   */
  sticky?: boolean | undefined;
  /**
   * Designsystemet's `data-color` for the block. Neutral unless given, as a field is in
   * Designsystemet and in kunnskapsassistenten.
   */
  color?: string | undefined;
  /** The same for the send button and the follow-ups, which stand out from the block: accent. */
  actionColor?: string | undefined;
  fieldRef?: RefObject<HTMLTextAreaElement | null> | undefined;
  sendRef?: RefObject<HTMLButtonElement | null> | undefined;
  ref?: Ref<HTMLDivElement> | undefined;
  className?: string | undefined;
}

type Refusal = 'wait' | 'unavailable';

/** The disclaimer under the field, for a host that draws it elsewhere, such as at the foot of a start page. */
export const ComposerDisclaimer = ({
  assistantName,
  color = 'neutral',
  className,
}: {
  assistantName?: string | undefined;
  color?: string | undefined;
  className?: string | undefined;
}) => {
  const t = useT();
  return (
    <Paragraph
      className={classes('uib-composer-disclaimer', className)}
      data-color={color}
      data-size="sm"
    >
      {assistantName
        ? t('composer.disclaimer', { name: assistantName })
        : t('composer.disclaimerUnnamed')}
    </Paragraph>
  );
};

/**
 * The question field, its buttons and what stands around it. The field and the buttons are one
 * control to a reader, so the frame carries the border and the focus ring.
 */
export const Composer = ({
  value,
  onChange,
  onSubmit,
  working = false,
  onCancel,
  placeholder,
  assistantName,
  showDisclaimer = true,
  followUps,
  attachments,
  onScrollToBottom,
  actions,
  note,
  shortcut = true,
  sticky = false,
  color = 'neutral',
  actionColor = 'accent',
  fieldRef,
  sendRef,
  ref,
  className,
}: ComposerProps) => {
  const t = useT();
  const ownField = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? ownField;
  const picker = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [dragDepth, setDragDepth] = useState(0);
  const [refusal, setRefusal] = useState<Refusal>();
  const text = useAttachmentText(attachments);
  const items = attachments?.items ?? [];
  const announcement = useUploadAnnouncement(items, text.error);
  const uploading = items.some((item) => item.status === 'uploading');
  const unavailable = attachments !== undefined && attachments.onAdd === undefined;
  useComposerShortcut(field, shortcut);

  const own = useRef<HTMLDivElement | null>(null);
  const setRoot = (node: HTMLDivElement | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  // Docked, the block puts its height on the column it docks in, where composer.css keeps that
  // much clear under whatever the browser scrolls to (WCAG 2.4.11). Measured, as
  // kunnskapsassistenten's ChatView does: no token knows the field's height. jsdom has no
  // ResizeObserver, and a page without one only loses the margin.
  useEffect(() => {
    const node = own.current;
    const column = node?.parentElement;
    if (!sticky || !node || !column || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      column.style.setProperty('--uib-composer-block-size', `${Math.round(node.offsetHeight)}px`);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      column.style.removeProperty('--uib-composer-block-size');
    };
  }, [sticky]);

  const focusField = () => field.current?.focus();

  // «Avbryt» turns back into a send button that is disabled until the next question, and the
  // focus on it falls to the page. The field takes it instead, where the next question is written.
  // Only focus that was on «Avbryt»: a reader who moved on is left where they are.
  const cancelHeldFocus = useRef(false);
  useEffect(() => {
    if (working || !cancelHeldFocus.current) return;
    cancelHeldFocus.current = false;
    const active = document.activeElement;
    const send = own.current?.querySelector('.uib-composer-send');
    if (active === null || active === document.body || active === send) field.current?.focus();
  }, [working, field]);

  const trySubmit = (question: string) => {
    if (working) return;
    if (uploading) {
      setRefusal('wait');
      focusField();
      return;
    }
    setRefusal(undefined);
    const trimmed = question.trim();
    if (trimmed) onSubmit(trimmed);
  };

  const sendBlocked = value.trim().length === 0 || working;

  const shownRefusal =
    refusal === 'unavailable'
      ? text.error('unavailable')
      : refusal === 'wait' && uploading
        ? t('composer.waitForUploads')
        : '';

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    trySubmit(value);
  };

  const drop = attachments
    ? {
        onDragEnter: (event: DragEvent<HTMLDivElement>) => {
          if (hasFiles(event)) setDragDepth((depth) => depth + 1);
        },
        onDragLeave: () => setDragDepth((depth) => Math.max(0, depth - 1)),
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          if (hasFiles(event)) event.preventDefault();
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          setDragDepth(0);
          if (!hasFiles(event)) return;
          event.preventDefault();
          if (!attachments.onAdd) {
            setRefusal('unavailable');
            return;
          }
          setRefusal(undefined);
          attachments.onAdd([...event.dataTransfer.files]);
        },
      }
    : {};

  return (
    <div
      className={classes('uib-composer', className)}
      data-sticky={sticky || undefined}
      data-color={color}
      ref={setRoot}
    >
      {onScrollToBottom ? (
        <Button
          className="uib-composer-scroll"
          // Pinned to neutral, as kunnskapsassistenten draws it: it floats over any answer.
          data-color="neutral"
          data-size="sm"
          variant="secondary"
          onClick={(event) => {
            onScrollToBottom();
            if (event.detail === 0) field.current?.focus({ preventScroll: true });
          }}
        >
          <ArrowDownIcon aria-hidden />
          {t('composer.scrollToBottom')}
        </Button>
      ) : null}

      {attachments ? (
        <AttachmentList
          items={items}
          error={text.error}
          onRemove={(id) => {
            attachments.onRemove(id);
            focusField();
          }}
          onRetry={
            attachments.onRetry
              ? (id) => {
                  attachments.onRetry?.(id);
                  focusField();
                }
              : undefined
          }
        />
      ) : null}

      <div className="uib-composer-frame" data-dragging={dragDepth > 0 || undefined} {...drop}>
        <Textfield
          aria-describedby={shortcut ? descriptionId : undefined}
          aria-label={
            assistantName
              ? t('composer.field', { name: assistantName })
              : t('composer.fieldUnnamed')
          }
          className="uib-composer-field"
          multiline
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t('composer.placeholder')}
          ref={field}
          rows={1}
          title={shortcut ? t('composer.shortcutHint', { key: shortcutModifier() }) : undefined}
          value={value}
        />
        <div className="uib-composer-controls">
          {unavailable ? (
            <Button
              aria-disabled="true"
              aria-label={t('composer.attachSoonLabel')}
              className="uib-composer-attach"
              // Pinned to neutral, as kunnskapsassistenten draws it: a tool, not the action.
              data-color="neutral"
              variant="tertiary"
            >
              <PaperclipIcon aria-hidden />
              <span className="uib-composer-attach-text">{t('composer.attachSoon')}</span>
            </Button>
          ) : attachments?.onAdd ? (
            <>
              <input
                accept={attachments.accept}
                className="uib-composer-file-input"
                multiple
                onChange={(event) => {
                  const picked = event.currentTarget.files;
                  if (picked?.length) {
                    setRefusal(undefined);
                    attachments.onAdd?.([...picked]);
                  }
                  event.currentTarget.value = '';
                }}
                ref={picker}
                tabIndex={-1}
                type="file"
              />
              <Button
                aria-label={text.attach}
                className="uib-composer-attach"
                // Pinned to neutral, as kunnskapsassistenten draws it: a tool, not the action.
                data-color="neutral"
                icon
                onClick={() => picker.current?.click()}
                variant="tertiary"
              >
                <PaperclipIcon aria-hidden />
              </Button>
            </>
          ) : null}
          {actions ? <div className="uib-composer-actions">{actions}</div> : null}
          {working && onCancel ? (
            <Button
              aria-busy="true"
              aria-label={t('composer.cancelLabel')}
              className="uib-composer-send"
              data-color={actionColor}
              onBlur={(event) => {
                // Focus moved to something the reader chose. Disabled or gone, it moves to nothing.
                if (event.relatedTarget) cancelHeldFocus.current = false;
              }}
              onClick={() => {
                onCancel();
                focusField();
              }}
              onFocus={() => {
                cancelHeldFocus.current = true;
              }}
              ref={sendRef}
              variant="secondary"
            >
              <StopIcon aria-hidden />
              {t('composer.cancel')}
            </Button>
          ) : (
            <Button
              aria-label={t('composer.send')}
              className="uib-composer-send"
              data-color={actionColor}
              // Blocked, not disabled: it stays in the tab order, as genki's screens keep it.
              aria-disabled={sendBlocked || undefined}
              icon
              onClick={() => {
                if (!sendBlocked) trySubmit(value);
              }}
              ref={sendRef}
            >
              <PaperplaneIcon aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {note ? <div className="uib-composer-note">{note}</div> : null}

      {dragDepth > 0 && !unavailable ? (
        <p aria-hidden="true" className="uib-composer-drop-hint">
          {t('composer.dropHint')}
        </p>
      ) : null}

      {/* Always in the page, only its text changes: a live region mounted with its text is
          usually not announced, and the reader would not hear why nothing was sent. */}
      <output className="uib-composer-refusal">{shownRefusal}</output>

      {followUps?.length ? (
        <ul className="uib-composer-follow-ups">
          {followUps.map((question) => (
            <li key={question}>
              <Chip.Button
                data-color={actionColor}
                data-wrap="wrap"
                onClick={() => trySubmit(question)}
              >
                {question}
              </Chip.Button>
            </li>
          ))}
        </ul>
      ) : null}

      {showDisclaimer ? <ComposerDisclaimer assistantName={assistantName} color={color} /> : null}

      {shortcut ? (
        <p className="ds-sr-only" id={descriptionId}>
          {t('composer.shortcutDescription')}
        </p>
      ) : null}
      {attachments ? (
        <p aria-live="polite" className="ds-sr-only">
          {announcement}
        </p>
      ) : null}
    </div>
  );
};
