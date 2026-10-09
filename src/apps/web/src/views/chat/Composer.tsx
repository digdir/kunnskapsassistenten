import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
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
import { UPLOAD_ACCEPT } from '../../model';
import { provideDraft, restoreDraft } from '../../api/session';
import { COMPOSER_ID } from '../../layout/ids';
import { PaperclipIcon, PaperplaneIcon, StopIcon } from '@navikt/aksel-icons';
import {
  COMPOSE_PLACEHOLDER,
  DISCLAIMER,
  FOLLOW_UP_QUESTIONS,
  SHORTCUT_DESCRIPTION,
  shortcutHint,
} from './text';
import { Attachments } from './Attachments';
import { ATTACH_LABEL, DROP_HINT, WAIT_FOR_UPLOADS, uploadErrorText } from './attachmentText';
import type { Attachments as AttachmentsState } from './useAttachments';
import type { ChatStatus } from './useChat';

type ComposerProps = {
  /** The sticky area around the field. The chat view measures it and asks it
      where focus is before moving the caret into the field. */
  ref?: Ref<HTMLDivElement>;
  /** What stands over the area and moves with it: «Bla til nederst». First
      in the tab order, before the field. */
  above?: ReactNode;
  /** So a kickstarter can put the caret in the field after filling it. */
  fieldRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  /** Defaults to the everyday one. A clarification asks for an answer to it. */
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** The send button, which is the stop button mid-answer. One ref, because
      it is one `<button>` to the browser, and `ChatView` recognises it by
      identity when a failure takes it out from under the reader. */
  sendRef?: RefObject<HTMLButtonElement | null>;
  status: ChatStatus;
  /** Show the fixed follow-up suggestions under the field. */
  showFollowUps?: boolean;
  /** A follow-up fills the field and sends it. */
  onFollowUp: (question: string) => void;
  /** The files this question is being written with. */
  attachments: AttachmentsState;
  /** The agent choice, beside the send button. Absent where there is nothing
      to choose. */
  agentPicker?: ReactNode;
};

/**
 * The field and its buttons are one control to a reader, so the frame carries
 * the border and the ring. **`isComposing` is checked on Enter**: an input
 * method editor uses it to accept a candidate, and sending mid-word is a bug.
 * The stop button carries «Avbryt» beside its icon, because a bare square is
 * not obviously «stopp» and the name must contain the visible text (2.5.3).
 */
