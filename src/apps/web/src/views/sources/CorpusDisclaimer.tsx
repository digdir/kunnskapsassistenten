import { Paragraph } from '@digdir/designsystemet-react';

/**
 * The disclaimer over the excerpts, naming the corpus and the reader's own
 * documents when there are any.
 */
export function sourcesDisclaimer(corpusName: string, hasOwnDocument: boolean): string {
  const source = hasOwnDocument
    ? `dokumentene, både fra ${corpusName} og fra dine egne dokumenter`
    : `dokumentene fra ${corpusName}`;

  return `All tekst er sitater fra ${source}. Ikke generert av kunstig intelligens.`;
}

type CorpusDisclaimerProps = {
  /** `aria-describedby` on the search field points here. */
  id: string;
  /** What to call the corpus, from `corpusDisplayName`. */
  corpusName: string;
  /** True when at least one document in the panel is the reader's own. */
  hasOwnDocument?: boolean;
};

/**
 * Below the sticky head, not in it, so it does not take reading room while the
 * reader scrolls. `aria-describedby` finds it by id wherever it sits.
 */
export function CorpusDisclaimer({
  id,
  corpusName,
  hasOwnDocument = false,
}: CorpusDisclaimerProps) {
  return (
    <Paragraph id={id} data-size="xs" className="sources-search__description">
      {sourcesDisclaimer(corpusName, hasOwnDocument)}
    </Paragraph>
  );
}
