import { Card, Skeleton } from '@digdir/designsystemet-react';
import { AnswerSkeleton } from './AnswerMessage';

/** How wide the stand-in question is: a number of CHARACTERS and not a
    length, the same as the answer's lines. See `AnswerSkeleton`. */
const QUESTION_CHARACTERS = 46;

/**
 * The conversation at the address while it is read, and NOT the front page
 * greeting, which offers to start over. Hidden from a screen reader, which
 * cannot read a shape; the view's region says it (`READING_THREAD`).
 */
export function ThreadLoading() {
  return (
    <div aria-hidden="true" className="ka-thread-loading__turn">
      <p className="ka-thread-loading__question">
        <Skeleton variant="text" width={QUESTION_CHARACTERS} />
      </p>

      <Card className="ka-answer-card" data-color="neutral">
        <Card.Block>
          <AnswerSkeleton />
        </Card.Block>
      </Card>
    </div>
  );
}
