import { Button, Card, Heading, Paragraph } from '@digdir/designsystemet-react';
import { ArrowsCirclepathIcon, MagnifyingGlassIcon } from '@navikt/aksel-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Answer, type AnswerTarget } from '../answer/Answer.js';
import { finishedText } from '../answer/copy.js';
import type { MarkdownHighlight } from '../markdown/Markdown.js';
import { findHits, stepHit } from '../markdown/textSearch.js';
import type { SourceDocument, SourceTarget } from '../sources/types.js';
import { AnswerSearch } from './AnswerSearch.js';
import { AnswerTime } from './AnswerTime.js';
import { Clarification } from './Clarification.js';
import { useFollowAnswer } from './follow.js';
import { useT } from './i18n.js';
import { answerVisibleText } from './search.js';
import { ThreadLoading } from './ThreadLoading.js';
import type {
  ConversationActionParts,
  ConversationAnswer,
  ConversationClarification,
  ConversationQuestion,
  ConversationScope,
  ConversationTarget,
  ConversationTurn,
} from './types.js';

/** Without progress this long, an answer on its way says it takes longer than usual. */
export const SLOW_ANSWER_MS = 30_000;
/** Without progress this long, the app is told the answer has stalled, to stop it. */
export const STALLED_ANSWER_MS = 300_000;

