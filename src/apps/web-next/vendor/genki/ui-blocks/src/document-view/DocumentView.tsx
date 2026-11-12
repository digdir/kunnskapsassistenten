import { Button, Card, Chip, Heading, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { ArrowLeftIcon } from '@navikt/aksel-icons';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useT } from './i18n.js';
import { Markdown } from '../markdown/Markdown.js';
import { excerptMarkdown, headingText } from '../sources/excerptMarkdown.js';
import {
  orderedExcerpts,
  pairCitations,
  type Pairing,
  type SourceCitation,
} from '../sources/pairing.js';
import {
  DocumentLink,
  ExcerptTitle,
  PageLink,
  prefersStill,
  reachesPage,
  sectionOf,
  targetPosition,
  useExcerptName,
  useSourceSubtitle,
  type BackTo,
} from '../sources/Sources.js';
import type {
  SourceDocument,
  SourceExcerpt,
  SourceSelection,
  SourceTarget,
} from '../sources/types.js';

/** Where «Tilbake til …» leads: the footnote the reader followed, or Sources. */
export type DocumentViewReturn = 'answer' | 'sources';

/** Where the reader opens a document: «Vis i dokumentet» in Sources, or a footnote. */
export type DocumentViewOpener = 'sources' | 'answer';

/** A question the reader asked about the document, for the host to ask in the thread. */
export interface DocumentQuestion {
  question: string;
  source: SourceDocument;
  /** The excerpt the reader stood on when asking. */
  excerpt?: SourceExcerpt | undefined;
}

export interface DocumentViewProps {
  /** The answer's sources, as Sources takes them; the view shows the targeted one's excerpts. */
  sources?: readonly SourceDocument[] | undefined;
  /** Which document and excerpt to land on; each new target, by identity, is followed once. */
  target?: SourceTarget | undefined;
  /** The answer's footnotes in order, as Sources takes them, to number and jump to excerpts. */
  citations?: readonly SourceCitation[] | undefined;
  /** A link back to the answer was followed: that footnote's index in `citations`. */
  onShowUse?: ((citation: number, selection: SourceSelection) => void) | undefined;
  /** Where a link back to footnote `citation` leads, such as `#` and the answer's `citationId`. */
  citationHref?: ((citation: number) => string | undefined) | undefined;
  /** Which of the thread's answers the sources are for, from 0, so a link back can say which. */
  answerIndex?: number | undefined;
  answerCount?: number | undefined;
  /** Back to where the reader came from, by the button at the top or Escape. */
  onReturn?: (() => void) | undefined;
  /** What the way back says: «Tilbake til svaret» (the default) or «Tilbake til kildene». */
  returnTo?: DocumentViewReturn | undefined;
  /** A question about this document, for the host to ask in the thread; no field without it. */
  onAsk?: ((ask: DocumentQuestion) => void) | undefined;
  /** The target names a document or excerpt the sources do not hold. */
  onTargetMissing?: ((target: SourceTarget) => void) | undefined;
  /** Which control the hint before a document names; without it, the hint names both. */
  opensFrom?: DocumentViewOpener | undefined;
  /** What the documents' collection is called, for «Les dokumentet på Kudos». */
  corpus?: string | undefined;
  /** The block's heading, «Dokumentvisning», or `false` for none. */
  title?: ReactNode | false | undefined;
  /** The document title's heading level, 2 to 5, 3 by default. The block's heading is one over. */
  headingLevel?: 2 | 3 | 4 | 5 | undefined;
  /** Says the text is quoted, not generated. On by default. */
  disclaimer?: boolean | undefined;
  /** Designsystemet's `data-color` for the block and the document's head, set only when given. */
  color?: string | undefined;
  headerColor?: string | undefined;
  children?: ReactNode;
  className?: string | undefined;
}

type Level = 2 | 3 | 4 | 5 | 6;

/** Whether the positions say text the view does not have lies before an excerpt. */
const gapBefore = (passages: readonly SourceExcerpt[], i: number) => {
  const here = passages[i]?.position;
  if (here === undefined) return false;
  if (i === 0) return here > 0;
  const before = passages[i - 1]?.position;
  return before !== undefined && here - before > 1;
};

