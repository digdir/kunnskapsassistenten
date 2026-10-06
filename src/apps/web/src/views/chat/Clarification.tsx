import { Card, Tag } from '@digdir/designsystemet-react';
import { Markdown } from '../../components';
import { CLARIFICATION_TAG } from './text';

type ClarificationProps = {
  /** The agent's question back, as markdown. */
  question: string;
};

/**
 * The agent asking for more before it answers: backend status
 * `needs-clarification` (design/eksisterende/api-for-frontend.md l.208).
 *
 * It is a finished turn, not a failed one, so it is not an `Alert` and says
 * nothing about anything going wrong. What it needs is a frame that makes the
 * text read as a question to the reader rather than as a short answer, and
 * that is the `Tag`: «Trenger avklaring», above the question.
 *
 * **`info` and not `neutral`** (issue 112). A grey tag looks like a
 * label on an answer, and this is not an answer — the conversation stops here
 * until the reader says something. `info` is Designsystemet's «here is
 * something you need to know», which is what this is; `warning` would say
 * something had gone wrong, and nothing has. The colour is not carrying the
 * meaning on its own either: the tag says «Trenger avklaring» in words, and
 * the compose field below has already swapped its placeholder for «Svar på
 * spørsmålet over …» (WCAG 1.4.1).
 *
 * Nothing was retrieved, so there is nothing to show from a search: no `[n]`
 * markers, no «Fremgangsmåte», no follow-up suggestions. `Markdown` is given
 * no citations, which leaves any bracketed number in the text as plain text —
 * the right outcome when there is no excerpt behind it.
 *
 * **No action row at all** (issue 112). It held «Kopier spørsmålet» and
 * the time the assistant asked. Neither is what the reader is here to do: the
 * one move from this card is to answer the question, and the field below is
 * waiting for it with the caret already in it. The time goes with the button
 * rather than standing alone in an otherwise empty row — the reader's own
 * question above carries no time either, and the thread list says when the
 * conversation last moved.
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