export interface ConversationProps {
  /** The turns in the order they were said: the order is the meaning. */
  turns: readonly ConversationTurn[];
  /** The thread is being read. With no turn yet, a question and an answer in outline stand in. */
  loading?: boolean | undefined;
  /** A footnote was followed: in which answer, its index there, and the item it cites. */
  onOpenCitation?:
    ((turn: ConversationAnswer, citation: number, target: SourceTarget) => void) | undefined;
  /** A document in «Kilder brukt i svaret» was chosen, in which answer. */
  onOpenDocument?: ((turn: ConversationAnswer, source: SourceDocument) => void) | undefined;
  /** An excerpt under a title in «Kilder brukt i svaret» was chosen, in which answer. */
  onOpenExcerpt?: ((turn: ConversationAnswer, target: SourceTarget) => void) | undefined;
  /**
   * Asks a stopped or failed question again, offered under that answer, with the question it
   * answers. A question nothing answered gets the same offer, with an answer turn that stands in.
   */
  onRegenerate?:
    ((turn: ConversationAnswer, question: ConversationQuestion | undefined) => void) | undefined;
  /** The thread's name, as a visible heading over the conversation. */
  title?: string | undefined;
  /**
   * The name only repeats the first question, so the heading is there for the outline and hidden
   * from the eye. Without it, the block compares the name with the question's first sentence.
   */
  titleRepeatsQuestion?: boolean | undefined;
  /** The title's heading level, 2 by default; the answers' headings follow under it. */
  titleLevel?: 1 | 2 | 3 | undefined;
  /**
   * An answer to the last question is on its way, before the app has a turn for it. Without it, a
   * last question with nothing after it, outside `loading`, got no answer and says so.
   */
  pending?: boolean | undefined;
  /** The last question's answer may still come: «Hent på nytt», in place of «no answer», calls it. */
  onFetchAgain?: (() => void) | undefined;
  /** One of the answers a question back offers was chosen. */
  onReply?: ((turn: ConversationClarification, option: string) => void) | undefined;
  /** Where a footnote or a document leads, for a new tab and for copying. */
  href?: ((turn: ConversationAnswer, target: SourceTarget) => string | undefined) | undefined;
  /** An id for each footnote, unique in the page: each answer counts its footnotes from 0. */
  citationId?: ((turn: ConversationAnswer, citation: number) => string) | undefined;
  /** The footnote to scroll to and focus, where Sources' `onShowUse` and `onReturn` lead. */
  target?: ConversationTarget | undefined;
  /** Over an answer or a question back: «Fremgangsmåte», for example. */
  header?:
    | ((
        turn: ConversationAnswer | ConversationClarification,
        question: ConversationQuestion | undefined,
      ) => ReactNode)
    | undefined;
  /**
   * The row under a finished answer, such as `AnswerActions`. Put `end` at the far end of it and
   * `search` among its actions. Without it, the row holds those two alone.
   */
  actions?: ((turn: ConversationAnswer, parts: ConversationActionParts) => ReactNode) | undefined;
  /**
   * «Søk i svaret» under each finished answer, and the search strip over the conversation. Off
   * unless asked for: kunnskapsassistenten took it out (digdir/kunnskapsassistenten#209).
   */
  search?: boolean | undefined;
  /** Keeps the column at its end while an answer comes, if the reader was there. On by default. */
  follow?: boolean | undefined;
  /** The column the conversation scrolls in. Without it, the nearest ancestor that scrolls. */
  scrollContainer?: RefObject<HTMLElement | null> | undefined;
  /** The reader came to or left the end of the column: for the composer's «Bla til bunnen». */
  onAtEndChange?: ((atEnd: boolean) => void) | undefined;
  /**
   * How long an answer on its way may go without progress, a new turn object, before a line says
   * it takes longer than usual. `false` draws no line.
   */
  slowAfter?: number | false | undefined;
  /** How long without progress before `onStalled`. */
  stalledAfter?: number | undefined;
  /** An answer on its way has stalled: the app stops it, as with «Avbryt». */
  onStalled?: ((turn: ConversationAnswer) => void) | undefined;
  /** «Kilder brukt i svaret» under a finished answer. */
  sourcesUsed?: boolean | undefined;
  /** `Answer`'s `documentFootnotes`: marks per cited document until a service cites excerpts. */
  documentFootnotes?: boolean | undefined;
  /** «Er det noe mer jeg kan hjelpe deg med?» under a finished answer. */
  closingQuestion?: boolean | undefined;
  /** Who answers, for a screen reader. Without it, the AI assistant. */
  assistantName?: string | undefined;
  /** The level of an answer's own top heading. */
  headingLevel?: 2 | 3 | 4 | undefined;
  /** Designsystemet's `data-color` for the reader's questions, set only when given. */
  questionColor?: string | undefined;
  /** Designsystemet's `data-color` for each answer, question back and stand-in, when given. */
  answerColor?: string | undefined;
  /**
   * `plain`, the dev boards' answer (dev-kilder-hoyre): under the label «Kunnskapsassistenten»,
   * `assistantName`, over what the `header` puts there, and with no card (`Answer`'s `plain`).
   */
  answerVariant?: 'card' | 'plain' | undefined;
  /** `false` leaves out the label over a `plain` answer, as the newer dev boards draw it. */
  answerLabel?: boolean | undefined;
  /** Designsystemet's `data-color` for the block, set only when given. */
  color?: string | undefined;
  /** The moment an answer's «i dag» and «i går» are counted from. */
  now?: Date | undefined;
  className?: string | undefined;
}

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

const stillMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The reader's question an answer answers: backwards, since a question back can sit between. */
const questionBefore = (turns: readonly ConversationTurn[], index: number) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn?.kind === 'question') return turn;
  }
  return undefined;
};

// A thread named after its question: kunnskapsassistenten's threadHeading.ts takes the first
// sentence, cut on a word at 80 characters. Such a title says nothing the question under it
// doesn't, so it stays in the outline and out of sight.
const titleLength = 80;
const isStop = (char: string | undefined) => char !== undefined && '.?!…'.includes(char);
// Read by hand, not by pattern, so a long run of stops takes linear time.
const firstSentence = (question: string) => {
  const text = question.trim().replace(/\s+/gu, ' ');
  let space = text.indexOf(' ');
  while (space > 0 && !isStop(text[space - 1])) space = text.indexOf(' ', space + 1);
  const sentence = space > 0 ? text.slice(0, space) : text;
  let end = sentence.length;
  while (end > 0 && isStop(sentence[end - 1])) end -= 1;
  return sentence.slice(0, end).trimEnd();
};
const shortened = (text: string) => {
  if (text.length <= titleLength) return text;
  const cut = text.lastIndexOf(' ', titleLength);
  return `${text.slice(0, cut > 0 ? cut : titleLength).trimEnd()} …`;
};
const repeatsQuestion = (title: string, question: string | undefined) => {
  if (question === undefined) return false;
  const name = title.trim();
  const whole = question.trim().replace(/\s+/gu, ' ');
  const sentence = firstSentence(question);
  return name === whole || name === sentence || name === shortened(sentence);
};

