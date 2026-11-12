import { Card, Details, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';
import type { SourceDocument } from '../../model';
import {
  distinctTitles,
  documentHeadingDomId,
  excerptRange,
  isOwnDocument,
  OWN_DOCUMENT_LABEL,
} from '../sources';

type SourcesSummaryProps = {
  /** The documents behind this answer, in the order the sources panel has. */
  documents: SourceDocument[];
  /** Opens the sources panel on this document's card, with nothing in it marked. */
  onSelectDocument: (documentId: string) => void;
};

/**
 * «Kilder brukt i svaret» (issue 113): one row per document, saying which
 * `[n]` point into it. **The native list numbers stay, not Figma's circles**:
 * Designsystemet puts a zero-width character in `li::before` for VoiceOver.
 */
export function SourcesSummary({ documents, onSelectDocument }: SourcesSummaryProps) {
  if (documents.length === 0) return null;

  // The same names as the cards in the sources panel: a document's number
  // follows its title when another one in this answer has the same title.
  const names = distinctTitles(documents);

  return (
    <Card className="ka-sources-card" data-color="neutral" variant="tinted">
      <Details className="ka-sources-summary" defaultOpen>
        <Details.Summary>
          <span className="ka-sources-summary__title">
            <FileTextIcon aria-hidden className="ka-sources-summary__icon" />
            Kilder brukt i svaret
          </span>
        </Details.Summary>
        <Details.Content>
          <List.Ordered className="ka-sources-summary__list" data-size="sm">
            {documents.map((document) => {
              const numbers = document.excerpts.map((excerpt) => excerpt.citationNumber);
              // A document cited whole has its own number and no excerpt numbers.
              const first =
                document.citationNumber ??
                numbers.filter((number) => number !== undefined).sort((a, b) => a - b)[0];
              const range = excerptRange(numbers);
              /* An uploaded document's file name can look exactly like a
               corpus title, and this list is read out of context, so the
               accessible name says whose it is. */
              const own = isOwnDocument(document) ? (
                <span className="ds-sr-only">, {OWN_DOCUMENT_LABEL.toLowerCase()}</span>
              ) : null;

              return (
                <List.Item key={document.id}>
                  {first === undefined ? (
                    <>
                      {names.get(document.id) ?? document.title}
                      {own}
                    </>
                  ) : (
                    <Link
                      // Blue as links are, as Figma draws them. The box around
                      // it is neutral, and a link takes its colour from there.
                      data-color="accent"
                      href={`#${documentHeadingDomId(document.id)}`}
                      onClick={(event) => {
                        // The panel does the moving, to the document and not to
                        // its first excerpt (Lars, 2026-11-03). Following the
                        // fragment would be a route change that remounts the
                        // chat slot (see the marker in Markdown.tsx).
                        event.preventDefault();
                        onSelectDocument(document.id);
                      }}
                    >
                      {names.get(document.id) ?? document.title}
                      {own}
                    </Link>
                  )}
                  {range !== '' && (
                    <Paragraph data-size="xs" className="ka-sources-summary__excerpts">
                      {range}
                    </Paragraph>
                  )}
                </List.Item>
              );
            })}
          </List.Ordered>
        </Details.Content>
      </Details>
    </Card>
  );
}
