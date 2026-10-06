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

/**
 * Scrolling and focusing are two different things, and conflating them was a
 * bug in the first version of this file.
 *
 * `scrollTo` is «the content moved under you»: search-as-you-type, and
 * stepping through hits. The keyboard has to stay where the user put it, in
 * the field or on the «Neste» button, or the control makes itself unusable.
 *
 * `scrollToAndFocus` is «you asked to be moved here»: a `[n]` marker in the
 * answer, or a title in «Kilder brukt i svaret» under it, which takes the
 * marker's route. Focus is what makes a screen reader read
 * the excerpt on arrival, and what makes the next Tab continue from there.
 *
 * `preventScroll` keeps the browser's own focus scroll from cutting the
 * smooth scroll short.
 */
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

/**
 * The `[n]` marker that sent the reader here, so Escape and «Tilbake til
 * svaret» can put focus back on it.
 *
 * The marker has no id and this view may not give it one — it is drawn in the
 * main column, which another worker owns — so the element is found rather than
 * addressed. Two ways, in order:
 *
 *   1. The marker the reader just activated still has focus. That is the right
 *      one when the same number is written twice in an answer, which the
 *      sample answer does.
 *   2. Otherwise, any marker pointing at this excerpt. Safari does not focus a
 *      link on click unless full keyboard access is on, so step 1 finds
 *      `<body>` there, and a way back to roughly the right place beats none.
 *
 * The `href` is checked in both, because focus could be sitting on something
 * else entirely — a shortcut in the list, the «Neste» button — and returning
 * to that would be worse than doing nothing.
 */
function markerFor(citationNumber: number): HTMLElement | null {
  const href = `#${excerptDomId(citationNumber)}`;
  const focused = document.activeElement;

  if (focused instanceof HTMLElement && focused.getAttribute('href') === href) return focused;

  return document.querySelector<HTMLElement>(`a[href="${href}"]`);
}

/**
 * Where a marker stood, so it can be found again once the answer is drawn anew.
 *
 * The element alone is not enough. The answer's paragraphs are react-markdown's,
 * and a render that gives it a new citation list or a new search query mounts
 * them again: the marker the reader clicked is swapped for an equal one, and
 * the element kept here is no longer in the page. Measured against the pod
 * 29.09: a click on [2] replaced four markers, and «Tilbake til svaret» left
 * focus on itself. The container around the answer is not mounted again, so
 * the marker is also kept as that container, its href, and which of the equal
 * markers in it it was.
 */
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

/**
 * One answer's worth of sources, whichever prop carried it.
 *
 * `answers` is the shape the panel wants and the shell does not hold yet
 * (rolle-5h). `documents` is the one flat list it does hold. Normalising here
 * means everything below this function sees one thing, and the day the shell
 * sends `answers` the only change is that this branch stops being taken.
 *
 * `[]` and `undefined` are kept apart on both paths, because they are
 * different answers: undefined is «nothing is known yet», `[]` is «nothing has
 * been asked».
 */
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

