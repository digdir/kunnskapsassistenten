import { threadTime } from '../../components';

type AnswerTimeProps = {
  /** ISO 8601 from {@link Message.createdAt}. */
  createdAt: string;
};

/**
 * When the answer came, from `createdAt` and through the same `threadTime`
 * the thread list uses. Two texts: the list's short one on screen, and a
 * whole one announced, since there is no group heading here to say the year.
 */
export function AnswerTime({ createdAt }: AnswerTimeProps) {
  const when = threadTime(createdAt);
  // An answer with a broken timestamp shows none. «Invalid Date» under a
  // finished answer would be worse than saying nothing, which is the same
  // call `threadTime` makes for a thread row.
  if (!when) return null;

  return (
    <time className="ka-answer-time" dateTime={when.dateTime} title={when.title}>
      <span aria-hidden="true">{when.text}</span>
      <span className="ds-sr-only">Svaret kom {when.title}</span>
    </time>
  );
}
