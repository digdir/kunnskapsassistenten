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

/** «Var svaret nyttig?», generalised from genki's workspace. */
export const Feedback = ({ status, onSend }: FeedbackProps) => {
  const t = useT();
  const [rating, setRating] = useState<AnswerRating>();
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [withDetails, setWithDetails] = useState(false);
  // A new rating after a failed send puts the failure behind the person, as in the workspace.
  const [changed, setChanged] = useState(false);
  const commentId = useId();
  const counterId = useId();
  const sent = status === 'sent';
  const busy = status === 'sending';
  const form = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  const choose = (value: AnswerRating) => {
    if (sent) return;
    opened.current = rating === undefined;
    setRating(value);
    setChanged(true);
  };

  // The form opens under the answer, often at the foot of the column, where a docked question
  // field can hide its buttons. Brought into sight once, when the reader opens it; the field's
  // scroll margin keeps it clear of the field.
  useEffect(() => {
    if (!opened.current) return;
    opened.current = false;
    form.current?.scrollIntoView?.({ block: 'nearest' });
  }, [rating]);

  const submit = (details: boolean) => {
    if (!rating || busy || sent) return;
    setWithDetails(details);
    setChanged(false);
    onSend({
      rating,
      reasons: details && rating === 'down' ? picked : [],
      comment: details ? comment : '',
    });
  };

  const message = sent
    ? withDetails
      ? t('answerActions.thanksDetails')
      : t('answerActions.thanks')
    : status === 'failed' && !changed
      ? t('answerActions.notSent')
      : '';

  const thumb = (value: AnswerRating) => (
    <Button
      variant={rating === value ? 'primary' : 'secondary'}
      data-size="sm"
      aria-pressed={rating === value}
      aria-disabled={sent || undefined}
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
      {rating && !sent ? (
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
            <Button data-size="sm" loading={busy} onClick={() => submit(true)}>
              {t('answerActions.send')}
            </Button>
            <Button variant="tertiary" data-size="sm" onClick={() => submit(false)}>
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
