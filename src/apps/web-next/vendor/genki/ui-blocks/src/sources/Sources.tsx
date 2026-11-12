import { Button, Card, Heading, Link, Paragraph, Skeleton } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  InformationSquareIcon,
} from '@navikt/aksel-icons';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Markdown, visibleText } from '../markdown/Markdown.js';
import {
  findHits,
  hitsFor,
  stepHit,
  type SearchableItem,
  type SearchHit,
} from '../markdown/textSearch.js';
import { excerptMarkdown, headingText } from './excerptMarkdown.js';
import { useT } from './i18n.js';
import {
  documentKeys,
  pairCitations,
  readingOrder,
  type Pairing,
  type ReadingOrder,
  type SourceCitation,
} from './pairing.js';
import { SourcesSearch } from './SourcesSearch.js';
import type { SourceDocument, SourceExcerpt, SourceSelection, SourceTarget } from './types.js';

/**
 * `panel`, kunnskapsassistenten's «Kilder»; `compact`, tighter; `tool`, the dev boards' «Kilder»
 * tool (dev-kilder-hoyre): the search «Søk i utdragene» with its caption, «Utdrag svaret bygger
 * på», each excerpt titled by its section where it has one, and its closed text fading out.
 */
export type SourcesVariant = 'panel' | 'compact' | 'tool';

/** What became of the answer the sources belong to, or `unasked` before the first question. */
export type SourcesAnswerStatus =
  'unasked' | 'streaming' | 'complete' | 'aborted' | 'failed' | 'clarification';

