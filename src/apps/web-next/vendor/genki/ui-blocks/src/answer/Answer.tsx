import { Button, Card, Link, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { ArrowsCirclepathIcon, InformationSquareIcon } from '@navikt/aksel-icons';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  Markdown,
  type CiteRenderer,
  type MarkdownHighlight,
  type TableFacts,
} from '../markdown/Markdown.js';
import { documentKeys, readingOrder } from '../sources/pairing.js';
import { distinctNames, isOwn } from '../sources/Sources.js';
import type { SourceDocument, SourceTarget } from '../sources/types.js';
import { documentNumbers, readFootnotes, type AnswerMarker } from './citations.js';
import { useT } from './i18n.js';
import { SourcesUsed, type UsedDocument } from './SourcesUsed.js';

export type AnswerStatus = 'streaming' | 'complete' | 'aborted' | 'failed';

// TODO(QA-C2): take ErrorKind, isRetryable and the kinds' texts from the states block (#403)
// once it is in this stack, so there is one vocabulary. These mirror kunnskapsassistenten's
// errorText.ts until then.
/**
 * Why an answer failed, as far as the app can tell: the model, the search in the documents, the
 * time, the key, too many questions, a question too long, a filter the service refused, a thread
 * that is gone, or nothing it can name.
 */
export type AnswerFailureKind =
  | 'model'
  | 'search'
  | 'timeout'
  | 'access'
  | 'busy'
  | 'tooLong'
  | 'filter'
  | 'threadGone'
  | 'unknown';

export interface AnswerFailure {
  kind: AnswerFailureKind;
  /** The service's own sentence on what happened, in place of the block's. The advice stays. */
  message?: string | undefined;
}

/**
 * Whether asking again can help. The same question fails the same way with a refused key, a
 * question too long, a refused filter or a thread that is gone, and a button that cannot work is
 * worse than none.
 */
export const failureRetryable = (kind: AnswerFailureKind) =>
  kind !== 'access' && kind !== 'tooLong' && kind !== 'filter' && kind !== 'threadGone';

// At the end only, so «Prøv igjen senere» stays; no `\s*` in front, which made it quadratic.
const retryPrompt = /(?:Prøv igjen(?: om litt)?|Please try again|Try again)\s*(?:[.!…]+\s*)?$/iu;

/**
 * Where focus goes back to in the answer: a footnote, by its index in the answer's footnotes, or
 * a link in «Kilder brukt i svaret»: an excerpt's, by the excerpt it names (`chunkId`), or else
 * a title, by the document. Sources' `onReturn` leads back to whichever the reader followed.
 */
export type AnswerTarget = { citation: number } | { document: SourceTarget };

export interface AnswerProps {
  /** The answer as the service wrote it: Markdown, with `[N]` footnotes. */
  text: string;
  status?: AnswerStatus | undefined;
  /** The contract's `sources[]`. Without them, `[N]` stays text: they come with the answer's end. */
  sources?: readonly SourceDocument[] | undefined;
  /**
   * The contract's top-level `markers`, when the service cites excerpts. Footnotes are numbered
   * by excerpt only: without markers, `[N]` names a document, and no footnote is drawn for it.
   */
  markers?: readonly AnswerMarker[] | undefined;
  /** Footnotes that name documents drawn with each document's number, 1, 2, 3 by first citation. */
  documentFootnotes?: boolean | undefined;
  /** The text is the service's notice that it found nothing (`no_answer`), not an answer. */
  noAnswer?: boolean | undefined;
  /** A footnote was followed: its index in the answer's footnotes, and the item it cites. */
  onOpenCitation?: ((citation: number, target: SourceTarget) => void) | undefined;
  /** A document in «Kilder brukt i svaret» was chosen. */
  onOpenDocument?: ((source: SourceDocument) => void) | undefined;
  /** An excerpt in «Kilder brukt i svaret», «Utdrag 1», was chosen: the excerpt to show. */
  onOpenExcerpt?: ((target: SourceTarget) => void) | undefined;
  /** Where a footnote, a document or an excerpt leads, for a new tab and for copying. */
  href?: ((target: SourceTarget) => string | undefined) | undefined;
  /** An id for each footnote, so the app can find it. */
  citationId?: ((citation: number) => string) | undefined;
  /** The footnote to scroll to and focus: where Sources' `onShowUse` and `onReturn` lead. */
  target?: AnswerTarget | undefined;
  /** Search hits to mark in the text, found in the words the answer is drawn with. */
  highlight?: MarkdownHighlight | undefined;
  /** «Kilder brukt i svaret» under a finished answer. */
  sourcesUsed?: boolean | undefined;
  /** «Er det noe mer jeg kan hjelpe deg med?» under a finished answer. */
  closingQuestion?: boolean | undefined;
  /** Asks the same question again, offered under a stopped or failed answer. */
  onRegenerate?: (() => void) | undefined;
  /**
   * Why a failed answer failed. The card says what happened and what to do, and offers to ask
   * again only when that can help. Keep it with the turn, so a reload says the same.
   */
  failure?: AnswerFailure | undefined;
  /** The row under a finished answer, such as copying and feedback. */
  actions?: ReactNode;
  /** Who answered, for a screen reader. Without it, the AI assistant. */
  assistantName?: string | undefined;
  /** The level of the answer's own top heading; deeper ones follow. */
  headingLevel?: 2 | 3 | 4 | undefined;
  /** Designsystemet's `data-color` for the card, set only when given. */
  color?: string | undefined;
  /**
   * `plain`, the dev boards' answer (dev-kilder-hoyre): no card around it, and «Kilder brukt i
   * svaret» with the count in its bar, «Kilder · 3 brukt i svaret», as a numbered list of the
   * documents. `card`, the default: the answer in a card.
   */
  variant?: 'card' | 'plain' | undefined;
  className?: string | undefined;
}

