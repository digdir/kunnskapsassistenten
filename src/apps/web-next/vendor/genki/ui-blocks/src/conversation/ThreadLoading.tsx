import { Card, Skeleton } from '@digdir/designsystemet-react';
import { AnswerSkeleton } from '../answer/Answer.js';

/** How wide the stand-in question is: characters, not a length, as the answer's lines are. */
const questionCharacters = 46;

/**
 * The conversation while it is read: one question and one answer in outline, not a greeting that
 * offers to start over. Hidden from a screen reader, which cannot read a shape; the conversation's
 * live region says it in words.
 */
export const ThreadLoading = ({ color }: { color?: string | undefined }) => (
  <div aria-hidden="true" className="uib-conversation-loading">
    <p className="uib-conversation-loading-question">
      <Skeleton variant="text" width={questionCharacters} />
    </p>
    <Card className="uib-conversation-loading-answer" data-color={color}>
      <Card.Block>
        <AnswerSkeleton />
      </Card.Block>
    </Card>
  </div>
);
