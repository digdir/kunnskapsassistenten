import { Details, Heading } from '@digdir/designsystemet-react';
import { Markdown, PageTitle } from '../../components';
import './info.css';

/**
 * One piece of an information page. `details` exists because two long example
 * answers are folded away behind «Les svaret»; flattening them would bury the
 * point of the section, the question, under two screens of text.
 */
export type InfoPart =
  { kind: 'markdown'; text: string } | { kind: 'details'; summary: string; text: string };

export type InfoPageProps = {
  /** The page's own name, drawn as its level 1. */
  title: string;
  parts: InfoPart[];
};

/**
 * A page of text in the main column. Its h1 is visible, unlike on the conversation routes,
 * because the page names itself. `Markdown` draws `#` as an h2, so the outline holds.
 */
export function InfoPage({ title, parts }: InfoPageProps) {
  return (
    <article className="info-page">
      <PageTitle name={title} />
      <Heading level={1} data-size="lg">
        {title}
      </Heading>

      {parts.map((part, index) =>
        part.kind === 'markdown' ? (
          // The parts of a page are fixed at build time and never reordered,
          // so the position is a stable identity.
          // oxlint-disable-next-line no-array-index-key
          <Markdown key={index}>{part.text}</Markdown>
        ) : (
          // oxlint-disable-next-line no-array-index-key
          <Details key={index}>
            <Details.Summary>{part.summary}</Details.Summary>
            <Details.Content>
              <Markdown>{part.text}</Markdown>
            </Details.Content>
          </Details>
        ),
      )}
    </article>
  );
}