type T = ReturnType<typeof useT>;

/** The case's heading, and what happened and what to do, as one paragraph. */
const failureText = (t: T, { kind, message }: AnswerFailure, name: string) => {
  const [title, what, advice] = ((): [string, string, string] => {
    switch (kind) {
      case 'model':
        return [t('answer.modelTitle'), t('answer.modelWhat'), t('answer.modelAdvice')];
      case 'search':
        return [
          t('answer.searchTitle'),
          t('answer.searchWhat', { name }),
          t('answer.searchAdvice'),
        ];
      case 'timeout':
        return [t('answer.timeoutTitle'), t('answer.timeoutWhat'), t('answer.timeoutAdvice')];
      case 'access':
        return [
          t('answer.accessTitle'),
          t('answer.accessWhat', { name }),
          t('answer.accessAdvice'),
        ];
      case 'busy':
        return [t('answer.busyTitle'), t('answer.busyWhat'), t('answer.busyAdvice')];
      case 'tooLong':
        return [t('answer.tooLongTitle'), t('answer.tooLongWhat'), t('answer.tooLongAdvice')];
      case 'filter':
        return [t('answer.filterTitle'), t('answer.filterWhat'), t('answer.filterAdvice')];
      case 'threadGone':
        return [
          t('answer.threadGoneTitle'),
          t('answer.threadGoneWhat'),
          t('answer.threadGoneAdvice'),
        ];
      default:
        return [t('answer.unknownTitle'), t('answer.unknownWhat'), t('answer.unknownAdvice')];
    }
  })();
  const own = message?.replace(retryPrompt, '').trim();
  return { title, text: `${own || what} ${advice}` };
};

/** Characters per skeleton line, not a length: Skeleton repeats that many dashes. */
const skeletonLines = [78, 86, 82, 48];

/** How many columns a table's name lists before it counts the rest. */
const namedColumns = 4;

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

const stillMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface FootnoteProps {
  citation: number;
  number: number;
  label: string;
  /** Undefined when the app gives the footnote nowhere to go. */
  href: string | undefined;
  id: string | undefined;
  onOpen: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  footnotes: Map<number, HTMLElement>;
}