export interface SourcesProps {
  sources?: readonly SourceDocument[] | undefined;
  /** What became of the answer, so an empty panel says why; `streaming` until sources come. */
  answerStatus?: SourcesAnswerStatus | undefined;
  /** The app's store keeps no sources with a turn, so an empty list is not known to mean none. */
  sourcesNotStored?: boolean | undefined;
  /** Who answers, for the state after a question back. Without it, the AI assistant. */
  assistantName?: string | undefined;
  /** Which of the thread's answers these sources are for, from 0, when it has several. */
  answerIndex?: number | undefined;
  /** How many answers the thread has. From two, the block steps between them. */
  answerCount?: number | undefined;
  /** The reader stepped to another answer: its index. The app passes that answer's sources. */
  onAnswerChange?: ((index: number) => void) | undefined;
  /** The answer's footnotes in order; excerpts are numbered only when every footnote names one. */
  citations?: readonly SourceCitation[] | undefined;
  /** A link back to the answer was followed: that footnote's index in `citations`. */
  onShowUse?: ((citation: number, selection: SourceSelection) => void) | undefined;
  /** Where a link back to footnote `citation` leads, such as `#` and the answer's `citationId`. */
  citationHref?: ((citation: number) => string | undefined) | undefined;
  loading?: boolean | undefined;
  variant?: SourcesVariant | undefined;
  title?: ReactNode | false | undefined;
  /** Designsystemet's `data-color` for the block and for its card heads, set only when given. */
  color?: string | undefined;
  headerColor?: string | undefined;
  /** What the documents' collection is called, for the disclaimer and the links. */
  corpus?: string | undefined;
  disclaimer?: boolean | undefined;
  disclaimerId?: string | undefined;
  hasOwnDocuments?: boolean | undefined;
  search?: boolean | undefined;
  documentsClosed?: boolean | undefined;
  headingLevel?: 2 | 3 | 4 | 5 | undefined;
  /** Back to the footnote the reader followed. */
  onReturn?: (() => void) | undefined;
  onTargetMissing?: ((target: SourceTarget) => void) | undefined;
  /** Shows each document's ids and chunks behind an info control. */
  details?: boolean | undefined;
  itemId?: ((source: SourceDocument, position: number) => string) | undefined;
  excerptId?: ((excerpt: SourceExcerpt, source: SourceDocument) => string) | undefined;
  target?: SourceTarget | undefined;
  onSelect?: ((selection: SourceSelection) => void) | undefined;
  excerptActions?: ((selection: Required<SourceSelection>) => ReactNode) | undefined;
  sourceActions?: ((source: SourceDocument) => ReactNode) | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

interface Row {
  key: string;
  text: string;
  excerpt?: SourceExcerpt;
  /** The words the quote is drawn as, for the search. */
  flat: string;
  offsets: number[];
}

interface Prepared {
  source: SourceDocument;
  key: string;
  name: string;
  id: string | undefined;
  rows: Row[];
}

type Level = 2 | 3 | 4 | 5 | 6;

const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** A «Les side N» link is drawn only where the address opens that page. */
export const reachesPage = (url: string, page: number) => url.endsWith(`#page=${page}`);

/** Whether the reader asks for less motion, so a scroll jumps rather than glides. */
export const prefersStill = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const qualifier = (id: string | undefined) => (id?.includes('::') ? id.split('::')[0] : undefined);

export const isOwn = (source: SourceDocument) =>
  source.documentId?.startsWith('attached:') ?? false;

export const sourceDataset = (source: SourceDocument) =>
  qualifier(source.documentId) ?? qualifier(source.excerpts[0]?.chunkId);

const holds = (source: SourceDocument, target: SourceTarget) =>
  target.chunkId !== undefined && source.excerpts.some((e) => e.chunkId === target.chunkId);

/** A footnote that names an excerpt lands only on that excerpt; a broken pair moves nothing. */
export const targetPosition = (
  sources: readonly SourceDocument[],
  target: SourceTarget | undefined,
) => {
  if (!target) return -1;
  if (target.chunkId !== undefined) return sources.findIndex((s) => holds(s, target));
  const byDocument =
    target.documentId === undefined
      ? -1
      : sources.findIndex((s) => s.documentId === target.documentId);
  if (byDocument >= 0) return byDocument;
  return target.index === undefined ? -1 : sources.findIndex((s) => s.index === target.index);
};

const titleKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb');

/** Each document's name, with its id after it when another document has the same title. */
export const distinctNames = (
  sources: readonly SourceDocument[],
  name: (title: string, id: string) => string,
) => {
  const counts = new Map<string, number>();
  for (const source of sources.filter((s) => !isOwn(s)))
    counts.set(titleKey(source.title), (counts.get(titleKey(source.title)) ?? 0) + 1);
  return sources.map((source) =>
    !isOwn(source) && source.documentId && (counts.get(titleKey(source.title)) ?? 0) > 1
      ? name(source.title.trim(), source.documentId.split('::').at(-1) ?? source.documentId)
      : source.title.trim(),
  );
};

const prepare = (
  sources: readonly SourceDocument[],
  order: ReadingOrder,
  name: (title: string, id: string) => string,
  itemId: SourcesProps['itemId'],
): Prepared[] => {
  const keys = documentKeys(sources);
  const names = distinctNames(sources, name);
  return sources.map((source, i) => {
    const key = keys[i] ?? `@${i}`;
    const passages: { text: string; excerpt?: SourceExcerpt }[] = source.excerpts.length
      ? (order.excerpts[i] ?? source.excerpts).map((excerpt) => ({
          text: excerptMarkdown(excerpt.text),
          excerpt,
        }))
      : [{ text: excerptMarkdown(source.excerpt ?? '') }].filter((p) => p.text);
    const rows = passages.map((passage, j): Row => {
      const quote = passage.excerpt?.textUnavailable ? '' : passage.text;
      const visible = quote ? visibleText(quote, false) : { text: '', offsets: [] };
      return {
        ...passage,
        key: passage.excerpt?.chunkId ?? `${key}#${j}`,
        flat: visible.text,
        offsets: visible.offsets,
      };
    });
    return { source, key, name: names[i] ?? '', id: itemId?.(source, i), rows };
  });
};

/** The section an excerpt is from: the last step of its heading path. */
export const sectionOf = (path: string | undefined) => path?.split(' › ').at(-1);

/** What the links back to the answer need beyond an item's uses. */
export interface BackTo {
  /** The answer's number, from 1, when the thread has several. */
  answer: number | undefined;
  href: ((citation: number) => string | undefined) | undefined;
  onShow: ((citation: number) => void) | undefined;
}

/** «Utdrag N» and one link back to each footnote that cites the excerpt, in answer order. */
export const ExcerptNumber = ({
  n,
  label,
  uses,
  back,
}: {
  n: number;
  label: string;
  uses: readonly number[];
  back: BackTo | undefined;
}) => {
  const t = useT();
  if (!back || uses.length === 0)
    return <span className="uib-sources-excerpt-number">{label}</span>;
  const { answer, href, onShow } = back;
  const ordinals = t('sources.ordinals').split('|');
  const name = (place: number) => {
    const shown = place + 1;
    if (uses.length === 1)
      return answer === undefined
        ? t('sources.useOnce', { shown, n })
        : t('sources.useOnceInAnswer', { shown, n, answer });
    const ordinal = ordinals[place] ?? `${shown}.`;
    return answer === undefined
      ? t('sources.usePlace', { shown, n, place: ordinal })
      : t('sources.usePlaceInAnswer', { shown, n, place: ordinal, answer });
  };
  return (
    <span className="uib-sources-excerpt-line">
      <span className="uib-sources-excerpt-number">{label}</span>
      <span className="uib-sources-uses">
        {uses.map((citation, place) => (
          // Named by `aria-label`: hidden spans in a link make a browser read «1 , fotnote 2».
          <Link
            key={citation}
            href={href?.(citation) ?? '#'}
            className="uib-sources-use"
            aria-label={name(place)}
            onClick={
              onShow
                ? (event: MouseEvent<HTMLAnchorElement>) => {
                    // The app moves to the footnote; following the address could reload its route.
                    event.preventDefault();
                    onShow(citation);
                  }
                : undefined
            }
          >
            {place + 1}
          </Link>
        ))}
      </span>
    </span>
  );
};

/** An excerpt's title: «Utdrag N», links back and section when cited; else section or «Utdrag». */
export const ExcerptTitle = ({
  id,
  level,
  className,
  n,
  section,
  uses,
  back,
  sectionFirst,
}: {
  id?: string | undefined;
  level: number;
  className: string;
  /** Its «Utdrag N» number, when the answer cites it. */
  n: number | undefined;
  section: string | undefined;
  uses: readonly number[];
  back: BackTo | undefined;
  /**
   * The section is the title, in the number's place, with the links back after it: the dev
   * boards' excerpt (dev-kilder-hoyre). Without a section, «Utdrag N» as before.
   */
  sectionFirst?: boolean | undefined;
}) => {
  const t = useT();
  const number = n === undefined ? undefined : t('sources.excerptNumber', { n });
  const bySection = sectionFirst && section !== undefined;
  return (
    <Heading
      id={id}
      level={level as Level}
      data-size="2xs"
      className={className}
      // Named by what it says: a browser reads the number's line without its colon.
      aria-label={number && (section ? `${number}: ${section}` : number)}
    >
      {n === undefined || !number ? null : (
        <ExcerptNumber n={n} label={bySection ? section : number} uses={uses} back={back} />
      )}
      {section && !(bySection && n !== undefined) ? <span>{section}</span> : null}
      {!section && n === undefined ? t('sources.excerptUnnumbered') : null}
    </Heading>
  );
};

/** What a link or a button names an excerpt: «utdrag 2», «utdrag fra Ressursbruk» or «utdrag». */
export const useExcerptName = () => {
  const t = useT();
  return (n: number | undefined, section: string | undefined) =>
    n !== undefined
      ? t('sources.excerptName', { n })
      : section
        ? t('sources.excerptNameSection', { section })
        : t('sources.excerptNameUnnumbered');
};

/** «Les side N på Kudos», named in one piece: a hidden box would add a space before a comma. */
export const PageLink = ({
  href,
  page,
  name,
  title,
  corpus,
  className,
}: {
  href: string;
  page: number;
  /** The excerpt, as `useExcerptName` calls it. */
  name: string;
  /** The document's title. */
  title: string;
  corpus: string | undefined;
  className: string;
}) => {
  const t = useT();
  const read = corpus ? t('sources.readPageOn', { page, corpus }) : t('sources.readPage', { page });
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-size="sm"
      className={className}
      aria-label={`${read}, ${name}, ${title} ${t('sources.opensInNewTab')}`}
    >
      {/* The words in a span, so Designsystemet sets the icon off from them. */}
      <span>{read}</span>
      <ExternalLinkIcon aria-hidden />
    </Link>
  );
};

