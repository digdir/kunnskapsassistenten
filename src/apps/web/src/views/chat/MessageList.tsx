import { Card, Paragraph } from '@digdir/designsystemet-react';
import { useState } from 'react';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { attachmentsOnMessage } from './attachmentText';
import { Clarification } from './Clarification';
import { ThinkingPanel } from './ThinkingPanel';

type MessageListProps = {
  messages: Message[];
  /**
   * A `[n]` marker was activated. The message id goes with the number: each
   * answer numbers its excerpts from 1, so the number alone does not say
   * which excerpt (#4, brukerreiser punkt 5).
   */
  onSelectSource: (citationNumber: number, messageId: string) => void;
  /** Ask the stopped question again, in place of the answer that was cut off. */
  onRegenerate: () => void;
  /**
   * «Avgrenset til …» over an answer, by message id. Absent means the
   * question was asked against the whole corpus.
   */
  filterSummary?: (messageId: string) => string | undefined;
  /**
   * Whether the search behind an answer came back empty, by message id.
   *
   * By id and not «the last one», because it is a fact about that answer: the
   * notice it carries is the whole answer, and what a finished answer offers
   * onward does not belong under it however many turns come after.
   */
  foundNothing?: (messageId: string) => boolean;
  /** The turn the error alert under the conversation is about, if any. */
  liveErrorId?: string;
  /**
   * The documents a question was asked with, by the question's message id.
   *
   * Drawn on the reader's own message, because that is where it belongs: the
   * question is what carried them, and the answer is what came back.
   */
  attachmentsFor?: (messageId: string) => string[] | undefined;
};

/**
 * The conversation.
 *
 * An ordered list, because the order is the meaning: message four answers
 * message three. Who said what is carried by text, not by colour or by which
 * side a bubble sits on — a screen reader user gets neither.
 *
 * The sender line is a visually hidden span rather than a heading. The answer
 * brings its own headings from the model, and a heading per message on top of
 * those would give the page two competing outlines.
 *
 * It also owns which answer the search strip belongs to, and that is not a
 * detail of bookkeeping. The strip is drawn in the shell's view-head, pinned
 * to the top of the column, and a region has one of those — so «which answer
 * is being searched» is a fact about the conversation and cannot live inside
 * each answer. Before it moved, every answer held its own and two could be
 * open at once; now opening one closes the other, which is also what a single
 * pinned strip looks like to a reader.
 *
 * Three kinds of turn, and this file is the choice between them. A question
 * is a paragraph in a box at the end of the line. A turn that came back as `needs-clarification` is a question
 * to the reader and not an answer, so the sender line says «spurte» and the
 * card is `Clarification`. Everything else is an answer, and `AnswerMessage`
 * draws it — it holds state of its own, which is why it is a component and
 * not another branch in here.
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

  /*
   * «Svar 2 av 3», for the strip to say what it is searching now that it is
   * no longer drawn inside the answer. Counted over the assistant turns in
   * the order they were given, which is the order the reader sees.
   */
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
              {/*
                The reader's words in a box of their own, at the end of the
                line, in the size the answer is written in (Simens issue
                117). Set larger and bare above the answer, as Figma had it,
                the question read as a heading over the card. A box at the
                far side is what other chats do and what a reader already
                knows: ChatGPT, Gemini, Copilot and Claude all draw the
                reader that way, and the answer across the column.

                Designsystemet has no chat message, and `Card` is the box it
                does have: tinted, and in the one blue the app uses.
              */}
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

        // The agent asking back rather than answering. It is an assistant
        // turn like any other, but nothing a finished answer carries applies
        // to it, so it is drawn by its own component rather than by switching
        // four things off in this one.
        //
        // «Tenkte i N sekunder» does apply, and stays: the agent searched
        // before it asked back, and how long it spent is the same fact here
        // as over an answer (the conductor, 2026-09-15).
        if (message.status === 'needs-clarification') {
          return (
            <li className="ka-message ka-message--assistant" key={message.id}>
              <span className="ds-sr-only">Kunnskapsassistenten spurte:</span>
              {message.thinkingSteps?.length ? (
                <ThinkingPanel
                  status="done"
                  steps={message.thinkingSteps}
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
            /* What this answer is an answer to. «Fremgangsmåte» drops a search
               word that is the question over again — see ProcedurePanel. The
               list is the one place that knows: an answer carries no question,
               and the turn before it is right here. */
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

/**
 * The reader's own question, for the answer at `index`.
 *
 * Backwards from the answer rather than «the message before», because a turn
 * is not always two messages: a clarification sits between a question and the
 * answer it finally gets, and the question is still the one the reader asked.
 */
function questionBefore(messages: Message[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i]?.content;
  }
  return undefined;
}