/** A cited excerpt that «Utdrag i svaret» jumps to: its number, and the document it is in. */
interface Jump {
  n: number;
  source: SourceDocument;
  excerpt: SourceExcerpt;
}

/** The answer's cited excerpts by «Utdrag N», in any document; none in document mode. */
const jumpsOf = (sources: readonly SourceDocument[], pairing: Pairing | undefined): Jump[] => {
  if (pairing?.mode !== 'excerpt') return [];
  const held = new Map<string, Omit<Jump, 'n'>>();
  for (const source of sources)
    for (const excerpt of source.excerpts)
      if (!held.has(excerpt.chunkId)) held.set(excerpt.chunkId, { source, excerpt });
  return [...pairing.numbers]
    .sort(([, a], [, b]) => a - b)
    .flatMap(([chunkId, n]) => {
      const where = held.get(chunkId);
      return where ? [{ n, ...where }] : [];
    });
};

/** What a document is, across new copies of the same sources. */
const documentKey = (source: SourceDocument) =>
  source.documentId ?? (source.index === undefined ? source.title : `#${source.index}`);

const Empty = ({ level, title, text }: { level: number; title: string; text: string }) => (
  <div className="uib-document-view-empty">
    <Heading level={level as Level} data-size="2xs">
      {title}
    </Heading>
    <Paragraph data-size="sm" variant="long">
      {text}
    </Paragraph>
  </div>
);