export function Composer({
  ref,
  above,
  sendRef,
  fieldRef,
  value,
  placeholder = COMPOSE_PLACEHOLDER,
  onChange,
  onSubmit,
  onCancel,
  status,
  showFollowUps,
  onFollowUp,
  attachments,
  agentPicker,
}: ComposerProps) {
  const busy = status === 'pending' || status === 'streaming';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // What the reader had written when the session ran out (api/session.ts).
  // The ref is because the 401 reads the value outside any render; the draft
  // comes back only into an empty field, and is never sent for the reader.
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);
  useEffect(() => provideDraft(() => latestValue.current), []);
  useEffect(
    () =>
      restoreDraft((kept) => {
        if (latestValue.current.trim() === '') onChange(kept);
      }),
    // `onChange` is the chat view's state setter and does not change. Were
    // it to, running again would find the draft already taken.
    [onChange],
  );
  // Nesting counter, not a boolean: dragging over a child fires `dragleave`
  // on the parent, so a boolean flickers the hint off every time the pointer
  // crosses the field or a chip.
  const [dragDepth, setDragDepth] = useState(0);
  // What to say when attaching cannot work at all. Its own line and not a
  // chip, which stands for a file the reader picked; it stays until the
  // reader does something, or nobody has time to read it.
  const [refusal, setRefusal] = useState('');
  const { unavailable } = attachments;
  // Generated, not a constant: two chat views in two slots would otherwise
  // share one id and the description would describe the wrong field.
  const descriptionId = useId();

  // Every way of sending comes through here — Enter, the send button, a
  // follow-up chip — because the attachment rule is about SENDING and not
  // about one control. It refuses rather than queues, and never sends later.
  function trySubmit(send: () => void) {
    if (busy) return;
    if (attachments.busy) {
      setRefusal(WAIT_FOR_UPLOADS);
      fieldRef?.current?.focus();
      return;
    }
    setRefusal('');
    send();
  }

  // The wait message goes when there is nothing left to wait for, worked out
  // while rendering: it is «is anything still uploading» read aloud. Only
  // that one; the `unavailable` sentence waits for nothing.
  const shownRefusal = refusal === WAIT_FOR_UPLOADS && !attachments.busy ? '' : refusal;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    trySubmit(onSubmit);
  }

  return (
    <div className="ka-composer-area" ref={ref}>
      {above}

      {/* Both handlers put focus back in the field, because both take the
          control the reader is standing on out of the page, and a vanishing
          control drops a keyboard user on `<body>` (WCAG 2.4.3). */}
      <Attachments
        items={attachments.items}
        onRemove={(key) => {
          attachments.remove(key);
          fieldRef?.current?.focus();
        }}
        onRetry={(key) => {
          attachments.retry(key);
          fieldRef?.current?.focus();
        }}
      />

      {/* Dropping a file attaches it, as a shortcut: the button is the way,
          because WCAG 2.5.7 asks that nothing depend on dragging. On the
          frame, so the whole box takes a file and not just the text. */}
      <div
        className="ka-composer"
        data-dragging={dragDepth > 0 || undefined}
        onDragEnter={(event: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(event)) return;
          setDragDepth((depth) => depth + 1);
        }}
        onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          // Without this the browser opens the file instead of handing it over.
          if (hasFiles(event)) event.preventDefault();
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          setDragDepth(0);
          if (!hasFiles(event)) return;
          event.preventDefault();
          if (unavailable) {
            setRefusal(uploadErrorText(unavailable));
            return;
          }
          setRefusal('');
          attachments.add(event.dataTransfer.files);
        }}
      >
        <Textfield
          aria-describedby={descriptionId}
          aria-label="Spørsmål til Kunnskapsassistenten"
          className="ka-composer__field"
          id={COMPOSER_ID}
          multiline
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          ref={fieldRef}
          rows={1}
          /* The shortcut for anyone using a pointer; the hint belongs on the
             thing it acts on. Screen readers get the spelled-out version
             through `aria-describedby`. */
          title={shortcutHint()}
          value={value}
        />

        {/* The two controls on a row of their own: beside the field in a box
            tall enough to write in, the placeholder stands indented with a
            button low on either side (issue 79). */}
        <div className="ka-composer__controls">
          {/* Nothing to upload to, nothing to upload with: the BFF has no
              route for it, so the paperclip is left out rather than drawn
              switched off. A dropped file is still refused honestly. */}
          {unavailable ? null : (
            <>
              {/* The picker, hidden but real. A styled `<label>` is the other
                  way and loses the button semantics the row needs, since this
                  control has to behave like the send button beside it. */}
              <input
                accept={UPLOAD_ACCEPT}
                /* `display: none` and not `ds-sr-only`, which leaves it in
                   the accessibility tree as a second, nameless file control.
                   A hidden input still opens the picker when clicked. */
                className="ka-composer__file-input"
                multiple
                onChange={(event) => {
                  const picked = event.currentTarget.files;
                  if (picked?.length) {
                    setRefusal('');
                    attachments.add(picked);
                  }
                  // Cleared so picking the SAME file again fires `change` at all.
                  event.currentTarget.value = '';
                }}
                ref={fileInputRef}
                tabIndex={-1}
                type="file"
              />

              <Button
                aria-label={ATTACH_LABEL}
                className="ka-composer__attach"
                data-color="neutral"
                icon
                onClick={() => fileInputRef.current?.click()}
                variant="tertiary"
              >
                <PaperclipIcon aria-hidden />
              </Button>
            </>
          )}

          {/* The agent, next to the send button and away from the paperclip.
              Pushed there by its own margin, so the row needs no wrapper. */}
          {agentPicker}

          {busy ? (
            <Button
              // The one control in the row while an answer is on its way, so
              // this is where «busy» belongs: the send button does not exist
              // during sending, it has become this one.
              aria-busy="true"
              aria-label="Avbryt genereringen"
              className="ka-composer__send"
              onClick={onCancel}
              ref={sendRef}
              variant="secondary"
            >
              <StopIcon aria-hidden />
              Avbryt
            </Button>
          ) : (
            <Button
              aria-label="Send spørsmålet"
              className="ka-composer__send"
              disabled={value.trim().length === 0}
              icon
              /* Through `trySubmit`, like every other way of sending:
                 `disabled` would stop the click, say nothing about why, and
                 not stop Enter at all. */
              onClick={() => trySubmit(onSubmit)}
              ref={sendRef}
            >
              <PaperplaneIcon aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {dragDepth > 0 ? (
        <p aria-hidden="true" className="ka-composer__drop-hint">
          {DROP_HINT}
        </p>
      ) : null}

      {shownRefusal ? <output className="ka-composer__refusal">{shownRefusal}</output> : null}

      {showFollowUps ? (
        <ul className="ka-follow-ups">
          {FOLLOW_UP_QUESTIONS.map((question) => (
            <li key={question}>
              <Chip.Button data-wrap="wrap" onClick={() => trySubmit(() => onFollowUp(question))}>
                {question}
              </Chip.Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* One line, and only the disclaimer on it: the shortcut sharing it
          wraps onto two at every width and is said three other ways. Last in
          the sticky area, which grows upwards, so this line never moves. */}
      <Paragraph className="ka-composer__disclaimer" data-size="sm">
        {DISCLAIMER}
      </Paragraph>

      <p className="ds-sr-only" id={descriptionId}>
        {SHORTCUT_DESCRIPTION}
      </p>
    </div>
  );
}

/** Whether what is being dragged is files at all: dragging selected text fires
   the same events, and a field that lit up for a dragged word would be lying
   about what it was about to do. */
function hasFiles(event: DragEvent<HTMLDivElement>): boolean {
  return [...event.dataTransfer.types].includes('Files');
}
