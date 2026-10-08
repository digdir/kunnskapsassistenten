import { Button, Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef, useState } from 'react';
import { corpusDisplayName } from '../../api';
import { useCorpus } from '../../layout/useCorpus';
import type { SourceDocument } from '../../model';

/**
 * How many documents are listed before «Vis flere dokumenter».
 *
 * Figma draws seven rows and the button under them, so the number is not in
 * the spec. Five is what the panel holds without the upload section below
 * being pushed off screen at the drawn width.
 */
const initiallyVisible = 5;

/**
 * Why a document in this list is not a link.
 *
 * The sources panel has said «Dokumentet har ingen offentlig lenke.» about
 * the same document since it was built, while this list simply drew some
 * titles as links and some as plain text and left the reader to wonder which
 * of them was broken (brukerblikk 7, funn 2). It is normal, not an error:
 * a folder-based corpus has no public addresses.
 *
 * Two words, and what they buy is measured rather than assumed. This list is
 * an index in a 327 px panel, not a card with room for a sentence, and the
 * note shares the row's small line with the document's properties. At 1440
 * that line is 306 px: «, uten lenke» takes 66 of them against the sentence's
 * 123, so there is a band of about 57 px of properties where this fits on one
 * line and the sentence would have wrapped it to two.
 *
 * Outside that band the wording changes nothing, and the mock corpus is
 * outside it in both directions (measured 22.09): «Instruks · Nasjonal
 * kommunikasjonsmyndighet · 2024» fills the line on its own, so the row goes
 * 62 → 80 px whichever note it carries, while «Instruks · Nkom · 2024» leaves
 * room for either. The 18 px is the price of saying it at all — and a
 * non-link that says nothing reads as a link that failed, which is the finding
 * this answers.
 *
 * A comma before it rather than a fourth « · »: the dots separate what the
 * document IS, and this is about the row, not another property of the
 * document (#138).
 *
 * The sentence in `src/views/sources/SourceDocumentCard.tsx` is the other
 * copy. Two views may not import each other — the shell holds what they
 * share — so if the wording changes, it changes in both places.
 */
const NO_LINK_NOTE = 'uten lenke';

/**
 * The same note where it has to start the line, which is a corpus that knows
 * neither type, organisation nor year. Same words; a line in this list begins
 * with a capital like every other.
 */
const NO_LINK_ALONE = 'Uten lenke';

/** The row's small line: what the document is, and whether it can be opened. */
function aboutLine(source: SourceDocument): string {
  const properties = [source.documentType, source.organisation, source.year]
    .filter((part) => part !== undefined)
    .join(' · ');

  if (source.url !== undefined) return properties;
  return properties === '' ? NO_LINK_ALONE : `${properties}, ${NO_LINK_NOTE}`;
}

export type KudosDocumentsProps = {
  /**
   * The documents behind the answer on screen, held by the shell. See
   * src/layout/answerSourcesContext.ts.
   *
   * `undefined` («no answer yet») and `[]` («an answer with nothing behind
   * it») are different states over in the sources panel, but not here: both
   * mean there is no document to look at, and the panel says so the same way.
   */
  documents?: SourceDocument[];
};

/**
 * The documents from Kudos that the answer on screen builds on.
 *
 * This and {@link OwnDocuments} were one component, drawn as one column at
 * the foot of the panel, because that is where Figma draws them. In a panel
 * that scrolls they ended up under the window edge: measured at 1440 × 900
 * with an answer on screen, the first row started at y = 818 in a 900 px
 * window, under the corpus line and three facet fields (brukerblikk runde 2,
 * funn 4). What changes with every answer sat below what changes rarely.
 *
 * So the two halves are separate components now, and the view puts this one
 * above the facets. They were only together because they shared a heading;
 * splitting costs that grouping and buys a list the reader can see. See
 * FiltersView for the ordering and why it does not touch answer 1.
 *
 * Two deliberate omissions against the Figma frame:
 *
 *   «Velg dokumenter» is drawn greyed out in the empty state. A disabled
 *   button is not reachable by keyboard and says nothing about why, and
 *   Designsystemet's own JSDoc advises against it, so the button is simply
 *   not rendered until there is something to choose between. The sentence
 *   under «Fra Kudos» already explains the state. It is not built in the
 *   active state either: the frame never draws a selected row, so there is
 *   no state for it to put the list into (answers 8 and 9).
 *
 *   The upload zone is drawn as a drop target with a button. Upload does not
 *   exist anywhere in the stack (API-bestilling A3), and question 9 is still
 *   open, so this is text, not a control. A dashed box that looks droppable
 *   but drops nothing is worse than a sentence that says so.
 */
