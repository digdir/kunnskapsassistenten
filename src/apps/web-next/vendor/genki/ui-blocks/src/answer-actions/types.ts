export type AnswerRating = 'up' | 'down';

/**
 * What the person said about an answer. The app adds the answer's task id and sends it. The
 * block raises it on the click on a thumb, and again with the reasons and comment if the person
 * sends them, each time in full, so the latest replaces the one before.
 */
export interface AnswerFeedback {
  rating: AnswerRating;
  /**
   * The reasons picked for a thumbs down, in bokmål whatever language the person reads, so
   * the service reads every answer's reasons the same way. Empty until they are sent.
   */
  reasons: string[];
  /** Empty until it is sent. */
  comment: string;
}

/** What the app's last copy did: the answer with this many sources, the link, or nothing. */
export type AnswerCopied =
  { kind: 'answer'; sources?: number | undefined } | { kind: 'link' } | { kind: 'failed' };

export type AnswerFeedbackStatus = 'sending' | 'sent' | 'failed';
