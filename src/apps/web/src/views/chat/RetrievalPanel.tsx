import { Details, Paragraph, Tag } from '@digdir/designsystemet-react';
import type { RetrievalDetails } from '../../model';
import { MagnifyingGlassIcon } from '@navikt/aksel-icons';

type RetrievalPanelProps = { retrieval: RetrievalDetails };

/** «10 treff i 3 dokumenter», with correct singular forms. */
function hitSummary({ hitCount, documentCount }: RetrievalDetails): string {
  const hits = hitCount === 1 ? '1 treff' : `${hitCount} treff`;
  const documents = documentCount === 1 ? '1 dokument' : `${documentCount} dokumenter`;
  return `${hits} i ${documents}`;
}

/**
 * The hit count and the search words, at the detailed display level. Open by
 * default, because what makes an answer checkable should not be behind a
 * click, and the count is a neutral Tag: zero hits is a fact, not a failure.
 */
export function RetrievalPanel({ retrieval }: RetrievalPanelProps) {
  return (
    // data-color is neutral so the bar is grey as drawn, not accent blue.
    <Details data-color="neutral" defaultOpen>
      <Details.Summary>
        <span className="ka-retrieval__summary">
          <MagnifyingGlassIcon aria-hidden className="ka-retrieval__icon" />
          {/* The space is written out: JSX drops whitespace containing a
              newline, and the name becomes «Fremgangsmåte10 treff i 3
              dokumenter». */}
          Fremgangsmåte{' '}
          <Tag className="ka-tag--wrapping" data-color="neutral" data-size="sm">
            {hitSummary(retrieval)}
          </Tag>
        </span>
      </Details.Summary>
      <Details.Content>
        <Paragraph data-size="sm">Nøkkelord som ble brukt i søket</Paragraph>
        <ul className="ka-retrieval__keywords">
          {retrieval.keywords.map((keyword) => (
            <li key={keyword}>
              <Tag className="ka-tag--wrapping" data-color="neutral" data-size="sm">
                {keyword}
              </Tag>
            </li>
          ))}
        </ul>
      </Details.Content>
    </Details>
  );
}