/** «Kilder til svar 2 av 3»; `aria-disabled` at the ends keeps focus on the button pressed. */
const AnswerSwitcher = ({
  label,
  index,
  count,
  onChange,
}: {
  label: string;
  index: number;
  count: number;
  onChange: (index: number) => void;
}) => {
  const t = useT();
  const atFirst = index <= 0;
  const atLast = index >= count - 1;
  return (
    <div className="uib-sources-answers">
      <Paragraph aria-hidden="true" data-size="xs" className="uib-sources-answers-count">
        {label}
      </Paragraph>
      <div className="uib-sources-answers-steps">
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label={t('sources.previousAnswer')}
          aria-disabled={atFirst || undefined}
          onClick={() => !atFirst && onChange(index - 1)}
        >
          {t('sources.previous')}
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label={t('sources.nextAnswer')}
          aria-disabled={atLast || undefined}
          onClick={() => !atLast && onChange(index + 1)}
        >
          {t('sources.next')}
        </Button>
      </div>
    </div>
  );
};

type EmptyKind =
  'unasked' | 'none' | 'aborted' | 'failed' | 'clarification' | 'notStored' | 'notKept';

/** Why an answer has no sources; from a store that keeps none, they are unknown, not empty. */
const emptyKind = (
  status: SourcesAnswerStatus | undefined,
  citationCount: number,
  sourcesNotStored: boolean,
): EmptyKind => {
  if (status === 'unasked' || status === 'aborted' || status === 'failed') return status;
  if (status === 'clarification') return 'clarification';
  if (citationCount > 0) return 'notStored';
  return sourcesNotStored ? 'notKept' : 'none';
};

