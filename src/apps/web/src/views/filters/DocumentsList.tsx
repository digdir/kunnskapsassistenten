import { Button, Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef, useState } from 'react';
import { corpusDisplayName } from '../../api';
import { useCorpus } from '../../layout/useCorpus';
import type { SourceDocument } from '../../model';

/** Rows before «Vis flere dokumenter». Five, not Figma's seven: what the panel holds without
 * pushing the upload section below off screen. */
const initiallyVisible = 5;

/** Says why a title is not a link (folder corpora have no public URLs), or it reads as broken.
 * After a comma, not « · »: the dots list what the document is. SourceDocumentCard.tsx has the
 * sentence form; views may not import each other, so a wording change goes in both. */
const NO_LINK_NOTE = 'uten lenke';

/** The same note, capitalised, for a corpus with no type, organisation or year. */
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
  /** The documents behind the answer on screen (src/layout/answerSourcesContext.ts).
   * `undefined` («no answer yet») and `[]` both mean nothing to show here. */
  documents?: SourceDocument[];
};

/** The corpus documents behind the answer; apart from {@link OwnDocuments} so the view can
 * show them above the facets, in sight. No «Velg dokumenter»: a disabled button, as Figma
 * draws it, cannot be reached by keyboard or say why (Designsystemet advises against it). */
export function KudosDocuments({ documents }: KudosDocumentsProps) {
  // useId, not a constant: views can move, and two in different slots would share an id.
  const kudosHeadingId = useId();
  const { option } = useCorpus();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // A new answer starts the list over at five. Set during render, not in an
  // effect, so the longer list is never painted; the chat view hands over the
  // answer's own array, so the identity holds while an answer stands.
  const [listed, setListed] = useState(documents);
  if (listed !== documents) {
    setListed(documents);
    setExpanded(false);
  }

  // Own uploads have their own section. Read off `origin`, never the title, and absent means
  // corpus (src/model/source.ts); not via the sources view's `isOwnDocument`, as views do not
  // import each other. The count and «Vis flere dokumenter» follow this array.
  const fromCorpus = (documents ?? []).filter((source) => source.origin !== 'user');
  const hidden = expanded ? 0 : Math.max(fromCorpus.length - initiallyVisible, 0);
  const shown = hidden === 0 ? fromCorpus : fromCorpus.slice(0, initiallyVisible);

  // «Vis flere dokumenter» removes itself, so focus moves to the list (WCAG 2.4.3), whose
  // heading tells a screen reader what grew. In an effect, so the rows are in the DOM first;
  // only the button sets `expanded`, so this never fires on mount.
  useEffect(() => {
    if (expanded) listRef.current?.focus();
  }, [expanded]);

  return (
    <section className="documents-list">
      <Heading level={3} data-size="xs">
        Dokumenter
      </Heading>
      {/* The corpus line's short name, from the same function, so the two never
          disagree. It also names the list below. */}
      <Heading level={4} data-size="2xs" id={kudosHeadingId}>
        Fra {corpusDisplayName(option)}
      </Heading>

      {fromCorpus.length === 0 ? (
        // «relevante», not the spec's «relevant»: it agrees with «dokumentene».
        <Paragraph data-size="sm">Dokumentene som er relevante for søket ditt vises her.</Paragraph>
      ) : (
        <>
          {/* The documents behind the answer, the only total the frontend knows
              (the spec counts the corpus). Only while some are held back. */}
          {hidden > 0 && (
            <Paragraph data-size="xs" className="documents-list__count">
              Viser {shown.length} av {fromCorpus.length} dokumenter.
            </Paragraph>
          )}

          {/* Focusable for «Vis flere dokumenter», not in the tab order. `ds-focus`
              rings it on :focus-visible only; `ds-focus--visible` would ring it at rest. */}
          <List.Unordered
            data-size="sm"
            aria-labelledby={kudosHeadingId}
            className="documents-list__list ds-focus"
            tabIndex={-1}
            ref={listRef}
          >
            {shown.map((source) => {
              // Named `source`, not `document`: the DOM global.
              const about = aboutLine(source);

              return (
                <List.Item key={source.id}>
                  {source.url === undefined ? (
                    // No link where there is none to give; the row says why (NO_LINK_NOTE).
                    <Paragraph data-size="sm">{source.title}</Paragraph>
                  ) : (
                    <Link href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      {/* In words: Designsystemet advises against an icon alone. */}
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

          {/* Loads more, not navigation: a Button, tertiary as the spec draws a link. */}
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
