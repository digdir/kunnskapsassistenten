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
  /** Back to the marker the reader came from; absent when they opened it themselves. */
  onReturnToAnswer?: () => void;
};

/**
 * Instead of the quote when the passage lookup failed. Unavailable, not empty:
 * the chunk was retrieved and may be cited.
 */
export const EXCERPT_UNAVAILABLE = 'Utdraget er ikke tilgjengelig.';

/**
 * One excerpt, Figma's `chunk`, as «Utdrag N» with N its `[n]` marker. The
 * heading stays out of the summary, which some screen readers read as a button;
 * the two share a grid cell (`.source-excerpt` in sources.css).
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

  // So a list of controls does not hold five buttons called «Åpne».
  const name = excerptName(citationNumber, position, total);

  // Only when it opens the page, since the document's own link is at the end.
  // See `kudosLink.ts`.
  const pageLink =
    kudosUrl !== undefined && page !== undefined && reachesPage(kudosUrl, page)
      ? kudosUrl
      : undefined;

  return (
    // The box only listens to Escape bubbling up from inside it; nothing is
    // pressed on it, so it is not a control.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="source-excerpt ds-focus"
      // Only a cited excerpt is a scroll target: the id is the one the `[n]`
      // marker links to, and an excerpt with no number has no marker.
      id={cited ? excerptDomId(citationNumber) : undefined}
      data-active={active ? 'true' : undefined}
      data-uncited={cited ? undefined : 'true'}
      // Focus, not only scroll, so a screen reader says where the reader is.
      tabIndex={cited ? -1 : undefined}
      // Scoped to the box, so the search field keeps its own Escape.
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
              missing while the excerpt is real and cited. A heading drawn
              around a blank space reads as a rendering fault, so it is said. */}
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
              {/* Which excerpt and document, so the links differ (WCAG 2.4.9).
                  accname puts a space before the comma, silent in speech. */}
              <span className="ds-sr-only">
                {', '}
                {name}, {documentTitle} (åpnes i ny fane)
              </span>
              {/* Decorative: «åpnes i ny fane» says it in words. Last, where
                  Designsystemet's link gives an icon its gap. */}
              <ExternalLinkIcon aria-hidden />
            </Link>
          )}

          {/* A button: a fragment would be a route change that remounts the
              chat slot (see the marker in Markdown.tsx). */}
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
