export type AnswerRating = 'up' | 'down';

/** What the person said about an answer. The app adds the answer's task id and sends it. */
export interface AnswerFeedback {
  rating: AnswerRating;
  /**
   * The reasons picked for a thumbs down, in bokmål whatever language the person reads, so
   * the service reads every answer's reasons the same way. Empty when they skipped.
   */
  reasons: string[];
  /** Empty when they skipped. */
  comment: string;
}

/** What the app's last copy did: the answer with this many sources, the link, or nothing. */
export type AnswerCopied =
  { kind: 'answer'; sources?: number | undefined } | { kind: 'link' } | { kind: 'failed' };

export type AnswerFeedbackStatus = 'sending' | 'sent' | 'failed';
