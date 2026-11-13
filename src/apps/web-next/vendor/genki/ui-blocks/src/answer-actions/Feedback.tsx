import {
  Button,
  Chip,
  Field,
  Fieldset,
  Label,
  Paragraph,
  Textarea,
} from '@digdir/designsystemet-react';
import { ThumbDownIcon, ThumbUpIcon } from '@navikt/aksel-icons';
import { useEffect, useId, useRef, useState } from 'react';
import { translator, useT } from './i18n.js';
import type { AnswerFeedback, AnswerFeedbackStatus, AnswerRating } from './types.js';

const reasonKeys = [
  'answerActions.reasonWrong',
  'answerActions.reasonNoSource',
  'answerActions.reasonOutdated',
  'answerActions.reasonHard',
] as const;

// The reasons are sent in bokmål, whatever language the person reads, as the workspace stores them.
const stored = translator('nb');

/** The longest comment, as in the workspace. */
export const FEEDBACK_MAX_LENGTH = 300;

interface FeedbackProps {
  status: AnswerFeedbackStatus | undefined;
  onSend: (feedback: AnswerFeedback) => void;
}

/**
 * «Var svaret nyttig?», generalised from genki's workspace. A click on a thumb sends the rating at
 * once; the reasons and the comment are optional and come after, sent with the rating again. The
 * platform keeps the latest feedback on a run, so each send replaces the one before.
 */
export const Feedback = ({ status, onSend }: FeedbackProps) => {
  const t = useT();
  const [rating, setRating] = useState<AnswerRating>();
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  // The details last sent, which a new rating is sent with, as the platform takes the whole.
  const [details, setDetails] = useState<{ reasons: string[]; comment: string }>({
    reasons: [],
    comment: '',
  });
  // Whether the last send had the details, which decides what the status line says.
  const [withDetails, setWithDetails] = useState(false);
  const [open, setOpen] = useState(false);
  // Sent, and the app has not said how it went since: the status is about an earlier send.
  const [awaiting, setAwaiting] = useState(false);
  useEffect(() => setAwaiting(false), [status]);
  const result = awaiting ? undefined : status;
  const commentId = useId();
  const counterId = useId();
  const busy = status === 'sending';
  const form = useRef<HTMLDivElement>(null);
  const thumbs = useRef<Partial<Record<AnswerRating, HTMLButtonElement | null>>>({});
  const opened = useRef(false);

  const send = (feedback: AnswerFeedback, full: boolean) => {
    setWithDetails(full);
    setAwaiting(true);
    onSend(feedback);
  };

  // The same thumb again only sends again when the last send failed; the other one changes it.
  const choose = (value: AnswerRating) => {
    if (busy || (value === rating && result !== 'failed')) return;
    opened.current = !open;
    setRating(value);
    setOpen(true);
    send(
      {
        rating: value,
        reasons: value === 'down' ? details.reasons : [],
        comment: details.comment,
      },
      false,
    );
  };

  // The form opens under the answer, often at the foot of the column, where a docked question
  // field can hide its buttons. Brought into sight once, when the reader opens it; the field's
  // scroll margin keeps it clear of the field.
  useEffect(() => {
    if (!opened.current) return;
    opened.current = false;
    form.current?.scrollIntoView?.({ block: 'nearest' });
  }, [rating]);

  // Closing the form takes away the button that had focus, so focus goes to the chosen thumb.
  const close = () => {
    if (form.current?.contains(document.activeElement) && rating) thumbs.current[rating]?.focus();
    setOpen(false);
  };

  // The form closes once the details are sent. The effect runs on the render that saw them sent.
  const detailsSent = result === 'sent' && withDetails;
  useEffect(() => {
    if (detailsSent) close();
  }, [detailsSent]);

  const submit = () => {
    if (!rating || busy) return;
    const reasons = rating === 'down' ? picked : [];
    setDetails({ reasons, comment });
    send({ rating, reasons, comment }, true);
  };

  const message =
    result === 'sent'
      ? withDetails
        ? t('answerActions.thanksDetails')
        : t('answerActions.thanks')
      : result === 'failed'
        ? t('answerActions.notSent')
        : '';

  const thumb = (value: AnswerRating) => (
    <Button
      variant={rating === value ? 'primary' : 'secondary'}
      data-size="sm"
      aria-pressed={rating === value}
      ref={(button) => {
        thumbs.current[value] = button;
      }}
      onClick={() => choose(value)}
    >
      {value === 'up' ? <ThumbUpIcon aria-hidden /> : <ThumbDownIcon aria-hidden />}
      {value === 'up' ? t('answerActions.yes') : t('answerActions.no')}
    </Button>
  );

  return (
    <div
      role="group"
      aria-label={t('answerActions.feedback')}
      className="uib-answer-actions-feedback"
    >
      <div className="uib-answer-actions-feedback-row">
        <span className="uib-answer-actions-question">{t('answerActions.useful')}</span>
        {thumb('up')}
        {thumb('down')}
      </div>
      {rating && open ? (
        <div className="uib-answer-actions-form" ref={form}>
          {rating === 'down' ? (
            <Fieldset data-size="sm">
              <Fieldset.Legend>{t('answerActions.whatWrong')}</Fieldset.Legend>
              <div className="uib-answer-actions-reasons">
                {reasonKeys.map((key) => {
                  const reason = stored(key);
                  return (
                    <Chip.Checkbox
                      key={key}
                      data-size="sm"
                      checked={picked.includes(reason)}
                      onChange={() =>
                        setPicked((list) =>
                          list.includes(reason)
                            ? list.filter((r) => r !== reason)
                            : [...list, reason],
                        )
                      }
                    >
                      {t(key)}
                    </Chip.Checkbox>
                  );
                })}
              </div>
            </Fieldset>
          ) : null}
          <Field data-size="sm">
            <Label htmlFor={commentId}>{t('answerActions.comment')}</Label>
            <Textarea
              id={commentId}
              className="uib-answer-actions-comment"
              rows={2}
              maxLength={FEEDBACK_MAX_LENGTH}
              value={comment}
              aria-describedby={counterId}
              onChange={(event) => setComment(event.target.value)}
            />
            <span id={counterId} className="uib-answer-actions-counter">
              {t('answerActions.counter', { length: comment.length, max: FEEDBACK_MAX_LENGTH })}
            </span>
          </Field>
          <div className="uib-answer-actions-form-actions">
            <Button data-size="sm" loading={busy && withDetails} onClick={submit}>
              {t('answerActions.send')}
            </Button>
            <Button variant="tertiary" data-size="sm" onClick={close}>
              {t('answerActions.skip')}
            </Button>
          </div>
        </div>
      ) : null}
      {/* Always drawn, so what it says is announced when it changes. */}
      <Paragraph role="status" data-size="sm" className="uib-answer-actions-status">
        {message}
      </Paragraph>
    </div>
  );
};
