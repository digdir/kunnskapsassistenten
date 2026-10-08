import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { corpusDisplayNameFor, corpusOption } from '../../api';
import { EmptyState, findHits, PanelHeader, stepHit, type SearchHit } from '../../components';
import { useActiveCorpus } from '../../layout/useActiveCorpus';
import { ViewHead } from '../../layout/ViewHead';
import { excerptDomId, type AnswerSources, type Excerpt, type SourceDocument } from '../../model';
import { AnswerSwitcher } from './AnswerSwitcher';
import { ExcerptSearch } from './ExcerptSearch';
import { CorpusDisclaimer } from './CorpusDisclaimer';
import { corpusKeyFor, isOwnDocument } from './origin';
import { SourceDocumentCard } from './SourceDocumentCard';
import { distinctTitles } from './distinctTitles';
import { SourcesPlaceholder } from './SourcesPlaceholder';
import { noAnswerYet, emptyStateFor, type SourcesEmptyState } from './emptyStates';
import { readableDocuments } from './readableText';
import { buildSearchIndex } from './search';
import type { SourcesViewProps } from './types';
import './sources.css';

// `scrollTo` leaves the keyboard where it is; `scrollToAndFocus` is for a move
// the reader asked for, so a screen reader reads the excerpt.
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollElementIntoView(element: HTMLElement) {
  element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function scrollTo(domId: string): HTMLElement | null {
  const element = document.getElementById(domId);
  if (element === null) return null;

  scrollElementIntoView(element);
  return element;
}

function scrollToAndFocus(domId: string) {
  scrollTo(domId)?.focus({ preventScroll: true });
}

/** Wait a frame, so state that opens an excerpt has been laid out first. */
function afterRender(action: () => void): () => void {
  const frame = requestAnimationFrame(action);
  return () => cancelAnimationFrame(frame);
}

function allExcerpts(sources: SourceDocument[]): Excerpt[] {
  return sources.flatMap((source) => source.excerpts);
}

function excerptOfHit(sources: SourceDocument[], hit: SearchHit | undefined): Excerpt | undefined {
  if (hit === undefined) return undefined;
  return allExcerpts(sources).find((excerpt) => excerpt.id === hit.itemId);
}

/** Stands in for a message id while the shell still holds one flat list. */
const LEGACY_ANSWER_ID = 'siste-svar';

// The `[n]` marker to return focus to: the focused one if it matches, since a
// number can stand twice, or else any match, since Safari does not focus links.
function markerFor(citationNumber: number): HTMLElement | null {
  const href = `#${excerptDomId(citationNumber)}`;
  const focused = document.activeElement;

  if (focused instanceof HTMLElement && focused.getAttribute('href') === href) return focused;

  return document.querySelector<HTMLElement>(`a[href="${href}"]`);
}

// Where a marker stood: react-markdown can swap it for an equal one, so its
// container, href and index are kept too.
type MarkerPlace = {
  element: HTMLElement;
  scope: Element | null;
  href: string;
  index: number;
};

function placeOf(marker: HTMLElement): MarkerPlace {
  const href = marker.getAttribute('href') ?? '';
  const scope = marker.closest('.markdown') ?? marker.closest('main');
  const index =
    scope === null ? -1 : [...scope.querySelectorAll(`a[href="${href}"]`)].indexOf(marker);
  return { element: marker, scope, href, index };
}

/** The marker itself when it is still there, or the one that took its place. */
function markerAt(place: MarkerPlace): HTMLElement | null {
  if (place.element.isConnected) return place.element;
  if (place.scope === null || !place.scope.isConnected) return null;

  const equal = place.scope.querySelectorAll<HTMLElement>(`a[href="${place.href}"]`);
  return equal[place.index] ?? equal[0] ?? null;
}

// One shape for both props. `undefined` is «not known yet», `[]` «nothing asked».
function normaliseAnswers(
  answers: readonly AnswerSources[] | undefined,
  documents: SourceDocument[] | undefined,
): readonly AnswerSources[] | undefined {
  if (answers !== undefined) return answers;
  if (documents === undefined) return undefined;
  if (documents.length === 0) return [];
  return [{ messageId: LEGACY_ANSWER_ID, documents, status: 'complete' }];
}

/** What the body of the panel shows, once the four states are told apart. */
type PanelContent =
  { kind: 'loading' } | { kind: 'empty'; state: SourcesEmptyState } | { kind: 'sources' };

/** Early returns, because `emptyStateFor` does not take `streaming`. */
function panelContentFor(
  answers: readonly AnswerSources[] | undefined,
  active: AnswerSources | undefined,
  /** For the «nothing asked yet» state, which has no answer to read from. */
  activeCorpusName: string,
): PanelContent {
  if (answers === undefined) return { kind: 'loading' };
  if (active === undefined) return { kind: 'empty', state: noAnswerYet(activeCorpusName) };
  if (active.status === 'streaming') return { kind: 'loading' };
  if (active.documents.length === 0) {
    return {
      kind: 'empty',
      state: emptyStateFor(active.status, active.citationCount, active.sourcesNotStored),
    };
  }
  return { kind: 'sources' };
}

/**
 * The sources of one answer at a time, since every answer numbers its excerpts
 * from 1. It follows the newest answer, and switches to the one a marker is in.
 *
 *   answers === undefined      loading, the skeleton
 *   answers.length === 0       nothing asked yet, an empty state
 *   answer with no documents   what became of it, per status (`emptyStates.ts`)
 *   otherwise                  the sources
 */
export function SourcesView({
  answers,
  documents,
  collapsed = false,
  onCollapsedChange,
  activeCitationNumber,
  activeCitationNonce,
  activeCitationMessageId,
}: SourcesViewProps) {
  // The disclaimer is drawn outside the sticky head and the search field
  // inside it, so the id that ties them together is made here, where both are.
  const disclaimerId = useId();
  const [query, setQuery] = useState('');
  const [currentHitIndex, setCurrentHitIndex] = useState(0);
  const [openExcerptIds, setOpenExcerptIds] = useState<ReadonlySet<string>>(new Set());

  const answerList = useMemo(() => normaliseAnswers(answers, documents), [answers, documents]);
  const answersOnScreen = useMemo(() => answerList ?? [], [answerList]);
  const newestMessageId = answersOnScreen.at(-1)?.messageId;

  // `undefined` is the newest answer, and a new answer resets to it.
  const [chosenMessageId, setChosenMessageId] = useState<string | undefined>(undefined);
  const [followedMessageId, setFollowedMessageId] = useState(newestMessageId);
  if (followedMessageId !== newestMessageId) {
    setFollowedMessageId(newestMessageId);
    setChosenMessageId(undefined);
  }

  const chosenIndex = answersOnScreen.findIndex((answer) => answer.messageId === chosenMessageId);
  const activeIndex = chosenIndex >= 0 ? chosenIndex : answersOnScreen.length - 1;
  const activeAnswer = answersOnScreen[activeIndex];

  // Readable once, here, so the search and the quote measure and draw the same
  // string. See `readableText.ts`.
  const documentList = useMemo(
    () => readableDocuments(activeAnswer?.documents ?? []),
    [activeAnswer],
  );
  // Two documents with one title get their numbers, here and under the answer.
  const names = useMemo(() => distinctTitles(documentList), [documentList]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A marker arrives as a prop, so the excerpt opens in render; the nonce makes
  // a second click on the same marker count. `shownFor` is the answer it was
  // resolved against, so the highlight stays with that answer.
  const [handled, setHandled] = useState<
    { number?: number; nonce?: number; messageId?: string; shownFor?: string } | undefined
  >(undefined);
  if (
    handled?.number !== activeCitationNumber ||
    handled?.nonce !== activeCitationNonce ||
    handled?.messageId !== activeCitationMessageId
  ) {
    // Switch to the marker's answer first; without an id, the one on screen.
    const citedIndex = answersOnScreen.findIndex(
      (answer) => answer.messageId === activeCitationMessageId,
    );
    if (citedIndex >= 0 && citedIndex !== activeIndex) {
      setChosenMessageId(activeCitationMessageId);
    }

    const citedAnswer = citedIndex >= 0 ? answersOnScreen[citedIndex] : activeAnswer;

    setHandled({
      number: activeCitationNumber,
      nonce: activeCitationNonce,
      messageId: activeCitationMessageId,
      shownFor: activeCitationNumber === undefined ? undefined : citedAnswer?.messageId,
    });

    const target = allExcerpts(citedAnswer?.documents ?? []).find(
      (excerpt) => excerpt.citationNumber === activeCitationNumber,
    );

    if (target !== undefined && !openExcerptIds.has(target.id)) {
      setOpenExcerptIds(new Set(openExcerptIds).add(target.id));
    }

    // The default layout starts collapsed, where a marker would do nothing.
    if (target !== undefined && collapsed) onCollapsedChange?.(false);
  }

  // Effects run on mount: a view mounted with a citation already set must not
  // take focus before the reader has done anything.
  const revealedCitation = useRef<{ number?: number; nonce?: number }>({
    number: activeCitationNumber,
    nonce: activeCitationNonce,
  });

  // Where «Tilbake til svaret» and Escape go.
  const returnTarget = useRef<MarkerPlace | null>(null);

  // Recorded in the capture phase, before the main column's render can replace
  // the marker; by the effect, focus may be on `<body>`.
  const activatedMarker = useRef<MarkerPlace | null>(null);

  useEffect(() => {
    function record(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const marker = target?.closest('a[href^="#excerpt-"]');
      if (!(marker instanceof HTMLElement) || marker.closest('.sources-view') !== null) return;
      activatedMarker.current = placeOf(marker);
    }

    document.addEventListener('click', record, true);
    return () => document.removeEventListener('click', record, true);
  }, []);

  useEffect(() => {
    const previous = revealedCitation.current;
    revealedCitation.current = { number: activeCitationNumber, nonce: activeCitationNonce };

    if (activeCitationNumber === undefined) return;
    if (previous.number === activeCitationNumber && previous.nonce === activeCitationNonce) return;

    const activated = activatedMarker.current;
    activatedMarker.current = null;
    const focused = markerFor(activeCitationNumber);
    returnTarget.current =
      activated?.href === `#${excerptDomId(activeCitationNumber)}`
        ? activated
        : focused === null
          ? null
          : placeOf(focused);

    // Two frames: one for the excerpt to open, one in case the panel had to be
    // un-collapsed, since the shell only removes `hidden` on its own render.
    return afterRender(() =>
      afterRender(() => scrollToAndFocus(excerptDomId(activeCitationNumber))),
    );
  }, [activeCitationNumber, activeCitationNonce]);

  /** A detached marker would drop focus to `<body>`, hence `markerAt`. */
  function returnToAnswer() {
    const place = returnTarget.current;
    const marker = place === null ? null : markerAt(place);
    if (marker === null) return;

    scrollElementIntoView(marker);
    marker.focus({ preventScroll: true });
  }

  function setExcerptOpen(excerptId: string, open: boolean) {
    setOpenExcerptIds((previous) => {
      const next = new Set(previous);
      if (open) next.add(excerptId);
      else next.delete(excerptId);
      return next;
    });
  }

  /** Resets the search, which counted a set no longer on screen. */
  function stepToAnswer(step: 1 | -1) {
    const next = activeIndex + step;
    const answer = answersOnScreen[next];
    if (answer === undefined) return;

    setChosenMessageId(answer.messageId);
    setQuery('');
    setCurrentHitIndex(0);
  }

  // Opens every excerpt with a hit, or the counter means nothing; scrolls
  // without focus, so the reader keeps typing.
  function changeQuery(next: string) {
    const nextHits = findHits(searchIndex, next);
    const first = excerptOfHit(documentList, nextHits[0]);

    setQuery(next);
    setCurrentHitIndex(0);
    setOpenExcerptIds((previous) => new Set([...previous, ...nextHits.map((hit) => hit.itemId)]));

    if (first?.citationNumber !== undefined) {
      afterRender(() => scrollTo(excerptDomId(first.citationNumber as number)));
    }
  }

  /** Leaves focus on the button, so it can be pressed again. */
  function stepToHit(step: 1 | -1) {
    const next = stepHit(hits.length, currentHitIndex, step);
    const excerpt = excerptOfHit(documentList, hits[next]);

    setCurrentHitIndex(next);
    if (excerpt !== undefined) {
      setOpenExcerptIds((previous) => new Set(previous).add(excerpt.id));
      if (excerpt.citationNumber !== undefined) {
        afterRender(() => scrollTo(excerptDomId(excerpt.citationNumber as number)));
      }
    }
  }

  // The answer's corpus, not the chooser's: an older thread can be from another.
  // `useActiveCorpus` rather than the store, so `preview/` mounts without a Router.
  const activeCorpus = useActiveCorpus();
  const corpusKey = corpusKeyFor(activeAnswer?.corpusKey, activeCorpus.key);
  const corpusName = corpusDisplayNameFor(corpusKey);

  // A link label takes no «standardkorpuset» stand-in, unlike the disclaimer.
  const linkCorpusName = corpusOption(corpusKey) === undefined ? undefined : corpusName;

  const content = panelContentFor(answerList, activeAnswer, activeCorpus.displayName);

  // One string for the visible row and the live region; empty keeps the region
  // silent without taking it out of the document.
  const answerLabel =
    answersOnScreen.length > 1
      ? `Kilder til svar ${activeIndex + 1} av ${answersOnScreen.length}`
      : '';

  // Every answer has a `[1]`, so the number alone would highlight the wrong one.
  const citationIsOnScreen =
    handled?.shownFor !== undefined && handled.shownFor === activeAnswer?.messageId;
  const activeNumberHere = citationIsOnScreen ? activeCitationNumber : undefined;

  return (
    <div className="sources-view">
      {/* Mounted from the first render: a live region has to exist before its
          content changes. The visible counter is `aria-hidden`. */}
      <output className="ds-sr-only">{answerLabel}</output>

      {/* Pinned, so the answer counter and the search stay in view. See
          src/layout/viewHeadContext.ts. */}
      <ViewHead>
        {/* Visible, as «Filtrering» in the navigation panel and in Figma. */}
        <PanelHeader title="Kilder" size="sm" />

        {/* Also when this answer has no sources: stepping back is the point. */}
        {answersOnScreen.length > 1 && (
          <AnswerSwitcher
            label={answerLabel}
            index={activeIndex}
            count={answersOnScreen.length}
            onStep={stepToAnswer}
          />
        )}

        {/* Kept while loading, so the layout does not shift. */}
        {content.kind !== 'empty' && (
          <ExcerptSearch
            query={query}
            onQueryChange={changeQuery}
            hitCount={hits.length}
            currentHitIndex={currentHitIndex}
            onStep={stepToHit}
            descriptionId={disclaimerId}
          />
        )}
      </ViewHead>

      {content.kind !== 'empty' && (
        <CorpusDisclaimer
          id={disclaimerId}
          corpusName={corpusName}
          hasOwnDocument={documentList.some(isOwnDocument)}
        />
      )}

      {content.kind === 'loading' ? (
        <SourcesPlaceholder />
      ) : content.kind === 'empty' ? (
        <EmptyState title={content.state.title} description={content.state.description} />
      ) : (
        <>
          <div className="sources-documents">
            {documentList.map((source) => (
              <SourceDocumentCard
                key={source.id}
                source={source}
                name={names.get(source.id) ?? source.title}
                corpusName={linkCorpusName}
                openExcerptIds={openExcerptIds}
                onExcerptOpenChange={setExcerptOpen}
                hits={hits}
                currentHit={currentHit}
                activeCitationNumber={activeNumberHere}
                onReturnToAnswer={returnToAnswer}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