/**
 * The four states, in one place and in order.
 *
 * Early returns rather than nested conditions in the JSX, because the last two
 * depend on having ruled out the first two — `emptyStateFor` does not take
 * `streaming`, and the compiler is what holds that.
 */
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
 * The sources view: the content of the secondary sidebar (answer 49).
 *
 * The shell owns the collapse button and hides this whole subtree with
 * `hidden` when the slot is collapsed, so there is no «Vis kilder» button
 * here. What is here is the search, the shortcut list, and one card per
 * document with the excerpts grouped under it (answer 57).
 *
 * **One answer at a time.** A thread has several answers and each numbers its
 * excerpts from 1, so a single flat list made `[2]` in the first answer open
 * the second answer's excerpt 2 — right-looking and wrong (brukerreiser punkt
 * 5). The panel shows the newest answer by default, follows a new one when it
 * arrives, and switches when a marker in an older answer is activated.
 * `AnswerSwitcher` says which one is on screen, because otherwise two sets are
 * indistinguishable.
 *
 * Four states, not two:
 *
 *   answers === undefined      loading, `excerpts-placeholder` from Figma
 *   answers.length === 0       nothing asked yet, an empty state (answer 36)
 *   answer with no documents   what became of it, per status (`emptyStates.ts`)
 *   otherwise                  the sources
 *
 * Figma only draws the skeleton version, but skeletons promise content that is
 * on its way. Before the first question nothing is on its way, and `Skeleton`
 * is `aria-hidden`, so those states have to be said in words instead.
 *
 * The tools menu and notes land in this same slot later, as views beside this
 * one (answers 22 and 52). Nothing here assumes it is alone in the slot.
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

  // Which answer the reader stepped or was sent to. `undefined` means «the
  // newest», which is what it goes back to whenever a new answer arrives: a
  // fresh answer is a fresh event, the panel opens itself for it (PR #30), and
  // showing an older set beside it would be the same lie in reverse.
  const [chosenMessageId, setChosenMessageId] = useState<string | undefined>(undefined);
  const [followedMessageId, setFollowedMessageId] = useState(newestMessageId);
  if (followedMessageId !== newestMessageId) {
    setFollowedMessageId(newestMessageId);
    setChosenMessageId(undefined);
  }

  const chosenIndex = answersOnScreen.findIndex((answer) => answer.messageId === chosenMessageId);
  const activeIndex = chosenIndex >= 0 ? chosenIndex : answersOnScreen.length - 1;
  const activeAnswer = answersOnScreen[activeIndex];

  // Readable once, here, so the search, the closed preview and the open quote
  // all measure and draw the same string. See `readableText.ts`.
  const documentList = useMemo(
    () => readableDocuments(activeAnswer?.documents ?? []),
    [activeAnswer],
  );
  // Two documents with one title get their numbers, here and under the answer.
  const names = useMemo(() => distinctTitles(documentList), [documentList]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A `[n]` marker in the answer is an event we do not own — it arrives as a
  // prop — so the excerpt is opened while rendering the change, which is
  // React's documented way to adjust state when a prop changes. The scroll is
  // a separate effect, because it has to happen after the layout.
  //
  // All three parts are compared, not just the nonce: the number alone covers
  // a caller that sends no nonce, the nonce is what makes a second click on
  // the SAME marker count as a new request (answer 19), and the message id
  // changes when the reader clicks a marker in a different answer.
  //
  // `shownFor` is not part of the comparison; it is what the block records.
  // It is the answer the citation was resolved against, and it is what makes
  // the active marker stay behind when the reader steps to another answer:
  // the highlight and the way back belong to the answer the reader was sent
  // to, not to whichever answer happens to show an excerpt with that number.
  // Recording it here rather than reading `activeCitationMessageId` later
  // means it is right in both states the shell passes through — with the
  // message id, and without it, where the marker is resolved against the
  // answer on screen at the time.
  const [handled, setHandled] = useState<
    { number?: number; nonce?: number; messageId?: string; shownFor?: string } | undefined
  >(undefined);
  if (
    handled?.number !== activeCitationNumber ||
    handled?.nonce !== activeCitationNonce ||
    handled?.messageId !== activeCitationMessageId
  ) {
    // The marker says which answer it sits in, so the panel switches to that
    // set before looking the excerpt up in it. Without the id — which is where
    // the chat view still is — the marker is resolved against whatever is on
    // screen, exactly as before.
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

    // A marker pointing into a collapsed panel does nothing, and the default
    // layout starts collapsed, so this is the first-run case rather than an
    // edge case. The shell's own `showCitation` opens the panel too; this view
    // does not depend on that, because it is the one that knows a citation
    // arrived.
    if (target !== undefined && collapsed) onCollapsedChange?.(false);
  }

  // The same guard the render phase has. Effects run on mount, so without it a
  // view mounted with a citation already set steals focus before the user has
  // done anything — which is exactly what happens when the shell mounts this
  // view after an answer has arrived, or when the view is moved between slots.
  const revealedCitation = useRef<{ number?: number; nonce?: number }>({
    number: activeCitationNumber,
    nonce: activeCitationNonce,
  });

  // Where «Tilbake til svaret» and Escape go.
  const returnTarget = useRef<MarkerPlace | null>(null);

  /*
   * The marker as the reader activated it, recorded in the capture phase of
   * the click: before the main column's own handler starts the render that can
   * replace it, and so before the citation reaches the effect below. By then
   * focus may be on `<body>`, and «any marker with this href» is the first
   * answer's [n] even when the reader clicked the second's. A click inside
   * this view is not a marker in the answer.
   */
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

  /**
   * Back to the marker the reader came from.
   *
   * `isConnected` because the answer can be replaced under the panel — a new
   * question, a different thread — and focusing a detached element silently
   * drops focus to `<body>`, which is the bug this whole control exists to fix.
   */
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

  /**
   * Stepping to another answer resets the search: the query was aimed at the
   * excerpts that were on screen, and a hit counter counting a set the reader
   * can no longer see is worse than an empty field.
   */
  function stepToAnswer(step: 1 | -1) {
    const next = activeIndex + step;
    const answer = answersOnScreen[next];
    if (answer === undefined) return;

    setChosenMessageId(answer.messageId);
    setQuery('');
    setCurrentHitIndex(0);
  }

  /**
   * A new query restarts at the first hit and opens every excerpt that has
   * one. Opening them is the point of the counter: «3 av 26 treff» means
   * nothing if the matches sit behind closed toggles. The user can close them
   * again afterwards.
   *
   * It scrolls but does not focus. Focusing here would take the keyboard out
   * of the field the user is typing in, and the field would be unusable past
   * the first two characters.
   */
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

  /**
   * Previous and next also open the excerpt they land on, for the same reason
   * the search does, and they leave focus on the button so the user can press
   * it again. The live region on the counter is what announces the move.
   */
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

  /*
   * The corpus the ANSWER on screen came from, not the one the chooser stands
   * on now.
   *
   * Switching corpus starts a new thread, so the two agree while a reader
   * moves forward. They part the moment an older thread is opened: KA CC
   * measured «fra Wikipedia (mock)» standing over the Nkom card of a Kudos
   * thread (bør on #129). The excerpts under the line do not change when the
   * chooser moves, so the line must not either.
   *
   * The active corpus is the fallback and only that — an answer from before
   * the key travelled, or a turn where nothing said which corpus answered.
   * Naming the current choice there is a guess, but it is the best one
   * available and it is right in the common case, where nobody has switched.
   *
   * `useActiveCorpus` rather than the store by hand (#129): the hook is that
   * subscription with the navigating half of `useCorpus` left out, so this
   * view no longer has to know the store exists and still mounts outside a
   * Router, `preview/` included.
   */
  const activeCorpus = useActiveCorpus();
  const corpusKey = corpusKeyFor(activeAnswer?.corpusKey, activeCorpus.key);
  const corpusName = corpusDisplayNameFor(corpusKey);

  /*
   * The same corpus, but undefined when nothing actually names it.
   *
   * The disclaimer is a sentence about where the text came from and has to
   * say something, so it takes the “standardkorpuset” stand-in. A link label
   * is not a sentence, and «Les dokumentet på standardkorpuset» is a clumsy
   * name for a control — there the link says only what it does (dirigenten,
   * 21.09). `corpusOption` is the lookup the stand-in hides.
   */
  const linkCorpusName = corpusOption(corpusKey) === undefined ? undefined : corpusName;

  const content = panelContentFor(answerList, activeAnswer, activeCorpus.displayName);

  /**
   * The marker is active on the answer the reader was sent to, and nowhere
   * else.
   *
   * Every answer numbers its excerpts from 1, so `[1]` exists in all of them.
   * Comparing only the number meant that stepping from the cited answer to
   * another one carried the blue band and «Tilbake til svaret» along to an
   * excerpt nobody had been sent to, offering a way back from a place the
   * reader never left (KA CC on PR #36).
   */
  // One string, said in two places: the visible row and the live region that
  // announces it. Empty while there is only one answer, which is what keeps
  // the region silent without taking it out of the document.
  const answerLabel =
    answersOnScreen.length > 1
      ? `Kilder til svar ${activeIndex + 1} av ${answersOnScreen.length}`
      : '';

  const citationIsOnScreen =
    handled?.shownFor !== undefined && handled.shownFor === activeAnswer?.messageId;
  const activeNumberHere = citationIsOnScreen ? activeCitationNumber : undefined;

  return (
    <div className="sources-view">
      {/* Which answer is on screen, for a screen reader.

          Mounted from the first render and never taken away, empty while there
          is nothing to say. A live region has to exist BEFORE its content
          changes; mounting it together with the text — which is what the
          visible row does, since it appears with the second answer — means the
          one announcement that matters is the one that is never made.

          `<output>` is `role="status"`, the same element and the same reason as
          the loading line in `SourcesPlaceholder`. The visible counter carries
          the identical string and is `aria-hidden`, so nothing is said twice. */}
      <output className="ds-sr-only">{answerLabel}</output>

      {/* The panel head: what the reader needs while scrolling the excerpts.

          It stays put, because a marker scrolls the panel to where the excerpt
          is and took «Kilder til svar 1 av 2» with it, so the one line that
          makes «Utdrag 2» unambiguous was gone exactly while the reader was
          looking at utdrag 2 (brukerblikk 2, finding 3). The search field is
          here for the same reason and because today's KA already pins it
          (eksisterende funksjonalitet/søk i kildene.md).

          The box belongs to the shell now, and this says what goes in it.
          Nothing changes on screen: this panel has no view switcher above its
          head, which is the only reason it could pin its own in #54 while the
          navigation panel could not in #55. See src/layout/viewHeadContext.ts.

          It always holds the panel's heading, so the box that carries the
          border is there from the first render and does not appear and
          disappear as answers arrive. */}
      <ViewHead>
        {/* «Kilder», visible, as Figma has it over the search (node 1549-46119)
            and as the navigation panel has «Filtrering»: the same
            `PanelHeader` at the same size, so the two panels start alike.
            Decided 30.09: nearer the design. It was a screen-reader-only
            heading before, on the grounds that the toggle carried the word;
            the toggle is an icon, and says it only in its tooltip.

            In the pinned head like «Filtrering», and first in it, so it stays
            with the search field while the excerpts scroll. The document
            titles below are level 3 under it. */}
        <PanelHeader title="Kilder" size="sm" />

        {/* Shown whenever the thread has more than one answer, including while
            the answer on screen has nothing to show: stepping back to the
            answer that DID have sources is the whole point of it then. */}
        {answersOnScreen.length > 1 && (
          <AnswerSwitcher
            label={answerLabel}
            index={activeIndex}
            count={answersOnScreen.length}
            onStep={stepToAnswer}
          />
        )}

        {/* No search field when there is nothing to search. It stays during
            loading, so the layout does not shift when the sources arrive. */}
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
