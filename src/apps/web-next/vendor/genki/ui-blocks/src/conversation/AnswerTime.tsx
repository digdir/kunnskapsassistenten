import { useFormat } from '@genai/i18n/react';
import { useT } from './i18n.js';
import { answerTime } from './time.js';

export interface AnswerTimeProps {
  /** When the answer came, as ISO 8601 or a date. */
  at: string | number | Date;
  /** The moment «i dag» and «i går» are counted from. */
  now?: Date | undefined;
  className?: string | undefined;
}

/**
 * When an answer came: the short text on screen, and the whole date for a screen reader, since
 * nothing over the answer says the year. Outside every button, so it never joins a button's name.
 */
export const AnswerTime = ({ at, now, className }: AnswerTimeProps) => {
  const t = useT();
  const f = useFormat();
  const when = answerTime(
    at,
    f,
    {
      yesterday: t('conversation.yesterday'),
      dateTime: (date, time) => t('conversation.dateTime', { date, time }),
    },
    now,
  );
  if (!when) return null;
  return (
    <time
      className={className ? `uib-conversation-time ${className}` : 'uib-conversation-time'}
      dateTime={when.dateTime}
      title={when.title}
    >
      <span aria-hidden="true">{when.text}</span>
      <span className="ds-sr-only">{t('conversation.answered', { time: when.title })}</span>
    </time>
  );
};
