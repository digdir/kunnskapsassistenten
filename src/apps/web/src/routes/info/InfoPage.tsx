import { Details, Heading } from '@digdir/designsystemet-react';
import { Markdown, PageTitle } from '../../components';
import './info.css';

/**
 * One piece of an information page.
 *
 * Almost everything is markdown. `details` is the exception: the old
 * Kunnskapsassistenten folds two long example answers away behind «Les
 * svaret», and flattening them would bury the point of the section — the
 * question, not the answer — under two screens of text.
 */
export type InfoPart =
  { kind: 'markdown'; text: string } | { kind: 'details'; summary: string; text: string };

export type InfoPageProps = {
  /** The page's own name, drawn as its level 1. */
  title: string;
  parts: InfoPart[];
};

/**
 * A page of text in the answer column: onboarding, the changelog, about the
 * project. The words come from the old Kunnskapsassistenten (issue
 * 85); see the `*Parts.ts` files beside this one.
 *
 * Drawn by `Markdown`, which is the one place the mapping from markdown onto
 * Designsystemet lives — Heading, Paragraph, List, Link, Table. Nothing here
 * styles text of its own, and none of the old page's CSS came along.
 *
 * The title is visible and is the page's h1, unlike the two conversation
 * routes, which hide theirs: those pages are named by the thread, this one is
 * named by itself, and the old page drew the name too. The markdown under it
 * starts at `#`, which `Markdown` draws as an h2, so the outline holds.
 *
 * The shell is mounted with `routeOwnsMain` for these routes, so no chat view
 * is drawn underneath — see App.tsx.
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