// The excerpt's number in a round mark, as kunnskapsassistenten draws it, or with
// `documentFootnotes` the document's. A link named by what it cites and the document:
// a bare «[3]» tells a screen reader user nothing. The brackets stay in the text, out of sight,
// so a copied answer still reads «[1]». With nowhere to go, it is a mark and not a link, which
// would jump to the top of the page.
const Footnote = ({ citation, number, label, href, id, onOpen, footnotes }: FootnoteProps) => (
  <sup className="uib-answer-footnote">
    {href === undefined && onOpen === undefined ? (
      <span id={id} className="uib-answer-mark" role="img" aria-label={label} title={label}>
        <span className="uib-answer-copy">[</span>
        {number}
        <span className="uib-answer-copy">]</span>
      </span>
    ) : (
      <Link
        ref={(element: HTMLAnchorElement | null) => {
          if (element) footnotes.set(citation, element);
          else footnotes.delete(citation);
        }}
        id={id}
        className="uib-answer-mark"
        href={href ?? '#'}
        aria-label={label}
        title={label}
        onClick={onOpen}
      >
        <span className="uib-answer-copy">[</span>
        {number}
        <span className="uib-answer-copy">]</span>
      </Link>
    )}
  </sup>
);

const Lost = ({ n }: { n: number }) => {
  const t = useT();
  return (
    <sup className="uib-answer-lost" title={t('answer.sourceLost')}>
      [{n}]<span className="ds-sr-only"> {t('answer.sourceLostNote')}</span>
    </sup>
  );
};

export const AnswerSkeleton = () => (
  <div aria-hidden="true" className="uib-answer-skeleton">
    {skeletonLines.map((characters) => (
      <p key={characters} className="uib-answer-skeleton-line">
        <Skeleton variant="text" width={characters} />
      </p>
    ))}
  </div>
);

/**
 * One answer: its text with footnotes, and what a reader can do with it. Each footnote leads to
 * the one excerpt it cites, and Sources leads back to it, from the same pairing. Only excerpts
 * are numbered, in the order the answer first cites them; a document is named by its title, and
 * an answer whose footnotes name only documents draws none, unless `documentFootnotes`.
 */
