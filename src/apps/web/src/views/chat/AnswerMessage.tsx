import { Button, Card, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { ArrowsCirclepathIcon, InformationSquareIcon } from '@navikt/aksel-icons';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Markdown } from '../../components';
import { ViewHead } from '../../layout/ViewHead';
import { citationTargets, type Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { AnswerSearch } from './AnswerSearch';
import { AnswerTime } from './AnswerTime';
import { ProcedurePanel } from './ProcedurePanel';
import { RetrievalPanel } from './RetrievalPanel';
import { SourcesSummary } from './SourcesSummary';
import { ThinkingPanel } from './ThinkingPanel';
import { useDisplayLevel } from './displayLevel';
import { lacksSources } from './noSources';
import { thinkingWithoutAnswer } from './thinkingWithoutAnswer';
import {
  ABORTED_BEFORE_ANSWER,
  ABORTED_NOTE,
  CLOSING_QUESTION,
  FAILED_NOTE,
  NO_SOURCES_WARNING,
  REGENERATE,
} from './text';
import { ANSWER_MARK_CLASS, useAnswerHits } from './useAnswerHits';

type AnswerMessageProps = {
  message: Message;
  /** A `[n]` marker was activated, with the answer it sits in. */
  onSelectSource: (citationNumber: number, messageId: string) => void;
  /** Ask the stopped question again, in place of the answer that was cut off. */
  onRegenerate: () => void;
  /** Whether the search strip belongs to THIS answer right now. Held by the
      list, because the strip is drawn in the shell's view-head and there is
      one of those per region. */
  searchOpen: boolean;
  /** What is typed in the strip. One strip, one query. */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** Open the search on this answer, or close it if it is already here. */
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  /** «Søk i svar 2 av 3» — which answer the pinned strip is searching. */
  searchLabel: string;
  /** The turn the error alert is about, if any. A failed turn outlives its
      alert and must then say for itself why there is no answer; while the
      alert is up, the card stays quiet rather than repeating it. */
  liveErrorId?: string;
  /** The line over the answer: what it was narrowed to, where it came from,
      or both. Absent is the whole corpus, which needs no line. */
  narrowedTo?: string;
  /** The reader's own question, for «Fremgangsmåte» to recognise a search
      word that is only the question over again. See ProcedurePanel. */
  question?: string;
  /** The search behind this answer came back empty, so the answer is the
      notice saying so and what a finished answer offers onward does not
      apply. */
  foundNothing?: boolean;
};

/** **`width` on `variant="text"` is a NUMBER OF CHARACTERS, not a length**:
    Skeleton repeats that many dashes into `data-text`, so a percentage gives
    one dash a line. Each needs its own block, being `display: inline`. */
const SKELETON_LINE_CHARACTERS = [78, 86, 82, 48];

export function AnswerSkeleton() {
  return (
    <div aria-hidden="true" className="ka-answer-skeleton">
      {SKELETON_LINE_CHARACTERS.map((characters) => (
        <p className="ka-answer-skeleton__line" key={characters}>
          <Skeleton variant="text" width={characters} />
        </p>
      ))}
    </div>
  );
}

/** One assistant turn: what the agent did, what it answered, and what the
   reader can do with it. Its own component because it holds state — a thread
   of ten answers has ten independent searches. */
export function AnswerMessage({
  message,
  onSelectSource,
  onRegenerate,
  searchOpen,
  searchQuery,
  onSearchQueryChange,
  onToggleSearch,
  onCloseSearch,
  searchLabel,
  liveErrorId,
  narrowedTo,
  question,
  foundNothing,
}: AnswerMessageProps) {
  const streaming = message.status === 'streaming';
  const aborted = message.status === 'aborted';
  const complete = message.status === 'complete';
  const empty = message.content.length === 0;
  // The agent's own words, less the step that is the answer over again,
  // which happens on an iteration with no tool call.
  const steps = thinkingWithoutAnswer(message.thinkingSteps, message.content);
  // Failed, and the alert is no longer speaking for it.
  const failedQuietly = message.status === 'error' && message.id !== liveErrorId;
  // A failed turn with nothing in it gets no card: an empty bordered box
  // above the error says nothing. A stopped one gets one whatever phase it
  // was in, because the card is what says it was stopped.
  const showCard = !empty || streaming || aborted || failedQuietly;

  // How much of the assistant's own work this answer shows: «Fremgangsmåte»
  // at `standard`, the thinking panel and hit count at `detaljert`. See
  // displayLevel.ts and issue 88.
  const detailed = useDisplayLevel() === 'detaljert';

  const searching = searchOpen;
  const query = searchQuery;
  // Held still between renders, and not as polish: `Markdown` memoises
  // `components` on these two, so new ones per render remount the whole
  // answer and swap out the marker node a click just moved focus into.
  const citations = useMemo(() => citationTargets(message.sources ?? []), [message.sources]);

  // Through a ref, not as a dependency: otherwise the whole answer rests on
  // every parent in the chain memoising its callback, and one inline
  // `onSelectSource` swaps the markers out again.
  const selectSource = useRef(onSelectSource);
  useEffect(() => {
    selectSource.current = onSelectSource;
  }, [onSelectSource]);
  const activateCitation = useCallback(
    (number: number) => selectSource.current(number, message.id),
    [message.id],
  );

  const answerRef = useRef<HTMLDivElement>(null);
  const searchFieldRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const { hitCount, currentIndex, step } = useAnswerHits(answerRef, searching ? query : '');

  // Closing puts focus back on the button that opened it: the strip is gone
  // by the time this has run, and a keyboard user in the field would land on
  // `<body>`, a whole page from the answer they were reading (WCAG 2.4.3).
  function closeSearch() {
    onCloseSearch();
    searchToggleRef.current?.focus();
  }

  return (
    <li className="ka-message ka-message--assistant">
      {/* The search strip, pinned to the top of the column by the shell: in
          this card, which scrolls, it ends up under the compose field. First
          in the view, so the portal and the DOM agree on the tab order. */}
      {searching ? (
        <ViewHead>
          <AnswerSearch
            currentHitIndex={currentIndex}
            fieldRef={searchFieldRef}
            hitCount={hitCount}
            label={searchLabel}
            onClose={closeSearch}
            onQueryChange={onSearchQueryChange}
            onStep={step}
            query={query}
          />
        </ViewHead>
      ) : null}

      <span className="ds-sr-only">Kunnskapsassistenten svarte:</span>

      {/* Which documents the question was asked against. Over the card, as a
          fact about the question and not part of the answer, and not a Chip,
          since the filter is changed where it was set. */}
      {narrowedTo ? (
        <p className="ka-filter-summary">
          <span className="ds-sr-only">Svaret er </span>
          {narrowedTo}
        </p>
      ) : null}

      {/* What the agent did before it started writing. The same turn, so not
          a message of its own but the header of this one. */}
      {steps?.length ? (
        detailed ? (
          <ThinkingPanel
            status={streaming && empty ? 'thinking' : 'done'}
            steps={steps}
            // The measured wait, not the sum of what the steps reported: it
            // has to be handed over, or the panel falls back to the sum and
            // the same unchanged turn reports two numbers.
            thoughtMs={message.thoughtMs}
          />
        ) : (
          <ProcedurePanel
            question={question}
            retrieval={message.retrieval}
            status={streaming && empty ? 'thinking' : 'done'}
            steps={steps}
          />
        )
      ) : null}

      {/* `data-color` is neutral and not inherited: with accent on the root
          the card and its border go blue. Two blocks rather than one, because
          Card.Block draws the divider above the action row. */}
      {showCard ? (
        <Card className="ka-answer-card" data-color="neutral">
          <Card.Block>
            {empty && streaming ? <AnswerSkeleton /> : null}

            {/* One quiet line over the answer, as Aksel's InlineMessage
                draws status info, and over so it is read first. Not a
                Designsystemet component, which has none for this. */}
            {lacksSources(message) ? (
              <Paragraph className="ka-no-sources-note" data-size="sm">
                <InformationSquareIcon aria-hidden className="ka-no-sources-note__icon" />
                {NO_SOURCES_WARNING}
              </Paragraph>
            ) : null}

            {/* The ref is what the search counts marks inside, so it wraps the
                answer and nothing else: the closing question and the action
                row are not part of what was searched. */}
            <div ref={answerRef}>
              {empty ? null : (
                <Markdown
                  citations={citations}
                  markClassName={ANSWER_MARK_CLASS}
                  onCitationActivate={activateCitation}
                  searchQuery={searching ? query : ''}
                  // A stopped answer wrote its markers; the excerpts were
                  // still on their way. Then `[3]` is drawn as text that says
                  // why, not as a link to nothing.
                  sourcesLost={aborted}
                  startLevel={3}
                >
                  {message.content}
                </Markdown>
              )}
            </div>

            {/* The live region says the same thing in words, so this line is
                decoration. */}
            {streaming && !empty ? (
              <p aria-hidden="true" className="ka-streaming-status">
                <Spinner aria-hidden="true" data-size="xs" />
                Skriver svar …
              </p>
            ) : null}

            {/* The hit count and the search words. Detailed only: at
                standard the procedure above has already said what the answer
                was built on, in plainer words (issue 88). */}
            {detailed && message.retrieval && !streaming ? (
              <RetrievalPanel retrieval={message.retrieval} />
            ) : null}

            {/* A stopped answer has no sources, since they arrive in a frame
                that never came. Saying so keeps the `[n]` markers from
                reading as a mistake. */}
            {aborted ? (
              <Paragraph className="ka-aborted-note" data-size="sm" variant="long">
                {empty ? ABORTED_BEFORE_ANSWER : ABORTED_NOTE}
              </Paragraph>
            ) : null}

            {failedQuietly ? (
              <Paragraph className="ka-failed-note" data-size="sm" variant="long">
                {FAILED_NOTE}
              </Paragraph>
            ) : null}

            {/* The documents the answer rests on. Only once it is done: the
                sources arrive in the last frame, and a list that grew while
                the text was written would move under it. */}
            {complete && !empty && !foundNothing ? (
              <SourcesSummary documents={message.sources ?? []} onSelectSource={activateCitation} />
            ) : null}

            {complete && !empty && !foundNothing ? (
              <Paragraph variant="long">{CLOSING_QUESTION}</Paragraph>
            ) : null}
          </Card.Block>

          {complete && !empty ? (
            <Card.Block>
              <AnswerActions
                content={message.content}
                createdAt={message.createdAt}
                onToggleSearch={() => {
                  if (searching) {
                    closeSearch();
                    return;
                  }
                  onToggleSearch();
                  // The strip is not in the page yet, so the focus goes on the
                  // next render.
                  queueMicrotask(() => searchFieldRef.current?.focus());
                }}
                searchOpen={searching}
                searchToggleRef={searchToggleRef}
                sources={message.sources}
              />
            </Card.Block>
          ) : null}

          {/* Nothing to copy from half an answer, so the row is the one way
              onward — and the same on a turn that has outlived its alert,
              which would otherwise be the one turn with no way on. */}
          {aborted || failedQuietly ? (
            <Card.Block>
              <div className="ka-answer-actions">
                <Button
                  data-color="neutral"
                  data-size="sm"
                  onClick={onRegenerate}
                  variant="tertiary"
                >
                  <ArrowsCirclepathIcon aria-hidden />
                  {REGENERATE}
                </Button>

                {/* A stopped answer is still an answer the reader can refer
                    back to, and it is in the thread with the same timestamp
                    as any other. The same holds for one that failed. */}
                <AnswerTime createdAt={message.createdAt} />
              </div>
            </Card.Block>
          ) : null}
        </Card>
      ) : null}
    </li>
  );
}