/** A question with no answer, question back or stand-in after it, before the next question. */
const unanswered = (
  turns: readonly ConversationTurn[],
  index: number,
  stillComing: boolean,
): boolean => {
  if (turns[index]?.kind !== 'question') return false;
  const next = turns[index + 1];
  if (next === undefined) return !stillComing;
  return next.kind === 'question';
};

/**
 * The conversation: the reader's questions, the answers and the questions back, as an ordered
 * list, because the order is the meaning. Who said what is said in words to a screen reader, not
 * only by side and colour. Each answer is the `Answer` block. The block only draws and raises
 * events: the app holds the thread, sends, and fills the slots.
 */
export const Conversation = ({
  turns,
  loading = false,
  onOpenCitation,
  onOpenDocument,
  onOpenExcerpt,
  onRegenerate,
  title,
  titleRepeatsQuestion,
  titleLevel = 2,
  pending = false,
  onFetchAgain,
  onReply,
  href,
  citationId,
  target,
  header,
  actions,
  search = false,
  follow = true,
  scrollContainer,
  onAtEndChange,
  slowAfter = SLOW_ANSWER_MS,
  stalledAfter = STALLED_ANSWER_MS,
  onStalled,
  sourcesUsed,
  documentFootnotes,
  closingQuestion,
  assistantName,
  headingLevel = 3,
  questionColor,
  answerColor,
  answerVariant = 'card',
  answerLabel: labelled = true,
  color,
  now,
  className,
}: ConversationProps) => {
  const t = useT();
  const plain = answerVariant === 'plain';
  // For the eye: the answer's own line, «… svarte:», still tells a screen reader who answered.
  const answerLabel =
    plain && labelled ? (
      // In the answers' family, as the answer it names.
      <p aria-hidden="true" className="uib-conversation-label" data-color={answerColor}>
        {assistantName ?? t('answer.assistant')}
      </p>
    ) : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const toggles = useRef(new Map<string, HTMLButtonElement>());

  // «Generer på nytt» and «Prøv igjen» go away with the answer they stand under, whether the app
  // replaces the turn in place or draws a new one. When focus falls to the page with the button
  // the reader pressed, it goes to the answer that takes its place, the item at the same place.
  const regenerating = useRef<{ at: number; pressed: Element } | undefined>(undefined);
  const replacing = (then: () => void) => {
    const pressed = document.activeElement;
    const item = pressed?.closest('.uib-conversation-turn');
    const at = item && listRef.current ? [...listRef.current.children].indexOf(item) : -1;
    regenerating.current = pressed && at >= 0 ? { at, pressed } : undefined;
    then();
  };
  const regenerate = (turn: ConversationAnswer, question: ConversationQuestion | undefined) =>
    replacing(() => onRegenerate?.(turn, question));
  useEffect(() => {
    const asked = regenerating.current;
    if (!asked) return;
    const active = document.activeElement;
    // The button is still there: nothing replaced it yet, and focus the reader moved stays.
    if (asked.pressed.isConnected) {
      if (active !== asked.pressed) regenerating.current = undefined;
      return;
    }
    regenerating.current = undefined;
    // Focus the reader moved elsewhere stays.
    if (active !== null && active !== document.body) return;
    const item = listRef.current?.children[asked.at];
    if (item instanceof HTMLElement && item.dataset.kind === 'answer')
      item.focus({ preventScroll: true });
  });

  // An answer is on its way from the moment the question stands last, so the question's own
  // growth is followed too.
  const last = turns.at(-1);
  const waiting = last?.kind === 'answer' && last.status === 'streaming' ? last : undefined;
  const answering = waiting !== undefined || (last?.kind === 'question' && !loading);
  const atEnd = useFollowAnswer(rootRef, answering, follow, scrollContainer);
  const atEndChange = useRef(onAtEndChange);
  atEndChange.current = onAtEndChange;
  useEffect(() => {
    atEndChange.current?.(atEnd);
  }, [atEnd]);

  // What the polite region says about an answer on its way, as kunnskapsassistenten's useChat:
  // that it is coming, each block once it is finished, and how it ended. Only answers seen on
  // their way: a thread read back says nothing. A failed answer is said by its own alert.
  const [announcement, setAnnouncement] = useState('');
  const live = useRef(new Map<string, { status: string; finished: string }>());
  const lastSeen = useRef<string | undefined>(undefined);
  useEffect(() => {
    const turn = turns.at(-1);
    const before = lastSeen.current;
    lastSeen.current = turn?.id;
    const followed = before !== undefined && live.current.has(before);
    // An answer that leaves unended, as when another thread opens, is no longer coming here.
    for (const [id, known] of live.current)
      if (known.status === 'streaming' && !turns.some((other) => other.id === id)) {
        live.current.delete(id);
        setAnnouncement('');
      }
    if (!turn) setAnnouncement('');
    if (!turn || loading) return;
    if (turn.kind === 'clarification') {
      // New after the question it follows, or in place of the answer that was coming.
      const arrived =
        turn.id !== before && before !== undefined && (turns.at(-2)?.id === before || followed);
      if (arrived)
        setAnnouncement(
          assistantName
            ? t('conversation.clarifying', { name: assistantName })
            : t('conversation.clarifyingUnnamed'),
        );
      return;
    }
    if (turn.kind !== 'answer') return;
    const known = live.current.get(turn.id);
    if (!known) {
      if (turn.status !== 'streaming') return;
      live.current.set(turn.id, { status: 'streaming', finished: '' });
      setAnnouncement(t('conversation.answerComing'));
      return;
    }
    if (turn.status === 'streaming') {
      const finished = finishedText(turn.text);
      if (finished && finished !== known.finished) {
        known.finished = finished;
        setAnnouncement(finished);
      }
      return;
    }
    if (known.status !== 'streaming') return;
    known.status = turn.status;
    if (turn.status === 'aborted') setAnnouncement(t('conversation.answerStopped'));
    // Its alert says the failure; said here too, it would be heard twice.
    if (turn.status === 'failed') setAnnouncement('');
    if (turn.status !== 'complete') return;
    // One with no sources carries a warning in its card; «ferdig» alone would hide it.
    setAnnouncement(
      turn.noAnswer
        ? t('conversation.foundNothing')
        : turn.sources?.length === 0 && turn.text.trim()
          ? `${t('conversation.answerDone')} ${t('answer.noSources')}`
          : t('conversation.answerDone'),
    );
  }, [turns, loading]);

  // Progress is a new turn object for the answer on its way: a word, a step, a source. The line
  // shows after each long wait; the region says it once per answer.
  const [slowFor, setSlowFor] = useState<ConversationAnswer>();
  const slowSaid = useRef(new Set<string>());
  const stalled = useRef(onStalled);
  stalled.current = onStalled;
  useEffect(() => {
    if (!waiting) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (slowAfter !== false)
      timers.push(
        setTimeout(() => {
          setSlowFor(waiting);
          if (slowSaid.current.has(waiting.id)) return;
          slowSaid.current.add(waiting.id);
          setAnnouncement(t('conversation.slow'));
        }, slowAfter),
      );
    timers.push(setTimeout(() => stalled.current?.(waiting), stalledAfter));
    return () => timers.forEach(clearTimeout);
  }, [waiting, slowAfter, stalledAfter]);
  const slow = waiting !== undefined && slowFor === waiting;

  // The thread is read through a region that is already in the page: one that arrives with its
  // words was inserted, not changed, and says nothing. The timer makes the words a change.
  const reading = loading && turns.length === 0;
  const [noticeSaid, setNoticeSaid] = useState(false);
  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(() => setNoticeSaid(true));
    return () => clearTimeout(timer);
  }, [reading]);

  // One strip and one query: another answer starts a fresh search, not the last one's words.
  const [searching, setSearching] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hitIndex, setHitIndex] = useState(0);
  const answers = turns.filter((turn) => turn.kind === 'answer');
  const searched = search
    ? answers.find((turn) => turn.id === searching && turn.status === 'complete')
    : undefined;
  const visible = useMemo(() => (searched ? answerVisibleText(searched) : undefined), [searched]);
  const hits = useMemo(
    () => (searched && visible ? findHits([{ id: searched.id, text: visible.text }], query) : []),
    [searched, visible, query],
  );
  // An answer that changes under a standing query must not leave the reader past the end.
  const current = Math.min(hitIndex, Math.max(hits.length - 1, 0));
  const highlight: MarkdownHighlight | undefined =
    visible && hits.length
      ? {
          hits,
          offsets: visible.offsets,
          current: hits[current],
          markClassName: 'uib-conversation-mark',
        }
      : undefined;

  const searchedId = searched?.id;
  useEffect(() => {
    if (searchedId !== undefined) fieldRef.current?.focus();
  }, [searchedId]);

  // Moving to a hit is what scrolls, and only that: a new query lands on its first hit.
  useEffect(() => {
    if (searchedId === undefined || hits.length === 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('mark[data-current]')
        ?.scrollIntoView?.({ behavior: stillMotion() ? 'auto' : 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [searchedId, query, current, hits.length]);

  const closeSearch = () => {
    const was = searchedId;
    setSearching(null);
    setQuery('');
    setHitIndex(0);
    // The strip is gone, and a keyboard user in it would land at the top of the page.
    if (was !== undefined) toggles.current.get(was)?.focus();
  };
  const toggleSearch = (id: string) => {
    if (id === searchedId) return closeSearch();
    setSearching(id);
    setQuery('');
    setHitIndex(0);
  };

  // Held by identity: the answer scrolls to its footnote each time it gets a new target.
  const answerTarget = useMemo<AnswerTarget | undefined>(
    () =>
      target
        ? 'citation' in target
          ? { citation: target.citation }
          : { document: target.document }
        : undefined,
    [target],
  );

  const rowFor = (turn: ConversationAnswer): ReactNode => {
    const end = turn.createdAt === undefined ? null : <AnswerTime at={turn.createdAt} now={now} />;
    if (turn.status !== 'complete') return end ?? undefined;
    const searchButton = search ? (
      <Button
        ref={(element: HTMLButtonElement | null) => {
          if (element) toggles.current.set(turn.id, element);
          else toggles.current.delete(turn.id);
        }}
        variant="tertiary"
        data-size="sm"
        aria-expanded={turn.id === searchedId}
        onClick={() => toggleSearch(turn.id)}
      >
        <MagnifyingGlassIcon aria-hidden />
        {t('conversation.search')}
      </Button>
    ) : null;
    if (actions) return actions(turn, { end, search: searchButton });
    return end || searchButton ? (
      <>
        {searchButton}
        {end}
      </>
    ) : undefined;
  };

  // The corpus and the filter as two facts: in one list, «Kudos · Årsrapport · 2023» reads as
  // three things the reader chose. Nothing narrowed is not «avgrenset»: it was asked of all of it.
  const scopeWords = (scope: string | ConversationScope | undefined) => {
    if (scope === undefined || typeof scope === 'string') return scope;
    const values = (scope.narrowedTo ?? []).filter(Boolean).join(' · ');
    if (values && scope.corpus)
      return t('conversation.narrowedFrom', { values, corpus: scope.corpus });
    if (values) return t('conversation.narrowed', { values });
    return scope.corpus ? t('conversation.fetchedFrom', { corpus: scope.corpus }) : undefined;
  };

  const scopeLine = (scope: string | ConversationScope | undefined, said: string) => {
    const words = scopeWords(scope);
    return words ? (
      <p className="uib-conversation-scope">
        <span className="ds-sr-only">{said} </span>
        {words}
      </p>
    ) : null;
  };

  // A question nothing answered: a failed turn the store did not keep, as genki leaves it. It
  // says so, with «Generer på nytt», as kunnskapsassistenten draws a failed turn after a reload.
  const drawUnanswered = (question: ConversationQuestion) => {
    const standIn: ConversationAnswer = {
      kind: 'answer',
      id: `${question.id}:unanswered`,
      text: '',
      status: 'failed',
    };
    return (
      <li
        key={standIn.id}
        className="uib-conversation-turn ds-focus"
        data-kind="answer"
        data-unanswered="true"
        tabIndex={-1}
      >
        <Answer
          text=""
          status="failed"
          onRegenerate={onRegenerate && (() => regenerate(standIn, question))}
          assistantName={assistantName}
          headingLevel={headingLevel}
          color={answerColor}
        />
      </li>
    );
  };

  // The last question's answer may still come: «Hent på nytt» reads it again, asking nothing.
  const drawStillComing = (question: ConversationQuestion, fetchAgain: () => void) => (
    <li
      key={`${question.id}:still-coming`}
      className="uib-conversation-turn ds-focus"
      data-kind="answer"
      data-still-coming="true"
      tabIndex={-1}
    >
      <Card className="uib-answer" data-color={answerColor} data-plain={plain || undefined}>
        <Card.Block className="uib-answer-body">
          <Paragraph data-size="sm" variant="long" className="uib-answer-stopped">
            {t('conversation.stillComing')}
          </Paragraph>
        </Card.Block>
        <Card.Block>
          <div className="uib-answer-row">
            <Button variant="tertiary" data-size="sm" onClick={() => replacing(fetchAgain)}>
              <ArrowsCirclepathIcon aria-hidden />
              {t('conversation.fetchAgain')}
            </Button>
          </div>
        </Card.Block>
      </Card>
    </li>
  );

  const drawTurns = () =>
    turns.flatMap((turn, index) => {
      if (turn.kind !== 'question' || !unanswered(turns, index, pending || loading))
        return [drawTurn(turn, index)];
      if (onFetchAgain && index === turns.length - 1)
        return [drawTurn(turn, index), drawStillComing(turn, onFetchAgain)];
      return [drawTurn(turn, index), drawUnanswered(turn)];
    });

  const drawTurn = (turn: ConversationTurn, index: number) => {
    if (turn.kind === 'question')
      return (
        <li key={turn.id} className="uib-conversation-turn" data-kind="question">
          <span className="ds-sr-only">{t('conversation.youWrote')}</span>
          <Card className="uib-conversation-question" data-color={questionColor} variant="tinted">
            <Paragraph variant="long" lang={turn.lang}>
              {turn.text}
            </Paragraph>
            {/* Under the words and not over them: the words are what the reader wrote, the
                documents what they wrote it about. */}
            {turn.attachments?.length ? (
              <Paragraph data-size="sm" className="uib-conversation-attachments">
                {t('conversation.attachments', { names: turn.attachments.join(', ') })}
              </Paragraph>
            ) : null}
          </Card>
        </li>
      );

    const question = questionBefore(turns, index);
    if (turn.kind === 'clarification')
      return (
        <li key={turn.id} className="uib-conversation-turn" data-kind="clarification">
          {/* It searched with the filter before it asked, so the question back was narrowed too.
              Said as documents, since the line can be «Hentet fra Kudos», and the question was
              not fetched. */}
          {scopeLine(turn.scope, t('conversation.clarificationScope'))}
          {header?.(turn, question)}
          <Clarification
            text={turn.text}
            options={turn.options}
            onReply={onReply && ((option) => onReply(turn, option))}
            assistantName={assistantName}
            headingLevel={headingLevel}
            color={answerColor}
          />
        </li>
      );

    return (
      // Focusable from script only: where focus goes when the button it was on goes away.
      <li key={turn.id} className="uib-conversation-turn ds-focus" data-kind="answer" tabIndex={-1}>
        {answerLabel}
        {/* Over the card: a fact about the question, not part of the answer. */}
        {scopeLine(turn.scope, t('conversation.answerScope'))}
        {header?.(turn, question)}
        <Answer
          text={turn.text}
          status={turn.status}
          sources={turn.sources}
          markers={turn.markers}
          noAnswer={turn.noAnswer}
          onOpenCitation={
            onOpenCitation && ((citation, goal) => onOpenCitation(turn, citation, goal))
          }
          onOpenDocument={onOpenDocument && ((source) => onOpenDocument(turn, source))}
          onOpenExcerpt={onOpenExcerpt && ((goal) => onOpenExcerpt(turn, goal))}
          href={href && ((goal) => href(turn, goal))}
          citationId={citationId && ((citation) => citationId(turn, citation))}
          target={target?.turnId === turn.id ? answerTarget : undefined}
          highlight={turn.id === searchedId ? highlight : undefined}
          sourcesUsed={sourcesUsed}
          documentFootnotes={documentFootnotes}
          closingQuestion={closingQuestion}
          onRegenerate={onRegenerate && (() => regenerate(turn, question))}
          failure={turn.failure}
          actions={rowFor(turn)}
          assistantName={assistantName}
          headingLevel={headingLevel}
          color={answerColor}
          variant={answerVariant}
        />
      </li>
    );
  };

  const searchLabel = () => {
    if (answers.length < 2) return t('conversation.search');
    const n = answers.findIndex((turn) => turn.id === searchedId) + 1;
    return t('conversation.searchOf', { n, total: answers.length });
  };

  return (
    <div ref={rootRef} className={classes('uib-conversation', className)} data-color={color}>
      {/* The thread's name over the conversation, «lg» as kunnskapsassistenten's h2. */}
      {title?.trim() ? (
        <Heading
          level={titleLevel}
          data-size="lg"
          className={
            (titleRepeatsQuestion ??
            repeatsQuestion(title, turns.find((turn) => turn.kind === 'question')?.text))
              ? 'ds-sr-only'
              : 'uib-conversation-title'
          }
        >
          {title.trim()}
        </Heading>
      ) : null}
      {/* First, so the tab order meets the strip before the answer it searches. */}
      {searched ? (
        <AnswerSearch
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            setHitIndex(0);
          }}
          hitCount={hits.length}
          currentHitIndex={current}
          onStep={(step) => setHitIndex(stepHit(hits.length, current, step))}
          onClose={closeSearch}
          fieldRef={fieldRef}
          label={searchLabel()}
        />
      ) : null}
      {/* What is on screen wins over the outline: a question asked while the thread is read is
          the reader's own words, and an outline over it would take them away. */}
      {turns.length ? (
        <ol className="uib-conversation-turns" ref={listRef}>
          {drawTurns()}
        </ol>
      ) : reading ? (
        <ThreadLoading color={answerColor} />
      ) : null}
      {/* A line and not an alert: nothing has gone wrong yet, and «Avbryt» is still the way out. */}
      {slow ? (
        <Paragraph data-size="sm" variant="long" className="uib-conversation-slow">
          {t('conversation.slow')}
        </Paragraph>
      ) : null}
      <p aria-live="polite" className="ds-sr-only">
        {reading && noticeSaid ? t('conversation.loading') : announcement}
      </p>
    </div>
  );
};