export function KudosDocuments({ documents }: KudosDocumentsProps) {
  // Not a module constant: two filter views in different slots would then
  // share one id, and the layout model exists so views can be moved.
  const kudosHeadingId = useId();
  const { option } = useCorpus();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * A new answer brings a new set of documents, and the list starts over at
   * five. Adjusted during render with a remembered previous value rather than
   * in an effect: React re-runs the component with the new state before it
   * commits, so the longer list is never painted. The identity is stable
   * while an answer stands — the chat view hands over the answer's own array.
   */
  const [listed, setListed] = useState(documents);
  if (listed !== documents) {
    setListed(documents);
    setExpanded(false);
  }

  /*
   * The reader's own uploads are left out, however much the answer leaned on
   * them. The heading over this list says «Fra <korpus>», and a file only the
   * reader holds did not come from there; it has its own section further down
   * the panel, and stood in both places at once until now (brukerblikk 6,
   * funn 1). Same file, two headings, one of them wrong.
   *
   * Read off `origin` and never off the title, and absent means corpus — the
   * model's own rule (src/model/source.ts). The sources panel splits on the
   * same field through its `isOwnDocument`; that helper lives in #4's view,
   * so this reads the model instead of tying two views together.
   *
   * The count under the heading and «Vis flere dokumenter» both follow from
   * this array, so neither counts a document the list does not show.
   */
  const fromCorpus = (documents ?? []).filter((source) => source.origin !== 'user');
  const hidden = expanded ? 0 : Math.max(fromCorpus.length - initiallyVisible, 0);
  const shown = hidden === 0 ? fromCorpus : fromCorpus.slice(0, initiallyVisible);

  /*
   * «Vis flere dokumenter» removes itself with the click that hits it, and a
   * control that disappears has to say where focus goes, or a keyboard user
   * lands on `<body>` and tabs from the skip link again (WCAG 2.4.3). The
   * list is what the click produced, so focus goes there — and because the
   * list is labelled by «Fra Kudos», a screen reader says which list grew and
   * how many rows it now has.
   *
   * On `expanded` and not in the handler: the rows have to be in the DOM
   * before the list can take focus. `expanded` starts false and only the
   * button sets it, so this never fires on mount.
   */
  useEffect(() => {
    if (expanded) listRef.current?.focus();
  }, [expanded]);

  return (
    <section className="documents-list">
      <Heading level={3} data-size="xs">
        Dokumenter
      </Heading>
      {/*
        The corpus, not the constant «Kudos». The line four elements up said
        «Dokumenter fra Wikipedia (NorQuAD)» while this one still said «Fra
        Kudos» over the same documents (brukerblikk 5, funn 1) — the same
        claim #106 took out of the line, one element further down the panel.

        The same short name the line uses, from the same function, so the two
        cannot disagree about what to call one corpus. The list below is
        labelled by this heading, so its accessible name follows.
      */}
      <Heading level={4} data-size="2xs" id={kudosHeadingId}>
        Fra {corpusDisplayName(option)}
      </Heading>

      {fromCorpus.length === 0 ? (
        /*
            The spec reads «Dokumentene som er relevant for ditt søk vises her».
            Deliberate deviation: «relevant» has to agree with «dokumentene».
          */
        <Paragraph data-size="sm">Dokumentene som er relevante for søket ditt vises her.</Paragraph>
      ) : (
        <>
          {/*
              «Viser 7 av 15 dokumenter.» in the spec, against a corpus the
              panel cannot see. Ours counts the documents behind the answer,
              which is the only total the frontend knows.

              Only while something is held back: with every document listed
              the line says «Viser 3 av 3 dokumenter», which is noise, and it
              leaves together with the button that made it worth reading.
            */}
          {hidden > 0 && (
            <Paragraph data-size="xs" className="documents-list__count">
              Viser {shown.length} av {fromCorpus.length} dokumenter.
            </Paragraph>
          )}

          {/*
              `tabIndex={-1}` so «Vis flere dokumenter» has somewhere to put
              focus; the list is not in the tab order. `ds-focus` draws
              Designsystemet's ring on :focus-visible — the keyboard user who
              gets sent here sees it, the mouse user does not. NOT
              `ds-focus--visible`, which is the forced-on variant and paints a
              ring around the list at rest.
            */}
          <List.Unordered
            data-size="sm"
            aria-labelledby={kudosHeadingId}
            className="documents-list__list ds-focus"
            tabIndex={-1}
            ref={listRef}
          >
            {shown.map((source) => {
              // Named `source`, not `document`: the DOM global.
              //
              // The line carries the sources panel's rule, said in this
              // panel's words: a document with a public address is a link,
              // and one without says why it is not.
              const about = aboutLine(source);

              return (
                <List.Item key={source.id}>
                  {source.url === undefined ? (
                    // Normal, not an error: folder-based corpora have no
                    // public URL, and a title without a link beats a link
                    // that goes nowhere. The row says as much below the
                    // title — see NO_LINK_NOTE.
                    <Paragraph data-size="sm">{source.title}</Paragraph>
                  ) : (
                    <Link href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      {/* Designsystemet says not to mark an external link
                            with an icon alone, so the fact that it leaves the
                            app is said in words. */}
                      <span className="ds-sr-only"> (åpnes i ny fane)</span>
                    </Link>
                  )}
                  {about !== '' && (
                    <Paragraph data-size="xs" className="documents-list__about">
                      {about}
                    </Paragraph>
                  )}
                </List.Item>
              );
            })}
          </List.Unordered>

          {/*
              An action that loads more, not navigation, so a Button — the
              spec links it to `button.tsx` and draws it as a link, and
              `documents-list.md` settles that as tertiary. See
              design/designsystemet/behov-til-komponent.md.
            */}
          {hidden > 0 && (
            <Button
              variant="tertiary"
              data-size="sm"
              data-color="neutral"
              onClick={() => setExpanded(true)}
            >
              Vis flere dokumenter
            </Button>
          )}
        </>
      )}
    </section>
  );
}