/** A normal state, not an error: no alert, and nothing announced. */
const EmptyState = ({
  kind,
  level,
  corpus,
  assistantName,
}: {
  kind: EmptyKind;
  level: number;
  corpus: string | undefined;
  assistantName: string | undefined;
}) => {
  const t = useT();
  const quote = corpus ? t('sources.unaskedQuote', { corpus }) : t('sources.unaskedQuoteNoCorpus');
  const [title, description] = (() => {
    switch (kind) {
      case 'unasked':
        return [t('sources.unaskedTitle'), [t('sources.unasked'), quote].filter(Boolean).join(' ')];
      case 'aborted':
        return [t('sources.abortedTitle'), t('sources.aborted')];
      case 'failed':
        return [t('sources.failedTitle'), t('sources.failed')];
      case 'clarification':
        return [
          assistantName
            ? t('sources.clarificationTitle', { name: assistantName })
            : t('sources.clarificationTitleUnnamed'),
          t('sources.clarification'),
        ];
      case 'notStored':
        return [t('sources.notStoredTitle'), t('sources.notStored')];
      case 'notKept':
        return [t('sources.notStoredTitle'), t('sources.notKept')];
      default:
        return [t('sources.noneTitle'), t('sources.none')];
    }
  })();
  return (
    <div className="uib-sources-empty" data-kind={kind}>
      <Heading level={level as Level} data-size="2xs">
        {title}
      </Heading>
      <Paragraph data-size="sm" variant="long">
        {description}
      </Paragraph>
    </div>
  );
};

