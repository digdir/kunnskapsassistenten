// «Dokumentene som blir med», the dev boards' box under the filter (dev-filter-panel; «9 ·
// Filtrering», choice 7): how many documents the next question reads from, on a neutral ground,
// and, where the host has them, the documents themselves: each with a tick to leave it out when
// the host can, or else a plain list, each title a link where the host has one.
import { Checkbox, Input, Link } from '@digdir/designsystemet-react';
import { ChevronDownIcon, ChevronUpIcon } from '@navikt/aksel-icons';
import { useId, useState, type ReactNode } from 'react';
import { corpusName, type CorpusOption } from '../corpus/Corpus.js';
import { classes } from '../dom.js';
import { useT } from './i18n.js';

/** A document the next question reads from, as the host knows it. */
export interface DocumentInScope {
  id: string;
  title: string;
  /** Who published it. */
  organisation?: string | undefined;
  year?: number | string | undefined;
  /** Where the document opens, in a new tab: the title is a link. */
  href?: string | undefined;
  /** Ticked: it is read. Unticked: the reader left it out. */
  included: boolean;
}

export interface DocumentsInScopeProps {
  /** How many documents the next question reads from; the summary is drawn only when known. */
  count?: number | undefined;
  /** How many the collection has in all. */
  total?: number | undefined;
  /** The collection, which names the summary: «… i Kudos». */
  corpus?: CorpusOption | undefined;
  /** The documents, most relevant first. The list is drawn only with them. */
  documents?: readonly DocumentInScope[] | undefined;
  /**
   * The reader ticked or unticked a document. Without it there are no ticks: the documents are a
   * plain list, since a tick that cannot be changed reads as a broken one.
   */
  onIncludedChange?: ((id: string, included: boolean) => void) | undefined;
  /** Open when it first shows; the reader folds it with «Skjul». */
  defaultOpen?: boolean | undefined;
  headingLevel?: 3 | 4 | 5 | 6 | undefined;
  className?: string | undefined;
}

/** The documents the next question reads from: their number, and the list where the host has it. */
export const DocumentsInScope = ({
  count,
  total,
  corpus,
  documents,
  onIncludedChange,
  defaultOpen = true,
  headingLevel = 3,
  className,
}: DocumentsInScopeProps) => {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const name = corpusName(corpus) ?? t('corpus.unnamed');
  const summary =
    count === undefined
      ? undefined
      : total === undefined
        ? t('documents.inScopeCountOnly', { count, name })
        : t('documents.inScopeCount', { count, total, name });
  const listed = documents ?? [];
  if (summary === undefined && listed.length === 0) return null;

  const needle = query.trim().toLocaleLowerCase(t.locale);
  const shown = needle
    ? listed.filter((document) =>
        [document.title, document.organisation ?? ''].some((text) =>
          text.toLocaleLowerCase(t.locale).includes(needle),
        ),
      )
    : listed;
  const Heading = `h${headingLevel}` as 'h3';

  return (
    <section className={classes('uib-documents-scope', className)} aria-labelledby={`${id}-title`}>
      <Heading className="uib-documents-scope-heading">
        <button
          type="button"
          className="uib-documents-scope-toggle"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((shown) => !shown)}
        >
          <span id={`${id}-title`} className="uib-documents-scope-title">
            {t('documents.inScope')}
          </span>{' '}
          <span className="uib-documents-scope-fold">
            {open ? t('documents.inScopeHide') : t('documents.inScopeShow')}
            {open ? <ChevronUpIcon aria-hidden /> : <ChevronDownIcon aria-hidden />}
          </span>
        </button>
      </Heading>

      <div id={`${id}-body`} className="uib-documents-scope-body" hidden={!open}>
        {summary === undefined ? null : <p className="uib-documents-scope-summary">{summary}</p>}

        {listed.length > 0 ? (
          <>
            {onIncludedChange ? (
              <p className="uib-documents-scope-hint">{t('documents.inScopeHint')}</p>
            ) : null}
            <Input
              type="search"
              className="uib-documents-scope-search"
              aria-label={t('documents.inScopeSearch')}
              placeholder={t('documents.inScopeSearchHint')}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            {shown.length === 0 ? (
              <p className="uib-documents-scope-hint">{t('documents.inScopeNone')}</p>
            ) : (
              <ul className="uib-documents-scope-list" aria-labelledby={`${id}-title`}>
                {shown.map((document) => {
                  // «Virksomhet, år» under the title, as the dev boards draw it (dev-filter-panel).
                  const about = [
                    document.organisation,
                    document.year === undefined ? undefined : String(document.year),
                  ].filter(Boolean);
                  const text = (name: ReactNode) => (
                    <span className="uib-documents-scope-text">
                      <span className="uib-documents-scope-name">{name}</span>
                      {about.length > 0 ? (
                        <span className="uib-documents-scope-about">{about.join(', ')}</span>
                      ) : null}
                    </span>
                  );
                  return (
                    <li key={document.id}>
                      {onIncludedChange ? (
                        <Checkbox
                          className="uib-documents-scope-document"
                          checked={document.included}
                          onChange={(event) =>
                            onIncludedChange(document.id, event.currentTarget.checked)
                          }
                          label={text(document.title)}
                        />
                      ) : (
                        <div className="uib-documents-scope-document">
                          {text(
                            document.href ? (
                              <Link href={document.href} target="_blank" rel="noreferrer">
                                {document.title}
                              </Link>
                            ) : (
                              document.title
                            ),
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
};
