import { Card, Chip, Tag } from '@digdir/designsystemet-react';
import { Markdown } from '../markdown/Markdown.js';
import { useT } from './i18n.js';

export interface ClarificationProps {
  /** The question back, as Markdown. */
  text: string;
  /** Answers the service offers, drawn as choices only when the app takes the reply. */
  options?: readonly string[] | undefined;
  /** One of the offered answers was chosen. */
  onReply?: ((option: string) => void) | undefined;
  assistantName?: string | undefined;
  headingLevel?: 2 | 3 | 4 | undefined;
  /** Designsystemet's `data-color` for the card, set only when given. */
  color?: string | undefined;
}

/**
 * The assistant asking for more before it answers. A finished turn and not a failure: an info tag
 * and no alert. No time and no action row either, since the one move from here is to answer.
 * Nothing was retrieved for it, so a `[N]` in it stays text.
 */
export const Clarification = ({
  text,
  options,
  onReply,
  assistantName,
  headingLevel = 3,
  color,
}: ClarificationProps) => {
  const t = useT();
  return (
    <Card className="uib-conversation-clarification" data-color={color}>
      <Card.Block>
        <span className="ds-sr-only">
          {assistantName
            ? t('conversation.asked', { name: assistantName })
            : t('conversation.askedUnnamed')}
        </span>
        {/* A paragraph and not a bare tag, so the tag has a line of its own. Info, because the
            reader has something to know, and not a warning: nothing went wrong. */}
        <p className="uib-conversation-clarification-label">
          <Tag data-color="info" data-size="sm">
            {t('conversation.needsClarification')}
          </Tag>
        </p>
        <Markdown
          text={text}
          className="uib-markdown uib-answer-text"
          headingLevel={headingLevel}
        />
        {options?.length && onReply ? (
          <div
            role="group"
            aria-label={t('conversation.chooseReply')}
            className="uib-conversation-options"
          >
            {options.map((option) => (
              <Chip.Button key={option} data-size="sm" onClick={() => onReply(option)}>
                {option}
              </Chip.Button>
            ))}
          </div>
        ) : null}
      </Card.Block>
    </Card>
  );
};
