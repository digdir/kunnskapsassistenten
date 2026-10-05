import { Details, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';
import { excerptDomId, type SourceDocument } from '../../model';
import { distinctTitles, excerptRange, isOwnDocument, OWN_DOCUMENT_LABEL } from '../sources';

type SourcesSummaryProps = {
  /** The documents behind this answer, in the order the sources panel has. */
  documents: SourceDocument[];
  /** Opens the sources panel on an excerpt of this answer, as a marker does. */
  onSelectSource: (citationNumber: number) => void;
};

/**
 * «Kilder brukt i svaret»: the documents the answer is built on, under the
 * answer, as a way into the sources panel (Simens issue 113, Figma
 * 1712:36955).
 *
 * One row per document and not per excerpt. The `[n]` markers in the text are
 * the per-excerpt view, and the panel is the full one. This is the short list
 * a reader takes in at the end of the answer: which reports it rests on.
 *
 * A title opens the panel on that document's first cited excerpt, by the same
 * route a `[n]` marker takes. The panel then switches to this answer's
 * sources, scrolls to the excerpt, opens it and puts the focus there, with
 * «Tilbake til svaret» and Escape as the way back. A document whose excerpts
 * the answer never cited has no number to go to, and its title is text.
 *
 * Numbered by document with the list's own numbers, and with a line under
 * each title: «Utdrag 1–2» says which markers in the text point into it.
 * Without that line, «2.» in this list and «[2]» in the answer are two numbers
 * for different things. `List.Ordered` is a real `<ol>`, so a screen reader
 * says how many documents there are and where in the list it is. Figma draws
 * the numbers in circles; the native ones stay, because `list.md` documents a
 * zero-width character Designsystemet puts in `li::before` against a VoiceOver
 * bug, and a circle drawn there would knock the fix out.
 *
 * This replaced «Snarveier til dokumentene» at the top of the sources panel,
 * the same list once per panel (Simens issue 113): here it stands by the
 * answer it belongs to, where the reader meets it first.
 *
 * Open from the start, as Figma draws it. «Fremgangsmåte» opens only where
 * there is room, because it stands above the answer and would push it out of
 * sight on a phone. This stands under the answer and pushes nothing the reader
 * came for. The reader's own toggle is `Details`' own, uncontrolled.
 *
 * A document icon and not Figma's robot. Figma has the robot from
 * «Fremgangsmåte» here too, and every line in this list is a quote from a
 * document, not something the model made — the panel says so above its list.
 */
export function SourcesSummary({ documents, onSelectSource }: SourcesSummaryProps) {
  if (documents.length === 0) return null;

  // The same names as the cards in the sources panel: a document's number
  // follows its title when another one in this answer has the same title.
  const names = distinctTitles(documents);

  return (
    <Details className="ka-sources-summary" data-color="neutral" defaultOpen>
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
            const first = numbers.filter((number) => number !== undefined).sort((a, b) => a - b)[0];
            const range = excerptRange(numbers);
            /*
             * An uploaded document is named by its file name, and a file name
             * can look exactly like a corpus document's title. A list like
             * this one is read out of context — a screen reader's list of
             * links — so the name says whose it is. Seen on the card as a
             * subtitle in the panel; here only in the name, so the row reads
             * as the others do.
             */
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
                    href={`#${excerptDomId(first)}`}
                    onClick={(event) => {
                      // The panel does the moving, as for a marker. Following
                      // the fragment would be a route change that remounts the
                      // chat slot (see the marker in Markdown.tsx).
                      event.preventDefault();
                      onSelectSource(first);
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
  );
}