/** «Dokumentvisning»: one source document in its own order, with the target excerpt marked. */
export const DocumentView = ({
  sources,
  target,
  citations,
  onShowUse,
  citationHref,
  answerIndex = 0,
  answerCount = 1,
  onReturn,
  returnTo = 'answer',
  onAsk,
  onTargetMissing,
  opensFrom,
  corpus,
  title,
  headingLevel = 3,
  disclaimer = true,
  color,
  headerColor,
  children,
  className,
}: DocumentViewProps) => {
  const t = useT();
  const excerptName = useExcerptName();
  const titleId = useId();
  const documentTitleId = useId();
  const jumpsId = useId();
  const passageId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const passageRefs = useRef(new Map<string, HTMLElement>());
  const applied = useRef(new WeakSet<SourceTarget>());
  // A jump from «Utdrag i svaret», kept only while the host's target is unchanged.
  const [jumped, setJumped] = useState<{ under: SourceTarget | undefined; to: SourceTarget }>();
  const [landing, setLanding] = useState<{ chunkId: string | undefined }>();
  const [said, setSaid] = useState('');
  // The question being written, for the document it was written about.
  const [draft, setDraft] = useState({ document: '', question: '', sent: '' });
  const [jumpsRow, setJumpsRow] = useState<HTMLElement | null>(null);

  const own =
    jumped && jumped.under === target && sources && targetPosition(sources, jumped.to) >= 0
      ? jumped.to
      : undefined;
  const shown = own ?? target;
  const position = sources && shown ? targetPosition(sources, shown) : -1;
  const source = position >= 0 ? sources?.[position] : undefined;
  const passages = useMemo(() => (source ? orderedExcerpts(source) : []), [source]);
  const pairing = useMemo(
    () => (citations ? pairCitations(sources ?? [], citations) : undefined),
    [sources, citations],
  );
  const jumps = useMemo(() => jumpsOf(sources ?? [], pairing), [sources, pairing]);
  const subtitle = useSourceSubtitle(source ?? { title: '', excerpts: [] });
  const missing = target !== undefined && sources !== undefined && !source;
  // A footnote that names an excerpt this document does not hold marks nothing.
  const strayChunk =
    source !== undefined &&
    shown?.chunkId !== undefined &&
    !passages.some((p) => p.chunkId === shown.chunkId);
  // Read from the target itself, so a new document never shows the last one's mark for a render.
  const marked = source && !strayChunk ? shown?.chunkId : undefined;
  const shownKey = source ? documentKey(source) : '';

  useEffect(() => {
    if (target && !own && (missing || strayChunk)) onTargetMissing?.(target);
  }, [target, missing, strayChunk]);

  useEffect(() => {
    // Once per target, once its document is here: new sources for the same target move no focus.
    if (!shown || !source || applied.current.has(shown)) return;
    applied.current.add(shown);
    if (!own) setSaid('');
    setLanding({ chunkId: marked });
  }, [shown, source]);

  // The room under the sticky «Utdrag i svaret» row, measured before each landing and on resize.
  const fitRoom = (row: HTMLElement | null) => {
    const root = rootRef.current;
    if (!root) return;
    if (!row) root.style.removeProperty('--_scroll-room');
    else
      root.style.setProperty(
        '--_scroll-room',
        `calc(${Math.ceil(row.getBoundingClientRect().height)}px + var(--ds-size-2))`,
      );
  };

  useEffect(() => {
    fitRoom(jumpsRow);
    if (!jumpsRow || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fitRoom(jumpsRow));
    observer.observe(jumpsRow);
    return () => observer.disconnect();
  }, [jumpsRow]);

  useEffect(() => {
    if (!landing) return;
    const id = requestAnimationFrame(() => {
      fitRoom(jumpsRow);
      const passage = landing.chunkId ? passageRefs.current.get(landing.chunkId) : undefined;
      // On the title, the block's top is shown too, so the way back stays in sight.
      (passage ?? rootRef.current)?.scrollIntoView?.({
        behavior: prefersStill() ? 'auto' : 'smooth',
        block: 'start',
      });
      (passage ?? headRef.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [landing]);

  const level = headingLevel as Level;
  const rootClass = className ? `uib-document-view ${className}` : 'uib-document-view';
  const heading =
    title === false ? null : (
      <Heading
        id={titleId}
        level={Math.max(2, headingLevel - 1) as Level}
        data-size="sm"
        className="uib-document-view-title"
      >
        {title ?? t('documentView.title')}
      </Heading>
    );
  const back = onReturn ? (
    <Button variant="tertiary" data-size="sm" className="uib-document-view-back" onClick={onReturn}>
      <ArrowLeftIcon aria-hidden />
      {returnTo === 'sources' ? t('documentView.backToSources') : t('sources.backToAnswer')}
    </Button>
  ) : null;
  const named = heading
    ? { 'aria-labelledby': titleId }
    : { 'aria-label': t('documentView.title') };

  if (!source)
    return (
      <section className={rootClass} data-color={color} {...named}>
        {/* Nothing to go back to before a target. */}
        {target ? back : null}
        {heading}
        <Empty
          level={headingLevel}
          title={missing ? t('documentView.missingTitle') : t('documentView.emptyTitle')}
          text={
            missing
              ? t('documentView.missing')
              : opensFrom === 'sources'
                ? t('documentView.emptyFromSources')
                : opensFrom === 'answer'
                  ? t('documentView.emptyFromAnswer')
                  : t('documentView.empty')
          }
        />
        {children}
      </section>
    );

  const documentTitle = source.title.trim() || t('sources.untitled');
  const ordered = passages.every((p) => p.position !== undefined);
  const backTo: BackTo | undefined =
    onShowUse || citationHref
      ? {
          answer: answerCount > 1 ? answerIndex + 1 : undefined,
          href: citationHref,
          onShow: undefined,
        }
      : undefined;
  // Escape anywhere on the document goes back, but not in the question field.
  const leave = onReturn
    ? (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        if (event.target instanceof Element && event.target.closest('form')) return;
        event.stopPropagation();
        onReturn();
      }
    : undefined;

  // To a cited excerpt in any of the answer's documents; another document is said aloud too.
  const jump = ({ source: to, excerpt }: Jump) => {
    setJumped({ under: target, to: { chunkId: excerpt.chunkId, documentId: to.documentId } });
    setSaid(
      to === source
        ? ''
        : t('documentView.opened', { title: to.title.trim() || t('sources.untitled') }),
    );
  };

  const question = draft.document === shownKey ? draft.question : '';
  const sent = draft.document === shownKey ? draft.sent : '';
  const ask = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || !onAsk) return;
    onAsk({ question: text, source, excerpt: passages.find((p) => p.chunkId === marked) });
    setDraft({ document: shownKey, question: '', sent: t('documentView.askSent') });
  };

  return (
    <section ref={rootRef} className={rootClass} data-color={color} {...named}>
      {/* In the page from the first render: a live region announces only a change to it. */}
      <output className="ds-sr-only">{said}</output>
      {back}
      {heading}
      {/* Not `Card`, whose click anywhere follows a heading's first link, here a link back. */}
      <article
        className="ds-card uib-document-view-document"
        aria-labelledby={documentTitleId}
        onKeyDown={leave}
      >
        <Card.Block className="uib-document-view-head" data-color={headerColor}>
          <Heading
            ref={headRef}
            id={documentTitleId}
            level={level}
            data-size="xs"
            tabIndex={-1}
            className="uib-document-view-document-title ds-focus"
          >
            {documentTitle}
          </Heading>
        </Card.Block>
        <Card.Block className="uib-document-view-body">
          {subtitle ? (
            <Paragraph data-size="xs" className="uib-document-view-subtitle">
              {subtitle}
            </Paragraph>
          ) : null}
          <DocumentLink
            source={source}
            title={documentTitle}
            corpus={corpus}
            linkClassName="uib-document-view-link"
            noLinkClassName="uib-document-view-no-link"
          />
          <Paragraph data-size="xs" className="uib-document-view-scope">
            {ordered
              ? t('documentView.scope', { count: passages.length })
              : t('documentView.scopeUnordered', { count: passages.length })}
          </Paragraph>
          {disclaimer ? (
            <Paragraph data-size="xs" className="uib-document-view-disclaimer">
              {t('documentView.disclaimer')}
            </Paragraph>
          ) : null}
          {/* One chip per cited excerpt, each a jump to it; the rest is reached by scrolling. */}
          {jumps.length > 0 ? (
            <div
              ref={setJumpsRow}
              className="uib-document-view-jumps"
              role="group"
              aria-labelledby={jumpsId}
            >
              <span id={jumpsId} className="uib-document-view-jumps-label">
                {t('documentView.jumps')}
              </span>
              <ul className="uib-document-view-jump-list">
                {jumps.map((item, i) => {
                  const { n, excerpt } = item;
                  const elsewhere = item.source !== source;
                  const page = excerpt.page;
                  const title = item.source.title.trim() || t('sources.untitled');
                  // A run of chips into another document, or back, is led by that document's name.
                  const runStarts = i === 0 ? elsewhere : jumps[i - 1]?.source !== item.source;
                  const lead = runStarts
                    ? elsewhere
                      ? t('documentView.jumpsIn', { title })
                      : t('documentView.jumpsHere')
                    : undefined;
                  // Starts with what the chip shows, then the page and any other document.
                  const name = [
                    t('sources.excerptNumber', { n }),
                    page === undefined ? undefined : t('sources.page', { page }),
                    elsewhere ? t('documentView.jumpIn', { title }) : undefined,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <li key={excerpt.chunkId} className="uib-document-view-jump-item">
                      {lead ? (
                        <span className="uib-document-view-jump-doc" aria-hidden="true">
                          {lead}
                        </span>
                      ) : null}
                      <Chip.Button
                        type="button"
                        className="uib-document-view-jump"
                        aria-label={name}
                        title={elsewhere ? name : undefined}
                        aria-current={!elsewhere && excerpt.chunkId === marked ? 'true' : undefined}
                        onClick={() => jump(item)}
                      >
                        <span className="uib-document-view-jump-number" aria-hidden="true">
                          {n}
                        </span>
                        {page === undefined ? null : (
                          <span className="uib-document-view-jump-page" aria-hidden="true">
                            {t('documentView.jumpPage', { page })}
                          </span>
                        )}
                      </Chip.Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <ol className="uib-document-view-passages">
            {passages.map((excerpt, i) => {
              const n =
                pairing?.mode === 'excerpt' ? pairing.numbers.get(excerpt.chunkId) : undefined;
              const uses = n === undefined ? [] : (pairing?.uses.get(excerpt.chunkId) ?? []);
              const uncited = pairing?.mode === 'excerpt' && n === undefined;
              const path = headingText(excerpt.heading);
              const section = sectionOf(path);
              const page = excerpt.page;
              const text = excerpt.textUnavailable ? '' : excerptMarkdown(excerpt.text);
              const fetching = !excerpt.textUnavailable && excerpt.textLoading && !text;
              const pageLink =
                excerpt.url && page !== undefined && reachesPage(excerpt.url, page)
                  ? excerpt.url
                  : undefined;
              const here = excerpt.chunkId === marked;
              const titleOf = `${passageId}-${i}`;
              return (
                <li key={excerpt.chunkId}>
                  {gapBefore(passages, i) ? (
                    <p className="uib-document-view-gap">
                      <span aria-hidden="true">[…]</span>
                      <span className="ds-sr-only">{t('documentView.gap')}</span>
                    </p>
                  ) : null}
                  {/* A group named by its title, so focus that lands here says which excerpt. */}
                  <div
                    ref={(el) => {
                      if (el) passageRefs.current.set(excerpt.chunkId, el);
                      else passageRefs.current.delete(excerpt.chunkId);
                    }}
                    className="uib-document-view-passage ds-focus"
                    role="group"
                    aria-labelledby={titleOf}
                    tabIndex={-1}
                    data-current={here || undefined}
                    data-uncited={uncited || undefined}
                    aria-busy={fetching || undefined}
                  >
                    <ExcerptTitle
                      id={titleOf}
                      level={headingLevel + 1}
                      className="uib-document-view-passage-title"
                      n={n}
                      section={section}
                      uses={uses}
                      back={
                        backTo && {
                          ...backTo,
                          onShow:
                            onShowUse && ((citation) => onShowUse(citation, { source, excerpt })),
                        }
                      }
                    />
                    {uncited ? (
                      <Paragraph data-size="xs" className="uib-document-view-uncited">
                        {t('sources.uncited')}
                      </Paragraph>
                    ) : null}
                    {(path && path !== section) || page !== undefined ? (
                      <Paragraph data-size="xs" className="uib-document-view-section">
                        {path && path !== section ? <strong>{path}</strong> : null}
                        {path && path !== section && page !== undefined ? ' · ' : null}
                        {page === undefined ? null : (
                          <span className="uib-document-view-page">
                            {t('sources.page', { page })}
                          </span>
                        )}
                      </Paragraph>
                    ) : null}
                    {fetching ? (
                      <Paragraph data-size="sm" className="uib-document-view-unavailable">
                        {t('sources.excerptLoading')}
                      </Paragraph>
                    ) : text ? (
                      <Markdown
                        text={text}
                        links={false}
                        className="uib-markdown uib-document-view-quote"
                      />
                    ) : (
                      <Paragraph data-size="sm" className="uib-document-view-unavailable">
                        {t('sources.excerptUnavailable')}
                      </Paragraph>
                    )}
                    {pageLink && page !== undefined ? (
                      <PageLink
                        href={pageLink}
                        page={page}
                        name={excerptName(n, section)}
                        title={documentTitle}
                        corpus={corpus}
                        className="uib-document-view-link"
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
          {onAsk ? (
            <form className="uib-document-view-ask" onSubmit={ask}>
              <Textfield
                label={t('documentView.askLabel')}
                description={t('documentView.askHint')}
                value={question}
                onChange={(event) =>
                  setDraft({ document: shownKey, question: event.target.value, sent: '' })
                }
                className="uib-document-view-ask-field"
              />
              <Button type="submit" aria-disabled={!question.trim() || undefined}>
                {t('documentView.ask')}
              </Button>
              <output className="ds-sr-only">{sent}</output>
            </form>
          ) : null}
        </Card.Block>
      </article>
      {children}
    </section>
  );
};
