import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
import {
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
import {
  ATTACH_LABEL,
  ATTACH_UNAVAILABLE_LABEL,
  DROP_HINT,
  WAIT_FOR_UPLOADS,
  uploadErrorText,
} from './attachmentText';
import type { Attachments as AttachmentsState } from './useAttachments';
import type { ChatStatus } from './useChat';

type ComposerProps = {
  /**
   * The sticky area around the field. The chat view measures it, to keep that
   * much of the conversation clear of it, and asks it where focus is before
   * moving the caret into the field.
   */
  ref?: Ref<HTMLDivElement>;
  /**
   * What stands over the area, above the field, and moves with it:
   * «Bla til nederst». First in the tab order of the area, before the field.
   */
  above?: ReactNode;
  /** So a kickstarter can put the caret in the field after filling it. */
  fieldRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  /** Defaults to the everyday one. A clarification asks for an answer to it. */
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /**
   * The send button, which is the stop button while an answer is on its way.
   *
   * One ref for both, because it is one element to the browser: React keeps
   * the same `<button>` and swaps its label and handler, which is why focus
   * survives the change. The chat view needs to recognise it by identity when
   * a failure takes it out from under the reader — see `ChatView`.
   */
  sendRef?: RefObject<HTMLButtonElement | null>;
  status: ChatStatus;
  /** Show the fixed follow-up suggestions under the field (answer 29). */
  showFollowUps?: boolean;
  /** A follow-up fills the field and sends it (answer 28). */
  onFollowUp: (question: string) => void;
  /** The files this question is being written with. */
  attachments: AttachmentsState;
};

/**
 * The compose field.
 *
 * The field grows with the text, scrolls once it reaches the limit, and wraps
 * its lines (answer 54). That is `field-sizing: content` plus a `max-height`
 * in chat.css — one line of CSS instead of a ResizeObserver that is always
 * one frame behind.
 *
 * Enter sends and Shift+Enter makes a new line. Designsystemet has nothing
 * for this, so it is written here. `isComposing` is checked because an input
 * method editor uses Enter to accept a candidate, and sending the question
 * mid-word would be a real bug for anyone typing that way.
 *
 * The field and the two buttons are one control to a reader, so the frame
 * around them carries the border and the focus ring, and the textarea inside
 * gives up its own. The ring is Designsystemet's, not a hand-drawn one.
 *
 * The icons carry no size of their own. `Button` already sizes what it holds
 * (`--ds-icon-size`), and a size written here would be a raw length that does
 * not follow the size mode.
 *
 * The stop button carries the word «Avbryt» next to its icon. A bare square
 * is not obviously «stopp» to anyone looking at the screen, however good its
 * `aria-label` is (brukerblikk 2026-09-15, finding 10). The label stays
 * longer than the visible text — it says which generation is being stopped —
 * and starts with the same word, which is what WCAG 2.5.3 asks for.
 *
 * The field carries the page's skip-link target and says, twice, how to reach
 * it with the keyboard: a small hint for anyone looking at it, and a
 * description on the field itself for anyone who is not. Two texts rather than
 * one because they are read in different ways — see text.ts.
 *
 * Attachments are in scope (answer 53) but there is no upload endpoint
 * (API-bestilling A3), so the paperclip is inert. It keeps its focus and says
 * «Vedlegg kommer» rather than disappearing, because a control that is coming
 * is worth knowing about — and `aria-disabled` keeps it reachable for a
 * keyboard user, which `disabled` would not.
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
}: ComposerProps) {
  const busy = status === 'pending' || status === 'streaming';
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Nesting counter, not a boolean: dragging over a child fires `dragleave`
  // on the parent, so a boolean flickers the hint off every time the pointer
  // crosses the field or a chip.
  const [dragDepth, setDragDepth] = useState(0);
  /*
   * What to say when attaching cannot work here at all. Its own line rather
   * than a chip: a chip stands for a file the reader picked, and in this case
   * no file was ever taken. It stays until the reader picks something that
   * does work, because a sentence that vanished on the next render would be
   * one nobody had time to read.
   */
  const [refusal, setRefusal] = useState('');
  const { unavailable } = attachments;
  // Generated, not a constant: two chat views in two slots would otherwise
  // share one id and the description would describe the wrong field.
  const descriptionId = useId();

  /**
   * The one way a question leaves this field.
   *
   * Every way of sending goes through here — Enter, the send button, a
   * follow-up chip — because the rule about attachments is about SENDING and
   * not about one control. It was on the send button's `disabled` alone, and
   * Enter walked straight past it: the question went, the file that was still
   * uploading did not, and nothing said so (KA CC on #125). That is the
   * silent drop the rule exists to prevent, arriving through the door the
   * rule was not on.
   *
   * It refuses rather than queues, and **nothing is sent when the upload
   * finishes**: the reader presses again. Queueing would send a question
   * seconds after the reader stopped watching, with no way to call it back,
   * and a question that leaves on its own is a question nobody chose to send
   * at that moment. The wait is a second or two with the bar in plain sight,
   * and the message goes as soon as the waiting does (see below).
   */
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

  /*
   * The wait message goes when there is nothing left to wait for.
   *
   * A refusal outlives its reason if nobody takes it away: it stood in the
   * live region six seconds after the upload had finished, telling a reader
   * to wait for a file that was ready (KA CC on #125, runde 2).
   *
   * Worked out while rendering rather than cleared in an effect. The message
   * is not a fact of its own — it is «is anything still uploading» read
   * aloud — so it follows that state in the same paint, and there is no
   * render where the page says wait and the bar is gone.
   *
   * Only that one. The `unavailable` sentence is not waiting for anything:
   * it is true for as long as the service has no endpoint, so it stays until
   * something the reader does replaces it.
   */
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

      {/*
        Both handlers put focus back in the field, because both take the
        control the reader is standing on out of the page: removing a chip
        unmounts its button, and retrying one takes «Prøv igjen» away the
        moment the file goes back to uploading. A control that vanishes
        without saying where focus should land drops a keyboard user on
        `<body>`, at the top of the document (WCAG 2.4.3). The field is where
        they were heading anyway.
      */}
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

      {/*
        Dropping a file on the field attaches it. The button is the way —
        WCAG 2.5.7 asks that nothing depend on dragging — and this is the
        shortcut for anyone who already has the file under the pointer.

        The handlers sit on the frame and not on the textarea, so the whole
        white box takes a file rather than the 20 px of text inside it.
      */}
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
          /* The shortcut for anyone using a pointer. It used to be a line of
             grey text under the field; the footer is one line now, and the
             hint belongs on the thing it acts on. Screen readers get the
             spelled-out version through `aria-describedby`. */
          title={shortcutHint()}
          value={value}
        />

        {/*
          The two controls on a row of their own, under the field.

          They sat beside it, and the box had grown tall enough that the
          placeholder stood indented at the top with a button pinned low on
          either side (Simens issue 79). On a row of their own the field
          takes the full width of the box, and the reader's text starts
          where the paperclip starts and ends where the send button ends.
        */}
        <div className="ka-composer__controls">
          {/*
            The picker, hidden but real: a styled `<label>` around a file input
            is the other way to do this, and it loses the button semantics the
            row needs — this control shares a row with the send button and has
            to behave like the other one, not like a label.

            `multiple`, because a reader with three documents on the same
            question should not have to pick them one at a time.
          */}
          <input
            accept={UPLOAD_ACCEPT}
            /*
             * `display: none` and not `ds-sr-only`: the input is the mechanism,
             * the button is the control. Screen-reader-only keeps it in the
             * accessibility tree, where it is a second, nameless file control
             * beside the named one — axe called it, and it was right.
             * A hidden input still opens the picker when clicked.
             */
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

          {/*
            Where there is nothing to upload to, the reason is in the button's
            own name — known before a file is picked rather than after one is
            refused. `aria-disabled` and not `disabled`, so the control stays
            reachable and can still say what it says; a control that is coming
            is worth knowing about.

            And it says it out loud there: the sentence is ON the button, the
            way Simen drew it, so the row reads «paperclip, coming soon» at a
            glance instead of hiding that behind a hover. No `aria-label` in
            that state, so the accessible name is the sentence on screen
            (WCAG 2.5.3). Where uploading does work, the paperclip is a
            paperclip again and the name is the label.

            The sentence is in a span of its own so a narrow column can take
            it off the screen without taking it out of the name — it is 37
            characters and wraps onto four lines on a phone, which is 83 px of
            the sticky bottom to say something once (KA CC on #195). Hidden
            that way it is still the button's accessible name, and WCAG 2.5.3
            asks nothing of a control with no visible label.

            In the accent colour while it is coming, the way Simen draws it in
            issue 79: pale blue, like the send button beside it before there
            is anything to send. That is Designsystemet's own disabled
            tertiary button, lightened less than it lightens it — see
            chat.css for why. A working paperclip stays neutral.
          */}
          <Button
            aria-disabled={unavailable ? 'true' : undefined}
            aria-label={unavailable ? undefined : ATTACH_LABEL}
            className="ka-composer__attach"
            data-color={unavailable ? 'accent' : 'neutral'}
            icon={!unavailable}
            onClick={() => {
              if (unavailable) {
                setRefusal(uploadErrorText(unavailable));
                return;
              }
              fileInputRef.current?.click();
            }}
            variant="tertiary"
          >
            <PaperclipIcon aria-hidden />
            {unavailable ? (
              <span className="ka-composer__attach-text">{ATTACH_UNAVAILABLE_LABEL}</span>
            ) : null}
          </Button>

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
              /*
               * Through `trySubmit`, like every other way of sending. The
               * button used to be `disabled` while a file was uploading, which
               * stopped the click and said nothing about why — and did not stop
               * Enter at all.
               */
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
              <Chip.Button onClick={() => trySubmit(() => onFollowUp(question))}>
                {question}
              </Chip.Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        One line, and only the disclaimer on it.
        «Kunnskapsassistenten kan gjøre feil» is what the design puts with the
        field in all four chatInput variants. The shortcut used to share the
        line and wrapped it onto two on both measured widths, which cost 24 px
        of the sticky bottom on every screen to say something a reader needs
        once (høydebudsjett 2026-09-21, H3).

        It is not gone: it is on the field as a tooltip, on the field as a
        description for screen readers, and in the skip link that does the
        same jump.

        Under the box, where Simen draws it in issue 79, which turns round
        the «above» from issue 89. Last in the sticky area rather than just
        under the frame, with the follow-up questions between the two, which
        is the order of issue-89a: the area is pinned to the bottom and grows
        upwards, so the last line is the one that never moves. Follow-ups
        come with every answer and attachments with every file, and a
        standing sentence that moved a row each time is one nobody would
        read twice.
      */}
      <Paragraph className="ka-composer__disclaimer" data-size="sm">
        {DISCLAIMER}
      </Paragraph>

      <p className="ds-sr-only" id={descriptionId}>
        {SHORTCUT_DESCRIPTION}
      </p>
    </div>
  );
}

/**
 * Whether what is being dragged is files at all.
 *
 * Dragging selected text across the page fires the same events, and a compose
 * field that lit up every time someone dragged a word would be lying about
 * what it was about to do.
 */
function hasFiles(event: DragEvent<HTMLDivElement>): boolean {
  return [...event.dataTransfer.types].includes('Files');
}
