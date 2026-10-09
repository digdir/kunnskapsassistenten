import { Card, Paragraph } from '@digdir/designsystemet-react';
import { useState } from 'react';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { attachmentsOnMessage } from './attachmentText';
import { Clarification } from './Clarification';
import { ThinkingPanel } from './ThinkingPanel';
import { thinkingWithoutAnswer } from './thinkingWithoutAnswer';

type MessageListProps = {
  messages: Message[];
  /** A `[n]` marker was activated. The message id goes with the number: each
     answer numbers its excerpts from 1, so the number alone does not say
     which excerpt. */
  onSelectSource: (citationNumber: number, messageId: string) => void;
  /** Ask the stopped question again, in place of the answer that was cut off. */
  onRegenerate: () => void;
  /** «Avgrenset til …» over an answer, by message id. Absent means the
     question was asked against the whole corpus. */
  filterSummary?: (messageId: string) => string | undefined;
  /** Whether the search behind an answer came back empty, by message id and
      not «the last one»: it is a fact about that answer, however many turns
      come after it. */
  foundNothing?: (messageId: string) => boolean;
  /** The turn the error alert under the conversation is about, if any. */
  liveErrorId?: string;
  /** The documents a question was asked with, by the question's message id:
      the question is what carried them. */
  attachmentsFor?: (messageId: string) => string[] | undefined;
};

/**
 * The conversation, as an ordered list because the order is the meaning. Who
 * said what is carried by text in a hidden span, not by colour or side, and
 * this file owns which answer the pinned search strip belongs to.
 */
export function MessageList({
  messages,
  onSelectSource,
  onRegenerate,
  filterSummary,
  foundNothing,
  liveErrorId,
  attachmentsFor,
}: MessageListProps) {
  // The answer whose search strip is in the view-head, and what is typed in
  // it. One strip, one query: switching answers starts a fresh search rather
  // than carrying the last one over to a different text.
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  /* «Svar 2 av 3», for the strip to say what it is searching now that it is
    no longer drawn inside the answer. Counted over the assistant turns in
    the order they were given, which is the order the reader sees. */
  const answerIds = messages.filter((message) => message.role === 'assistant').map((m) => m.id);
  const searchLabelFor = (messageId: string) => {
    if (answerIds.length < 2) return 'Søk i svaret';
    return `Søk i svar ${answerIds.indexOf(messageId) + 1} av ${answerIds.length}`;
  };

  function openSearch(messageId: string) {
    setSearchingId(messageId);
    setSearchQuery('');
  }

  function closeSearch() {
    setSearchingId(null);
    setSearchQuery('');
  }

  return (
    <ol className="ka-messages">
      {messages.map((message, index) => {
        if (message.role === 'user') {
          const attached = attachmentsFor?.(message.id);
          return (
            <li className="ka-message ka-message--user" key={message.id}>
              <span className="ds-sr-only">Du skrev:</span>
              {/* The reader's words in a box at the end of the line (issue
                  117): larger and bare above the answer, a question reads as
                  a heading over the card. `Card`, tinted, is the box. */}
              <Card className="ka-message__bubble" data-color="accent" variant="tinted">
                <Paragraph variant="long">{message.content}</Paragraph>
                {/* What the question was asked with. Under the question and not
                    over it: the words are what the reader wrote, the documents
                    are what they wrote it about. */}
                {attached?.length ? (
                  <Paragraph className="ka-message__attachments" data-size="sm">
                    {attachmentsOnMessage(attached)}
                  </Paragraph>
                ) : null}
              </Card>
            </li>
          );
        }

        // The agent asking back rather than answering: nothing a finished
        // answer carries applies, so it has its own component. «Tenkte i N
        // sekunder» does apply, because the agent searched before it asked.
        if (message.status === 'needs-clarification') {
          const clarificationSteps = thinkingWithoutAnswer(message.thinkingSteps, message.content);
          return (
            <li className="ka-message ka-message--assistant" key={message.id}>
              <span className="ds-sr-only">Kunnskapsassistenten spurte:</span>
              {/* Less the step that is the question back over again; see
                  `thinkingWithoutAnswer`. The agent can write it as its own
                  reasoning just as it can write an answer there. */}
              {clarificationSteps?.length ? (
                <ThinkingPanel
                  status="done"
                  steps={clarificationSteps}
                  thoughtMs={message.thoughtMs}
                />
              ) : null}
              <Clarification question={message.content} />
            </li>
          );
        }

        return (
          <AnswerMessage
            foundNothing={foundNothing?.(message.id)}
            key={message.id}
            liveErrorId={liveErrorId}
            message={message}
            narrowedTo={filterSummary?.(message.id)}
            /* What this answer is an answer to, for «Fremgangsmåte». The
               list is the one place that knows: an answer carries no
               question, and the turn before it is right here. */
            question={questionBefore(messages, index)}
            onCloseSearch={closeSearch}
            onRegenerate={onRegenerate}
            onSearchQueryChange={setSearchQuery}
            onSelectSource={onSelectSource}
            onToggleSearch={() => openSearch(message.id)}
            searchLabel={searchLabelFor(message.id)}
            searchOpen={searchingId === message.id}
            searchQuery={searchQuery}
          />
        );
      })}
    </ol>
  );
}

/** The reader's own question, for the answer at `index`. Backwards from the
    answer and not «the message before», because a clarification can sit
    between a question and the answer it finally gets. */
function questionBefore(messages: Message[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i]?.content;
  }
  return undefined;
}
