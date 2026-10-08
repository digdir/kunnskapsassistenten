import { Card, Tag } from '@digdir/designsystemet-react';
import { Markdown } from '../../components';
import { CLARIFICATION_TAG } from './text';

type ClarificationProps = {
  /** The agent's question back, as markdown. */
  question: string;
};

/**
 * The agent asking for more before it answers (`needs-clarification`). A
 * finished turn and not a failure, so an `info` Tag and no `Alert`, and no
 * action row: the one move from here is to answer in the field below.
 */
export function Clarification({ question }: ClarificationProps) {
  return (
    <Card className="ka-answer-card" data-color="neutral">
      <Card.Block>
        <p className="ka-clarification__label">
          <Tag data-color="info" data-size="sm">
            {CLARIFICATION_TAG}
          </Tag>
        </p>

        <Markdown startLevel={3}>{question}</Markdown>
      </Card.Block>
    </Card>
  );
}
