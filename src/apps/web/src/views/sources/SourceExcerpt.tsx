import { Button, Details, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { HighlightedText, type SearchHit } from '../../components';
import { BackIcon } from '../../components/icons';
import { excerptDomId, type Excerpt } from '../../model';
import { kudosLinkLabel, reachesPage } from './kudosLink';
import { excerptName } from './excerptName';

type SourceExcerptProps = {
  excerpt: Excerpt;
  /** The document this excerpt came from, for the accessible names. */
  documentTitle: string;
  /** What to call the corpus, or undefined when nothing names it. */
  corpusName: string | undefined;
  /** 1-based place of this excerpt among the document's, for naming it. */
  position: number;
  /** How many excerpts the document has, for naming an uncited one. */
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Search hits inside this excerpt, in position order. */
  hits: SearchHit[];
  currentHit?: SearchHit;
  /** True while this is the excerpt a `[n]` marker in the answer points at. */
  active: boolean;
  /**
   * Moves focus back to the marker the reader came from, when there is one.
   *
   * Absent for an excerpt the reader opened themselves: a way back to a place
   * they never came from is a control that does nothing.
   */
  onReturnToAnswer?: () => void;
};

/**
 * Where the quote would have been, when its text could not be fetched.
 *
 * One sentence, and it does not offer the way on: «Les dokumentet på Kudos»
 * is the last line of the same document, and a note that asks for what the
 * link under it does is the finding this team already wrote down once
 * (brukerblikk 2026-09-15, funn 9).
 *
 * It says the excerpt is unavailable, not that it is empty. The chunk was
 * retrieved and the answer may cite it; it is the passage lookup that failed.
 */
export const EXCERPT_UNAVAILABLE = 'Utdraget er ikke tilgjengelig.';

/**
 * One excerpt, Figma's `chunk`: a white box inside its document, with its
 * number and the toggle on one row and the quote under them.
 *
 * The number is the whole point of the row. `citationNumber` is the same
 * number as the `[n]` marker in the answer (answer 19), it is the scroll
 * target, and it sits in a heading so a screen reader user can reach it by
 * navigating headings rather than by reading the panel top to bottom. Figma
 * puts a relevance tag there; issue 86 asks for «Utdrag N» instead,
 * and the tag went because every level of it was worked out from the order
 * the chunks came in, not from a score (`relevanceFromRank`).
 *
 * An excerpt can arrive WITHOUT a number: the search finds more than the
 * answer cites, and the model marks `citationNumber` optional for exactly
 * that. Such an excerpt is still worth showing, it just has nothing pointing
 * at it, so it gets no scroll target and says plainly, on the same row, that
 * the answer did not use it.
 *
 * Closed, the row is all there is (issue 86). Figma clips the closed
 * quote and fades it out; the heading path and the first lines stood there
 * too until 30.09, and the box was asked to hold nothing it was not asked to
 * show.
 *
 * Getting here is one click on a `[n]` marker; getting back was eight
 * Shift+Tab that ended somewhere else entirely, and Escape did nothing
 * (design/brukerreiser-2026-09-15.md, punkt 4). So the excerpt the reader was
 * sent to offers both ways back: Escape anywhere inside it, and a visible
 * control at the end of the quote for everyone who does not know that.
 *
 * Open and close is `Details`, decided in answer 38: Figma builds the same
 * toggle by hand in three places (`chunk`, `blackbox`, `expandable`), and
 * `Details` is the one that ships `aria-expanded` and keyboard support for
 * free. It is controlled here because search has to be able to open an excerpt
 * the user never clicked, and the type then requires `onToggle`.
 *
 * `Details` makes the summary a row of its own, and the heading is not in it:
 * a heading inside a summary is a heading inside a button to some screen
 * readers, and this heading is what they navigate by. So the two share a grid
 * cell instead. The heading is drawn over the start of the summary row and
 * the summary's label at its end, which is Figma's one row, and the order in
 * the document is still heading, toggle, quote. See `.source-excerpt` in
 * sources.css.
 */
export function SourceExcerpt({
  excerpt,
  documentTitle,
  corpusName,
  position,
  total,
  open,
  onOpenChange,
  hits,
  currentHit,
  active,
  onReturnToAnswer,
}: SourceExcerptProps) {
  const { citationNumber, heading, text, page, kudosUrl, textUnavailable } = excerpt;
  const cited = citationNumber !== undefined;

  // Unique per excerpt, so a screen reader reading the list of controls does
  // not meet five buttons called «Åpne». See `excerptName.ts` for why a cited
  // and an uncited excerpt are named by different numbers.
  const name = excerptName(citationNumber, position, total);

  /*
    A link of its own only when it goes further than the document's does.

    The document's link is at the end of the document, once (decided 30.09, on
    issue 92). An excerpt that linked to the same address said it again
    under every quote — in live and bff mode `kudosUrl` IS the document's
    address — and Figma's own note on the link says that it belongs a level up
    when it only opens the document. A file URL with `#page=N` opens the page
    the quote is on, and that is worth a link here. See `kudosLink.ts`.
  */
  const pageLink =
    kudosUrl !== undefined && page !== undefined && reachesPage(kudosUrl, page)
      ? kudosUrl
      : undefined;

  return (
    /*
      The keydown sits on the box rather than on a control, so Escape gets the
      reader back from anywhere in the excerpt: from the box itself, where a
      marker puts the focus, and from the toggle, the page link and «Tilbake
      til svaret» inside it. The rule below guards against giving an element
      without a role the behaviour of a control; nothing of the sort happens
      here. Nothing is pressed on the box. It only listens to what bubbles up,
      the same as the form in AnswerSearch.tsx. It was a `Card.Block` until
      30.09, the same `div` to the browser, which the rule could not see
      through.
    */
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="source-excerpt ds-focus"
      // Only a cited excerpt is a scroll target: the id is the one the `[n]`
      // marker links to, and an excerpt with no number has no marker.
      id={cited ? excerptDomId(citationNumber) : undefined}
      data-active={active ? 'true' : undefined}
      data-uncited={cited ? undefined : 'true'}
      // -1 so the panel can move focus here when the answer points at it.
      // Focus, not only scroll: focus is what tells a screen reader user that
      // something happened, and it puts the keyboard where the eye is.
      tabIndex={cited ? -1 : undefined}
      /*
        Escape returns to the marker. Scoped to this box rather than to the
        panel, so it cannot take Escape from the search field, where the
        browser's own `type='search'` handling clears the query.

        `stopPropagation`, because Escape means «out of the thing I am in» to
        anything listening further up, and this is that thing.
      */
      onKeyDown={
        onReturnToAnswer === undefined
          ? undefined
          : (event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              onReturnToAnswer();
            }
      }
    >
      <div className="source-excerpt__head">
        <Heading level={4} data-size="2xs" className="source-excerpt__number">
          {cited ? `Utdrag ${citationNumber}` : 'Utdrag'}
        </Heading>
        {!cited && (
          <Paragraph data-size="xs" className="source-excerpt__uncited">
            Ikke vist til i svaret
          </Paragraph>
        )}
      </div>

      <Details
        className="source-excerpt__details"
        open={open}
        onToggle={(event) => onOpenChange((event.target as HTMLDetailsElement).open)}
      >
        <Details.Summary>
          {open ? 'Lukk' : 'Åpne'}
          {/* The visible label is the one word Figma uses; the accessible name
              says which excerpt it belongs to. */}
          <span className="ds-sr-only"> {name}</span>
        </Details.Summary>
        <Details.Content>
          {/* The first line of the quote in Figma: the section heading from
              the source document, in bold, with the page after it. */}
          {(heading !== undefined || page !== undefined) && (
            <Paragraph data-size="xs" className="source-excerpt__quote-heading">
              {heading !== undefined && <strong>{heading}</strong>}
              {heading !== undefined && page !== undefined && ' · '}
              {page !== undefined && <span className="source-excerpt__page">side {page}</span>}
            </Paragraph>
          )}

          {/* The passage is looked up apart from the answer, so it can be
              missing while the excerpt itself is real and cited. Saying so is
              the whole point: a heading and «Utdrag 1» drawn around a blank
              space read as a rendering fault. The way on is the document's
              link at the end of the document, so this sentence does not
              repeat it (brukerblikk 2026-09-15, funn 9). */}
          {textUnavailable ? (
            <Paragraph
              data-size="sm"
              variant="long"
              className="source-excerpt__quote source-excerpt__quote--unavailable"
            >
              {EXCERPT_UNAVAILABLE}
            </Paragraph>
          ) : (
            <Paragraph data-size="sm" variant="long" className="source-excerpt__quote">
              <HighlightedText
                text={text}
                hits={hits}
                currentHit={currentHit}
                markClassName="sources-mark"
              />
            </Paragraph>
          )}

          {pageLink !== undefined && (
            <Link
              href={pageLink}
              target="_blank"
              rel="noreferrer"
              data-size="sm"
              className="source-link"
            >
              {kudosLinkLabel(pageLink, page, corpusName)}
              {/* Every one of these links could say the same visible words,
                  so the accessible name carries what tells them apart: which
                  excerpt, and which document (WCAG 2.4.9, found by KA CC on
                  #70). The title comes last because the excerpt is what the
                  reader is standing in.

                  The computed name comes out as «… på Kudos , utdrag 1 …»:
                  accname joins a text node and an element with a space, and
                  the only way to drop it is to make the whole name one
                  `aria-label`. Measured with CDP 2026-09-17. It is silent in
                  speech, so it stays. */}
              <span className="ds-sr-only">
                {', '}
                {name}, {documentTitle} (åpnes i ny fane)
              </span>
              {/* Figma's icon for leaving the app. Decorative: the words
                  «åpnes i ny fane» above say it, and Designsystemet asks that
                  an icon never be the only thing that does. Last, because
                  that is where Designsystemet's link gives an icon its gap. */}
              <ExternalLinkIcon aria-hidden />
            </Link>
          )}

          {/* A button, not a link, although the brief calls it a link and it is
              styled like one. It navigates nowhere: it moves focus back to an
              element that has no id to point at, and the one fragment we could
              build would be a real route change that remounts the chat slot
              (see the comment on the marker in Markdown.tsx). A control that
              acts on this page is a button, and the name says where it goes.

              Last in the content, because that is where the reader is by the
              time they want it — after the quote. */}
          {onReturnToAnswer !== undefined && (
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              className="source-excerpt__back"
              onClick={onReturnToAnswer}
            >
              <BackIcon aria-hidden />
              Tilbake til svaret
            </Button>
          )}
        </Details.Content>
      </Details>
    </div>
  );
}