export const Answer = ({
  text,
  status = 'complete',
  sources,
  markers,
  documentFootnotes = false,
  noAnswer = false,
  onOpenCitation,
  onOpenDocument,
  onOpenExcerpt,
  href,
  citationId,
  target,
  highlight,
  sourcesUsed = true,
  closingQuestion = false,
  onRegenerate,
  failure,
  actions,
  assistantName,
  headingLevel = 3,
  color,
  variant = 'card',
  className,
}: AnswerProps) => {
  const t = useT();
  const f = useFormat();
  const footnotes = useRef(new Map<number, HTMLElement>());
  const empty = text.trim() === '';
  const streaming = status === 'streaming';
  const complete = status === 'complete';
  const aborted = status === 'aborted';
  const failed = status === 'failed';
  const retryRef = useRef<HTMLButtonElement>(null);

  // An answer seen on its way: a failure that ends it is news, and is said. One read back failed
  // from the store is not, and is only shown.
  const [live, setLive] = useState(streaming);
  if (streaming && !live) setLive(true);

  // Focus goes to «Prøv igjen» only if it was lost, a frame later, when the control the reader
  // pressed has gone; anywhere else, it stays where the reader put it.
  useEffect(() => {
    if (!failed || !live) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active === null || active === document.body) retryRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [failed, live]);

  const read = useMemo(() => readFootnotes(text, sources, markers), [text, sources, markers]);
  const { pairing } = read;
  const byExcerpt = pairing.mode === 'excerpt';
  const keys = useMemo(() => documentKeys(sources ?? []), [sources]);
  const byDocument = useMemo(
    () => (documentFootnotes ? documentNumbers(pairing) : new Map<string, number>()),
    [documentFootnotes, pairing],
  );
  // The titles in «Kilder brukt i svaret», by document key, and its excerpt links, by chunk id,
  // for a way back to one of them.
  const usedLinks = useRef(new Map<string, HTMLElement>());
  const excerptLinks = useRef(new Map<string, HTMLElement>());
  const keyOf = (goal: SourceTarget) => {
    const at = (sources ?? []).findIndex(
      (s) =>
        (goal.documentId !== undefined && s.documentId === goal.documentId) ||
        (goal.documentId === undefined && goal.index !== undefined && s.index === goal.index),
    );
    return at < 0 ? undefined : keys[at];
  };
  const names = useMemo(
    () =>
      distinctNames(sources ?? [], (title, id) => t('sources.sameTitle', { title, id })).map(
        (name) => name || t('sources.untitled'),
      ),
    [sources, t],
  );

  // The document a numbered excerpt is in, by its chunk id.
  const documentOf = (chunkId: string) => {
    const at = (sources ?? []).findIndex((s) => s.excerpts.some((e) => e.chunkId === chunkId));
    return at < 0 ? undefined : at;
  };

  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const element =
        'citation' in target
          ? footnotes.current.get(target.citation)
          : ((target.document.chunkId === undefined
              ? undefined
              : excerptLinks.current.get(target.document.chunkId)) ??
            usedLinks.current.get(keyOf(target.document) ?? ''));
      // Centred, so the sentence the footnote ends is in view above it.
      element?.scrollIntoView?.({ behavior: stillMotion() ? 'auto' : 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);

  // What a footnote is drawn as: an excerpt's number, or with `documentFootnotes` its document's.
  const footnoteOf = (citation: number) => {
    const item = pairing.targets[citation];
    if (item === undefined) return undefined;
    const number = byExcerpt ? pairing.numbers.get(item) : byDocument.get(item);
    const at = byExcerpt ? documentOf(item) : keys.indexOf(item);
    const source = at === undefined || at < 0 ? undefined : sources?.[at];
    if (number === undefined || at === undefined || !source) return undefined;
    const title = names[at] ?? source.title;
    const goal: SourceTarget = {
      ...(byExcerpt ? { chunkId: item } : {}),
      documentId: source.documentId,
      index: source.index,
    };
    const label = byExcerpt
      ? t('answer.footnote', { n: number, title })
      : t('answer.footnoteDocument', { n: number, title });
    return { number, goal, label };
  };

  const cite: CiteRenderer = (n, key) => {
    const mark = read.marks.get(key);
    if (mark?.kind === 'dropped') return false;
    if (mark?.kind === 'footnote') {
      // A footnote that names only a document has no number without `documentFootnotes`.
      const drawn = footnoteOf(mark.citation);
      if (!drawn) return false;
      return (
        <Footnote
          key={key}
          citation={mark.citation}
          number={drawn.number}
          label={drawn.label}
          href={href?.(drawn.goal)}
          id={citationId?.(mark.citation)}
          onOpen={
            onOpenCitation
              ? (event) => {
                  // The app moves to the item; following the address could reload its route.
                  event.preventDefault();
                  onOpenCitation(mark.citation, drawn.goal);
                }
              : undefined
          }
          footnotes={footnotes.current}
        />
      );
    }
    // A stopped answer wrote its footnotes before the sources came: each says why it leads nowhere.
    return aborted && n < 1000 ? <Lost key={key} n={n} /> : undefined;
  };

  const tableName = ({ number, count, columns }: TableFacts) => {
    const table = count > 1 ? t('answer.tableNumber', { n: number }) : t('answer.table');
    if (columns.length === 0) return table;
    const named = columns.slice(0, namedColumns);
    const more = columns.length - named.length;
    return t('answer.tableColumns', {
      count: columns.length,
      table,
      columns: f.list(more > 0 ? [...named, t('answer.moreColumns', { more })] : named),
    });
  };

  // Every document the answer cites, in the order Sources shows them, from the same reading order:
  // by their numbers, 1, 2, 3. Its cited excerpts go under its title, by number; a document cited
  // only as a whole has none. Read again only when they change: a streaming answer renders many
  // times a second.
  const used = useMemo((): UsedDocument[] => {
    const order = readingOrder(sources ?? [], pairing);
    // With document footnotes, in the order of their numbers, so the list's 1, 2, 3 are the marks'.
    const documents = byDocument.size
      ? order.documents.toSorted(
          (a, b) => (byDocument.get(keys[a] ?? '') ?? 0) - (byDocument.get(keys[b] ?? '') ?? 0),
        )
      : order.documents;
    return documents.flatMap((i) => {
      const source = sources?.[i];
      if (!source) return [];
      const key = keys[i] ?? `@${i}`;
      const excerpts = byExcerpt
        ? (order.excerpts[i] ?? []).flatMap((e) => {
            const n = pairing.numbers.get(e.chunkId);
            return n === undefined ? [] : [{ n, chunkId: e.chunkId }];
          })
        : [];
      const cited = byExcerpt ? excerpts.length > 0 : pairing.uses.has(key);
      return cited
        ? [{ key, source, name: names[i] ?? source.title, own: isOwn(source), excerpts }]
        : [];
    });
  }, [sources, pairing, byExcerpt, byDocument, keys, names]);

  const told =
    failed && failure ? failureText(t, failure, assistantName ?? t('answer.assistant')) : undefined;
  const again =
    (aborted || failed) &&
    onRegenerate !== undefined &&
    (!failed || !failure || failureRetryable(failure.kind));
  const finished = complete && !empty && !noAnswer;
  // Exactly the answers with nothing behind them. Unknown sources say nothing, and footnotes
  // with no sources are sources lost, not an answer without any.
  const unsourced = finished && sources !== undefined && sources.length === 0 && read.written === 0;
  // A failed turn with nothing in it gets no card; a stopped one does, since it says so.
  if (empty && !streaming && !aborted && !failed) return null;

  return (
    <Card
      className={classes('uib-answer', className)}
      data-color={color}
      // Not `data-variant`, which is the card's own (`default`, `tinted`).
      data-plain={variant === 'plain' || undefined}
    >
      <Card.Block className="uib-answer-body">
        <span className="ds-sr-only">
          {assistantName ? t('answer.said', { name: assistantName }) : t('answer.saidUnnamed')}
        </span>
        {empty && streaming ? <AnswerSkeleton /> : null}
        {unsourced ? (
          <Paragraph data-size="sm" className="uib-answer-note">
            <InformationSquareIcon aria-hidden className="uib-answer-note-icon" />
            {t('answer.noSources')}
          </Paragraph>
        ) : null}
        {/* A failed answer's text is not an answer: genki streams its own error message as text
            before the failure, in English, for developers. The card says the failure itself. */}
        {empty || failed ? null : (
          <Markdown
            text={text}
            cite={cite}
            className="uib-markdown uib-answer-text"
            headingLevel={headingLevel}
            tableName={tableName}
            highlight={highlight}
          />
        )}
        {/* The app's live region says it in words, so this line is for the eye. */}
        {streaming && !empty ? (
          <p aria-hidden="true" className="uib-answer-writing">
            <Spinner aria-hidden="true" data-size="xs" />
            {t('answer.writing')}
          </p>
        ) : null}
        {aborted ? (
          <Paragraph data-size="sm" variant="long" className="uib-answer-stopped">
            {empty ? t('answer.abortedBeforeAnswer') : t('answer.aborted')}
          </Paragraph>
        ) : null}
        {/* In the page while the answer comes, so a failure that ends it is announced: an alert
            says only what appears inside one already there. Out of flow while empty. */}
        {streaming || failed ? (
          <div role={live ? 'alert' : undefined} className="uib-answer-failure">
            {failed && told ? (
              <>
                <Paragraph data-size="sm" className="uib-answer-failure-title">
                  <strong>{told.title}</strong>
                </Paragraph>
                <Paragraph data-size="sm" variant="long" className="uib-answer-stopped">
                  {told.text}
                </Paragraph>
              </>
            ) : failed ? (
              <Paragraph data-size="sm" variant="long" className="uib-answer-stopped">
                {t('answer.failed')}
              </Paragraph>
            ) : null}
          </div>
        ) : null}
        {finished && sourcesUsed ? (
          <SourcesUsed
            documents={used}
            href={href}
            onOpenDocument={onOpenDocument}
            onOpenExcerpt={onOpenExcerpt}
            links={usedLinks.current}
            excerptLinks={excerptLinks.current}
            counted={variant === 'plain'}
          />
        ) : null}
        {finished && closingQuestion ? (
          <Paragraph variant="long">{t('answer.closingQuestion')}</Paragraph>
        ) : null}
      </Card.Block>
      {(complete && !empty && actions) || ((aborted || failed) && (again || actions)) ? (
        <Card.Block>
          {/* The answer's own row. `uib-answer-actions` is the answer actions block's class. */}
          <div className="uib-answer-row">
            {again ? (
              <Button ref={retryRef} variant="tertiary" data-size="sm" onClick={onRegenerate}>
                <ArrowsCirclepathIcon aria-hidden />
                {told ? t('answer.retry') : t('answer.regenerate')}
              </Button>
            ) : null}
            {actions ? <div className="uib-answer-row-slot">{actions}</div> : null}
          </div>
        </Card.Block>
      ) : null}
    </Card>
  );
};