/** A document's subtitle: the host's, the own-document line, or collection, date and version. */
export const useSourceSubtitle = (source: SourceDocument): string => {
  const t = useT();
  const f = useFormat();
  const published = source.publishedAt ? new Date(source.publishedAt) : undefined;
  const meta = source.meta?.filter(Boolean) ?? [];
  if (meta.length) return meta.join(' · ');
  if (isOwn(source)) return t('sources.ownDocument');
  return [
    sourceDataset(source),
    published && !Number.isNaN(published.getTime())
      ? t('sources.published', { date: f.date(published, 'long') })
      : undefined,
    source.version ? t('sources.version', { version: source.version }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

/** «Les dokumentet på Kudos» in a new tab, or why there is no link to the document. */
export const DocumentLink = ({
  source,
  title,
  corpus,
  onFollow,
  linkClassName,
  noLinkClassName,
}: {
  source: SourceDocument;
  title: string;
  corpus: string | undefined;
  onFollow?: (() => void) | undefined;
  linkClassName: string;
  noLinkClassName: string;
}) => {
  const t = useT();
  if (isOwn(source) || !source.url)
    return (
      <Paragraph data-size="xs" className={noLinkClassName}>
        {isOwn(source) ? t('sources.ownDocumentNoLink') : t('sources.noPublicLink')}
      </Paragraph>
    );
  const readDocument = corpus ? t('sources.readDocumentOn', { corpus }) : t('sources.readDocument');
  return (
    // Named in one piece: a hidden box after the words makes a browser read a space before a comma.
    <Link
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      data-size="sm"
      className={linkClassName}
      onClick={onFollow}
      aria-label={`${readDocument}, ${title} ${t('sources.opensInNewTab')}`}
    >
      {/* The words in a span, so Designsystemet sets the icon off from them. */}
      <span>{readDocument}</span>
      <ExternalLinkIcon aria-hidden />
    </Link>
  );
};

const BackButton = ({ onClick }: { onClick: () => void }) => {
  const t = useT();
  return (
    <Button variant="tertiary" data-size="sm" className="uib-sources-back" onClick={onClick}>
      <ArrowLeftIcon aria-hidden />
      {t('sources.backToAnswer')}
    </Button>
  );
};

type ItemProps = Pick<
  SourcesProps,
  | 'details'
  | 'target'
  | 'onSelect'
  | 'excerptActions'
  | 'sourceActions'
  | 'corpus'
  | 'onReturn'
  | 'headerColor'
  | 'excerptId'
> & {
  document: Prepared;
  level: number;
  pairing: Pairing | undefined;
  /** The links back to the answer, when the app takes them. */
  back:
    | (Omit<BackTo, 'onShow'> & {
        show: ((citation: number, selection: SourceSelection) => void) | undefined;
      })
    | undefined;
  openRows: ReadonlySet<string>;
  onRowOpenChange: (key: string, open: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Document mode: whether the document's passages, which nothing cites alone, are shown. */
  passagesOpen: boolean;
  onPassagesOpenChange: (open: boolean) => void;
  rowRefs: Map<string, HTMLElement>;
  /** The targets already followed, by identity, kept by `Sources` across a card's remount. */
  applied: WeakSet<SourceTarget>;
  hits: readonly SearchHit[];
  currentHit: SearchHit | undefined;
  /**
   * The `tool` variant: an excerpt is titled by its section where it has one, and a document's
   * excerpts stand in the card even when the footnotes name only documents, as the board draws.
   */
  sectionFirst: boolean;
};

const SourceItem = ({
  document: { source, key: documentKey, name: given, id, rows },
  level,
  pairing,
  openRows,
  onRowOpenChange,
  open,
  onOpenChange,
  passagesOpen,
  onPassagesOpenChange,
  rowRefs,
  applied,
  hits,
  currentHit,
  sectionFirst,
  details,
  target,
  onSelect,
  excerptActions,
  sourceActions,
  corpus,
  onReturn,
  headerColor,
  excerptId,
  back,
}: ItemProps) => {
  const t = useT();
  const detailsId = useId();
  const bodyId = useId();
  const rowId = useId();
  const card = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLButtonElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focus, setFocus] = useState<SourceTarget>();
  const title = given || t('sources.untitled');
  const active = target?.chunkId && holds(source, target) ? target.chunkId : undefined;
  const byExcerpt = pairing?.mode === 'excerpt';
  // Footnotes that name only documents number nothing; the passages wait behind a button.
  const byDocument = pairing?.mode === 'document';
  const documentUncited = byDocument && !pairing.uses.has(documentKey);
  const passagesId = useId();
  const backFor = (excerpt: SourceExcerpt): BackTo | undefined =>
    back && {
      ...back,
      onShow: back.show && ((citation) => back.show?.(citation, { source, excerpt })),
    };

  useEffect(() => {
    // Once per target: new sources remount every card, and a held target must not move focus.
    if (!target || applied.has(target)) return;
    applied.add(target);
    if (target.chunkId && holds(source, target)) {
      onRowOpenChange(target.chunkId, true);
      if (byDocument) onPassagesOpenChange(true);
    }
    onOpenChange(true);
    setFocus(target);
  }, [target]);

  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const chunk = focus.chunkId ? rowRefs.get(focus.chunkId) : undefined;
      const element = chunk ?? card.current;
      element?.scrollIntoView?.({ behavior: prefersStill() ? 'auto' : 'smooth', block: 'start' });
      (chunk ?? head.current ?? card.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const subtitle = useSourceSubtitle(source);
  const actions = sourceActions?.(source);
  const excerptName = useExcerptName();
  // A document's passages, which nothing cites alone, behind one button in document mode.
  const passages = (drawn: ReactNode[]) =>
    byDocument && drawn.length && !sectionFirst ? (
      <>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          className="uib-sources-passages-toggle"
          aria-expanded={passagesOpen}
          aria-controls={passagesId}
          onClick={() => onPassagesOpenChange(!passagesOpen)}
        >
          {passagesOpen
            ? t('sources.hidePassages', { count: drawn.length })
            : t('sources.showPassages', { count: drawn.length })}
          <ChevronDownIcon aria-hidden className="uib-sources-caret" />
        </Button>
        <div id={passagesId} className="uib-sources-passages" hidden={!passagesOpen}>
          {drawn}
        </div>
      </>
    ) : (
      drawn
    );
  const landed = target !== undefined && target.chunkId === undefined && onReturn !== undefined;
  const leaveCard = landed
    ? (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onReturn?.();
      }
    : undefined;

  return (
    // Not `Card`, which sends any click to a heading's first link; Escape works after a footnote.
    <div
      ref={card}
      className="ds-card uib-sources-document ds-focus"
      id={id}
      tabIndex={-1}
      onKeyDown={leaveCard}
    >
      <Card.Block className="uib-sources-document-head" data-color={headerColor}>
        {/* The heading stays a heading, and the button inside it is the whole band to press. */}
        <Heading level={level as Level} data-size="xs">
          <button
            ref={head}
            type="button"
            className="uib-sources-document-toggle ds-focus"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => onOpenChange(!open)}
          >
            <span>{title}</span>
            <ChevronDownIcon aria-hidden className="uib-sources-caret" />
          </button>
        </Heading>
        {details || actions ? (
          <div className="uib-sources-controls">
            {details ? (
              <Button
                variant="tertiary"
                data-size="sm"
                icon
                aria-label={t('sources.details', { title })}
                aria-expanded={detailsOpen}
                aria-controls={detailsId}
                onClick={() => setDetailsOpen((was) => !was)}
              >
                <InformationSquareIcon aria-hidden />
              </Button>
            ) : null}
            {actions}
          </div>
        ) : null}
      </Card.Block>
      <Card.Block className="uib-sources-document-body" id={bodyId} hidden={!open}>
        {landed ? <BackButton onClick={() => onReturn?.()} /> : null}
        {subtitle ? (
          <Paragraph data-size="xs" className="uib-sources-subtitle">
            {subtitle}
          </Paragraph>
        ) : null}
        {documentUncited ? (
          <Paragraph data-size="xs" className="uib-sources-uncited">
            {t('sources.uncited')}
          </Paragraph>
        ) : null}
        {details ? (
          <div
            id={detailsId}
            className="uib-sources-info"
            role="region"
            aria-label={t('sources.details', { title })}
            hidden={!detailsOpen}
          >
            <dl>
              {source.documentId ? (
                <div>
                  <dt>{t('sources.detailDocument')}</dt>
                  <dd>{source.documentId}</dd>
                </div>
              ) : null}
              {source.version ? (
                <div>
                  <dt>{t('sources.detailVersion')}</dt>
                  <dd>{source.version}</dd>
                </div>
              ) : null}
              {source.excerpts.map((e) => (
                <div key={e.chunkId}>
                  <dt>{t('sources.detailChunk')}</dt>
                  <dd>
                    {e.chunkId}
                    {e.position === undefined
                      ? ''
                      : ` (${t('sources.detailPart', { n: e.position })})`}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        {passages(
          rows.map((row, i) => {
            const { text, excerpt, key } = row;
            const isOpen = openRows.has(key);
            const rowHits = hitsFor(hits, key);
            const here = excerpt !== undefined && excerpt.chunkId === active;
            // Only a cited excerpt is numbered and links back; an uncited one comes last, says so.
            const n = byExcerpt && excerpt ? pairing.numbers.get(excerpt.chunkId) : undefined;
            const uses =
              n !== undefined && excerpt ? (pairing?.uses.get(excerpt.chunkId) ?? []) : [];
            const uncited = byExcerpt && n === undefined;
            const path = headingText(excerpt?.heading);
            const section = sectionOf(path);
            // Named as it is titled: an unnumbered excerpt gets no number from its place either.
            const name = excerptName(n, section);
            const page = excerpt?.page;
            const fetching = !excerpt?.textUnavailable && excerpt?.textLoading && !text;
            const pageLink =
              excerpt?.url && page !== undefined && reachesPage(excerpt.url, page)
                ? excerpt.url
                : undefined;
            const quoteId = `${rowId}-${i}`;
            const leave =
              here && onReturn
                ? (event: KeyboardEvent) => {
                    if (event.key !== 'Escape') return;
                    event.stopPropagation();
                    onReturn();
                  }
                : undefined;
            return (
              // Listens for Escape only, when a footnote sent the reader here.
              <div
                key={key}
                id={excerpt ? excerptId?.(excerpt, source) : undefined}
                className="uib-sources-excerpt ds-focus"
                tabIndex={-1}
                ref={(el) => {
                  if (el) rowRefs.set(key, el);
                  else rowRefs.delete(key);
                }}
                data-active={here || undefined}
                data-uncited={uncited || undefined}
                data-open={isOpen || undefined}
                aria-busy={fetching || undefined}
                onKeyDown={leave}
              >
                <div className="uib-sources-excerpt-head">
                  {/* The links back are in the title, so they work on a closed row too. */}
                  <ExcerptTitle
                    level={level + 1}
                    className="uib-sources-excerpt-title"
                    n={excerpt ? n : undefined}
                    section={section}
                    uses={uses}
                    back={excerpt ? backFor(excerpt) : undefined}
                    sectionFirst={sectionFirst}
                  />
                  <div className="uib-sources-excerpt-controls">
                    <Button
                      type="button"
                      variant="tertiary"
                      data-size="sm"
                      className="uib-sources-excerpt-toggle"
                      aria-expanded={isOpen}
                      aria-controls={quoteId}
                      onClick={() => {
                        onRowOpenChange(key, !isOpen);
                        if (!isOpen && excerpt) onSelect?.({ source, excerpt });
                      }}
                    >
                      {isOpen ? t('sources.close') : t('sources.open')}{' '}
                      <span className="ds-sr-only">{name}</span>
                      <ChevronDownIcon aria-hidden className="uib-sources-caret" />
                    </Button>
                  </div>
                </div>
                {uncited ? (
                  <Paragraph data-size="xs" className="uib-sources-uncited">
                    {t('sources.uncited')}
                  </Paragraph>
                ) : null}
                <div id={quoteId} className="uib-sources-excerpt-body">
                  {isOpen && ((path && path !== section) || page !== undefined) ? (
                    <Paragraph data-size="xs" className="uib-sources-section">
                      {path && path !== section ? <strong>{path}</strong> : null}
                      {path && path !== section && page !== undefined ? ' · ' : null}
                      {page === undefined ? null : (
                        <span className="uib-sources-page">{t('sources.page', { page })}</span>
                      )}
                    </Paragraph>
                  ) : null}
                  {fetching ? (
                    <Paragraph data-size="sm" className="uib-sources-fetching">
                      {t('sources.excerptLoading')}
                    </Paragraph>
                  ) : excerpt?.textUnavailable || !text ? (
                    <Paragraph data-size="sm" className="uib-sources-unavailable">
                      {t('sources.excerptUnavailable')}
                    </Paragraph>
                  ) : (
                    <Markdown
                      text={text}
                      links={false}
                      className={classes(
                        'uib-markdown uib-sources-quote',
                        !isOpen && 'uib-sources-preview',
                      )}
                      highlight={
                        rowHits.length
                          ? {
                              hits: rowHits,
                              offsets: row.offsets,
                              current: currentHit,
                              markClassName: 'uib-sources-mark',
                            }
                          : undefined
                      }
                    />
                  )}
                  {isOpen && pageLink && page !== undefined ? (
                    <PageLink
                      href={pageLink}
                      page={page}
                      name={name}
                      title={title}
                      corpus={corpus}
                      className="uib-sources-link"
                    />
                  ) : null}
                  {isOpen && excerpt && excerptActions ? (
                    <div className="uib-sources-actions">{excerptActions({ source, excerpt })}</div>
                  ) : null}
                  {isOpen && here && onReturn ? <BackButton onClick={onReturn} /> : null}
                </div>
              </div>
            );
          }),
        )}
        <DocumentLink
          source={source}
          title={title}
          corpus={corpus}
          onFollow={onSelect ? () => onSelect({ source }) : undefined}
          linkClassName="uib-sources-link"
          noLinkClassName="uib-sources-no-link"
        />
      </Card.Block>
    </div>
  );
};

export const Sources = ({
  sources,
  answerStatus,
  sourcesNotStored = false,
  assistantName,
  answerIndex = 0,
  answerCount = 1,
  onAnswerChange,
  citations,
  onShowUse,
  citationHref,
  loading = false,
  variant = 'panel',
  title,
  color,
  headerColor,
  corpus,
  disclaimer = true,
  disclaimerId,
  hasOwnDocuments,
  onTargetMissing,
  search,
  documentsClosed = false,
  headingLevel = 3,
  itemId,
  children,
  className,
  ...item
}: SourcesProps) => {
  const t = useT();
  const titleId = useId();
  const madeId = useId();
  const captionId = useId();
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const [openCards, setOpenCards] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [openPassages, setOpenPassages] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [hitIndex, setHitIndex] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const applied = useRef(new WeakSet<SourceTarget>());
  const frame = useRef(0);

  const pairing = useMemo(
    () => (citations ? pairCitations(sources ?? [], citations) : undefined),
    [sources, citations],
  );
  // Cards and excerpts in the footnotes' order, 1, 2, 3, which the search steps through too.
  const order = useMemo(() => readingOrder(sources ?? [], pairing), [sources, pairing]);
  const prepared = useMemo(
    () =>
      prepare(
        sources ?? [],
        order,
        (name, id) => t('sources.sameTitle', { title: name, id }),
        itemId,
      ),
    [sources, order, t, itemId],
  );
  const index = useMemo<SearchableItem[]>(
    () =>
      order.documents.flatMap(
        (i) =>
          prepared[i]?.rows
            .filter((row) => row.flat)
            .map((row) => ({ id: row.key, text: row.flat })) ?? [],
      ),
    [prepared, order],
  );
  const cardOfRow = useMemo(
    () =>
      new Map(prepared.flatMap((document) => document.rows.map((row) => [row.key, document.key]))),
    [prepared],
  );
  const hits = useMemo(() => findHits(index, query), [index, query]);
  const currentHit = hits[hitIndex];

  // Another answer's sources start a fresh search: the count was of a set no longer on screen.
  const [shownAnswer, setShownAnswer] = useState(answerIndex);
  if (shownAnswer !== answerIndex) {
    setShownAnswer(answerIndex);
    setQuery('');
    setHitIndex(0);
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const missing =
    item.target?.chunkId !== undefined && targetPosition(sources ?? [], item.target) < 0;
  useEffect(() => {
    if (missing && item.target) onTargetMissing?.(item.target);
  }, [item.target, missing]);

  const reveal = (keys: readonly string[]) => {
    if (keys.length === 0) return;
    const cards = keys.flatMap((key) => cardOfRow.get(key) ?? []);
    setOpenRows((was) => new Set([...was, ...keys]));
    setOpenCards((was) => {
      const next = new Map(was);
      for (const card of cards) next.set(card, true);
      return next;
    });
    // A hit in a document's passages shows them, or the counter would count what is hidden.
    setOpenPassages((was) => new Set([...was, ...cards]));
  };

  const scrollToRow = (key: string | undefined) => {
    if (key === undefined) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      rowRefs.current
        .get(key)
        ?.scrollIntoView?.({ behavior: prefersStill() ? 'auto' : 'smooth', block: 'start' });
    });
  };

  const changeQuery = (next: string) => {
    const found = findHits(index, next);
    setQuery(next);
    setHitIndex(0);
    reveal(found.map((hit) => hit.itemId));
    scrollToRow(found[0]?.itemId);
  };

  const stepToHit = (step: 1 | -1) => {
    const next = stepHit(hits.length, hitIndex, step);
    setHitIndex(next);
    const hit = hits[next];
    if (!hit) return;
    reveal([hit.itemId]);
    scrollToRow(hit.itemId);
  };

  const setRowOpen = (key: string, open: boolean) =>
    setOpenRows((was) => {
      const next = new Set(was);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  const cardOpen = (key: string) => openCards.get(key) ?? !documentsClosed;
  const setCardOpen = (key: string, open: boolean) =>
    setOpenCards((was) => new Map(was).set(key, open));

  if (!sources && !loading && answerStatus === undefined) return null;
  const waiting = loading || (answerStatus === 'streaming' && !sources?.length);
  // Before the first question there is no answer to read from, whatever the app passes.
  const empty =
    !waiting && (answerStatus === 'unasked' || !sources?.length)
      ? emptyKind(answerStatus, citations?.length ?? 0, sourcesNotStored)
      : undefined;
  const stepping = onAnswerChange !== undefined && answerCount > 1;
  const back: ItemProps['back'] =
    onShowUse || citationHref
      ? {
          answer: answerCount > 1 ? answerIndex + 1 : undefined,
          href: citationHref,
          show: onShowUse,
        }
      : undefined;
  // One string for the visible count and the live region; empty keeps the region silent.
  const answerLabel = stepping
    ? t('sources.answerOf', { n: answerIndex + 1, total: answerCount })
    : '';
  const hit = sources ? targetPosition(sources, item.target) : -1;
  const listKey = (sources ?? [])
    .map((s, i) => `${prepared[i]?.key}:${s.excerpts.map((e) => e.chunkId).join(',')}`)
    .join('|');
  // One level over the cards' headings, so they sit under it in the outline.
  const heading =
    title === false ? null : (
      <Heading
        id={titleId}
        level={Math.max(2, headingLevel - 1) as Level}
        data-size={variant === 'compact' ? '2xs' : 'sm'}
        className="uib-sources-title"
      >
        {title ?? t('sources.title')}
      </Heading>
    );
  // The tool's caption names the list it stands over, «Utdrag svaret bygger på».
  const tool = variant === 'tool';
  const captioned = tool && !waiting && !empty && Boolean(sources?.length);
  const named = captioned
    ? { 'aria-labelledby': captionId }
    : heading
      ? { 'aria-labelledby': titleId }
      : { 'aria-label': t('sources.title') };
  const own = hasOwnDocuments ?? sources?.some(isOwn) ?? false;
  const searching = (search ?? variant !== 'compact') && !empty && Boolean(sources?.length);
  const describedBy = disclaimer && sources?.length ? (disclaimerId ?? madeId) : undefined;
  return (
    <div className={classes('uib-sources', className)} data-variant={variant} data-color={color}>
      {/* In the page from the first render: a live region announces only a change to it. */}
      {onAnswerChange ? <output className="ds-sr-only">{answerLabel}</output> : null}
      {heading || searching || stepping || captioned ? (
        <div className="uib-sources-head">
          {heading}
          {/* Also when this answer has no sources: stepping back is the point. */}
          {stepping ? (
            <AnswerSwitcher
              label={answerLabel}
              index={answerIndex}
              count={answerCount}
              onChange={onAnswerChange}
            />
          ) : null}
          {searching ? (
            <SourcesSearch
              query={query}
              onQueryChange={changeQuery}
              hitCount={hits.length}
              currentHitIndex={hitIndex}
              onStep={stepToHit}
              describedBy={describedBy}
              {...(tool
                ? {
                    label: t('sources.searchExcerpts'),
                    placeholder: t('sources.searchExcerpts'),
                    labelHidden: true,
                  }
                : {})}
            />
          ) : null}
          {captioned ? (
            <p id={captionId} className="uib-sources-caption">
              {t('sources.excerptsCaption')}
            </p>
          ) : null}
        </div>
      ) : null}
      {disclaimer && (waiting || (!empty && sources?.length)) ? (
        <Paragraph id={disclaimerId ?? madeId} data-size="xs" className="uib-sources-disclaimer">
          {corpus
            ? t(own ? 'sources.disclaimerWithOwn' : 'sources.disclaimer', { corpus })
            : t('sources.disclaimerNoCorpus')}
        </Paragraph>
      ) : null}
      {waiting ? (
        <div className="uib-sources-documents" aria-busy="true">
          <output className="ds-sr-only">{t('sources.loading')}</output>
          {['a', 'b', 'c', 'd'].map((key) => (
            <Skeleton key={key} variant="rectangle" height="var(--ds-size-18)" />
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          kind={empty}
          level={headingLevel}
          corpus={corpus}
          assistantName={assistantName}
        />
      ) : sources?.length ? (
        <ol key={listKey} className="uib-sources-documents" {...named}>
          {order.documents.flatMap((i) => {
            const document = prepared[i];
            if (!document) return [];
            return [
              <li key={document.key}>
                <SourceItem
                  document={document}
                  level={headingLevel}
                  pairing={pairing}
                  openRows={openRows}
                  onRowOpenChange={setRowOpen}
                  open={cardOpen(document.key)}
                  onOpenChange={(now) => setCardOpen(document.key, now)}
                  passagesOpen={openPassages.has(document.key)}
                  onPassagesOpenChange={(now) =>
                    setOpenPassages((was) => {
                      const next = new Set(was);
                      if (now) next.add(document.key);
                      else next.delete(document.key);
                      return next;
                    })
                  }
                  rowRefs={rowRefs.current}
                  applied={applied.current}
                  hits={hits}
                  currentHit={currentHit}
                  sectionFirst={variant === 'tool'}
                  corpus={corpus}
                  headerColor={headerColor}
                  back={back}
                  {...item}
                  target={i === hit ? item.target : undefined}
                />
              </li>,
            ];
          })}
        </ol>
      ) : null}
      {children}
    </div>
  );
};
