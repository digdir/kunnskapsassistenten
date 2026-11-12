import { Card, Details, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';
import { Fragment } from 'react';
import type { SourceDocument, SourceTarget } from '../sources/types.js';
import { useT } from './i18n.js';

/** One document the answer used: its name, and the numbered excerpts its footnotes cite. */
export interface UsedDocument {
  key: string;
  source: SourceDocument;
  name: string;
  own: boolean;
  /**
   * The document's excerpts that footnotes cite, by number, «Utdrag 1». Empty when the answer
   * cites the document only as a whole, since footnotes are numbered by excerpt only.
   */
  excerpts: readonly { n: number; chunkId: string }[];
}

/**
 * «Kilder brukt i svaret»: one row per document the answer cites, in the order Sources shows
 * them, each a way into that document. Under a title, the excerpts its footnotes cite, «Utdrag 1,
 * Utdrag 3», each a quiet link to that excerpt in Sources.
 */
export const SourcesUsed = ({
  documents,
  href,
  onOpenDocument,
  onOpenExcerpt,
  links,
  excerptLinks,
  counted = false,
}: {
  documents: readonly UsedDocument[];
  href?: ((target: SourceTarget) => string | undefined) | undefined;
  onOpenDocument?: ((source: SourceDocument) => void) | undefined;
  onOpenExcerpt?: ((target: SourceTarget) => void) | undefined;
  /** Each title's link, by document key, so the answer can send focus back to one. */
  links?: Map<string, HTMLElement> | undefined;
  /** Each excerpt's link, by chunk id, so the answer can send focus back to one. */
  excerptLinks?: Map<string, HTMLElement> | undefined;
  /**
   * The dev boards' box (dev-kilder-hoyre, dev-filter-panel): «Kilder · 3 brukt i svaret» in the
   * bar, and the documents numbered, each a link, with no excerpt line under it.
   */
  counted?: boolean | undefined;
}) => {
  const t = useT();
  if (documents.length === 0) return null;
  const DocumentList = counted ? List.Ordered : List.Unordered;
  const keep = (map: Map<string, HTMLElement> | undefined, key: string) =>
    map &&
    ((element: HTMLAnchorElement | null) => {
      if (element) map.set(key, element);
      else map.delete(key);
    });
  return (
    <Card
      className="uib-answer-sources-used-card"
      // The dev boards' box is plain, its bar tinted.
      variant={counted ? 'default' : 'tinted'}
      data-counted={counted || undefined}
    >
      <Details className="uib-answer-sources-used" defaultOpen>
        <Details.Summary>
          {counted ? (
            <span className="uib-answer-sources-used-title">
              {t('answer.sourcesUsedLead')}
              <span className="uib-answer-sources-used-count">
                {t('answer.sourcesUsedCount', { count: documents.length })}
              </span>
            </span>
          ) : (
            <span className="uib-answer-sources-used-title">
              <FileTextIcon aria-hidden className="uib-answer-sources-used-icon" />
              {t('answer.sourcesUsed')}
            </span>
          )}
        </Details.Summary>
        <Details.Content>
          <DocumentList className="uib-answer-sources-used-list" data-size="sm">
            {documents.map(({ key, source, name, own, excerpts }) => {
              // A file name can look exactly like a corpus title, and a list is read out of
              // context, so the name says whose it is. A link carries it in one piece: a hidden
              // box after its words would make a browser read a space before the comma.
              const ownName = own
                ? `${name}, ${t('sources.ownDocument').toLocaleLowerCase(t.locale)}`
                : undefined;
              const target = { documentId: source.documentId, index: source.index };
              const address = href?.(target);
              return (
                <List.Item key={key}>
                  {onOpenDocument || address ? (
                    <Link
                      ref={keep(links, key)}
                      className="uib-answer-sources-used-link"
                      href={address ?? '#'}
                      onClick={
                        onOpenDocument
                          ? (event) => {
                              // The app moves to the document, not to its first excerpt.
                              event.preventDefault();
                              onOpenDocument(source);
                            }
                          : undefined
                      }
                      aria-label={ownName}
                    >
                      {name}
                    </Link>
                  ) : (
                    <>
                      {name}
                      {own ? (
                        <span className="ds-sr-only">
                          , {t('sources.ownDocument').toLocaleLowerCase(t.locale)}
                        </span>
                      ) : null}
                    </>
                  )}
                  {excerpts.length && !counted ? (
                    <Paragraph data-size="xs" className="uib-answer-sources-used-excerpts">
                      {excerpts.map(({ n, chunkId }, i) => {
                        const label = t('sources.excerptNumber', { n });
                        const goal: SourceTarget = { ...target, chunkId };
                        const to = href?.(goal);
                        return (
                          <Fragment key={chunkId}>
                            {i > 0 ? ', ' : null}
                            {onOpenExcerpt || to ? (
                              <Link
                                ref={keep(excerptLinks, chunkId)}
                                className="uib-answer-sources-used-excerpt"
                                href={to ?? '#'}
                                aria-label={t('answer.excerptInSources', { label })}
                                onClick={
                                  onOpenExcerpt
                                    ? (event) => {
                                        // The app shows the excerpt in Sources.
                                        event.preventDefault();
                                        onOpenExcerpt(goal);
                                      }
                                    : undefined
                                }
                              >
                                {label}
                              </Link>
                            ) : (
                              label
                            )}
                          </Fragment>
                        );
                      })}
                    </Paragraph>
                  ) : null}
                </List.Item>
              );
            })}
          </DocumentList>
        </Details.Content>
      </Details>
    </Card>
  );
};
