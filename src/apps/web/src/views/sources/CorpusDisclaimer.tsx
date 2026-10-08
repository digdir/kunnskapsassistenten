import { Paragraph } from '@digdir/designsystemet-react';

/**
 * The disclaimer over the excerpts, in the corpus's own name.
 *
 * It used to say «fra Kudos» whatever the reader was searching, which over
 * NorQuAD's Wikipedia articles is simply wrong — measured live, brukerblikk 6
 * funn 2. The corpus half now comes from `corpusDisplayName`, the same
 * function the filter panel names the corpus with (#110), so the two cannot
 * drift apart and a corpus with no name falls back to «standardkorpuset»
 * rather than to a claim.
 *
 * The own-documents half is #123's and unchanged in substance: with an
 * uploaded file among the sources, «fra <korpus>» alone is false about that
 * excerpt.
 *
 * The sentence that matters is the second one, and it never changes. Nothing
 * here is generated — that is the whole reason the line exists, and it is
 * true of every corpus.
 *
 * Question 25 is still open on the exact wording; the shape is the newer of
 * the two Figma panels, which is also what the curated September page shows.
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
 * It sits below the panel head rather than inside it, and that is a decision,
 * not a leftover.
 *
 * The head is sticky (brukerblikk 2, finding 3), and everything pinned there
 * is taken off the reading area for as long as the reader scrolls. Measured at
 * 1440 with two answers: the head is 219 px of a 778 px region without this
 * line and 292 px with it, 28 % against 38 %. The line says something about
 * the excerpts underneath and never changes, so it is the one part of the old
 * head that loses nothing by scrolling with them.
 *
 * `aria-describedby` resolves by id, not by position, so the search field
 * still carries this as its description wherever it sits.
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
