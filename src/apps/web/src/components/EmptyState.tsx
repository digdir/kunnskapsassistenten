import { Heading, Paragraph } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** Norwegian. What is missing, stated plainly. */
  title: string;
  /** Norwegian. What the user can do about it. */
  description?: string;
  /**
   * Heading level for the title. 3 by default, which is what a panel needs:
   * the panel head is the level 2 and this sits under it.
   *
   * It is a prop because the level says where the empty state SITS, and the
   * component cannot know. An empty state that is the whole page — a broken
   * address, a thread that is not there — sits directly under the page's own
   * level 1 and is a level 2. Skipping a level there is a heading order axe
   * reports and a screen reader user has to guess past.
   *
   * How large the title is DRAWN follows from it; see `titleSize` below.
   */
  level?: 2 | 3 | 4;
  /** A button or link that resolves the empty state. */
  children?: ReactNode;
};

/**
 * How large the title is drawn, from where the empty state sits.
 *
 * Derived from `level` rather than taken as a second prop, because the two
 * would be answering the same question and could disagree. `level` already
 * says where this sits — under a panel head, or under the page's own level 1
 * — and how large it should be drawn is that same fact read again.
 *
 * `2xs` is 18 px and right inside a panel: it sits under a panel head at 21
 * or 24, and what is missing is a part of the panel rather than the panel.
 * It was 18 everywhere until 2026-09-15, which made «Siden finnes ikke» the
 * smallest thing on a page it was the whole of — smaller than «Filtrering»
 * in the sidebar beside it, and two pixels above ordinary body text. Funn 2
 * in docs/review/brukerblikk-2-2026-09-15.md.
 *
 * `lg` is 36 px and is not a new size: it is the one the answer column
 * already speaks in. «Hei 👋 / Hva lurer du på?» and a thread's own title are
 * both a level 2 at `lg`, and «Fant ikke tråden» stands exactly where that
 * title would have stood. Matching it is what makes the page read as a page.
 */
const titleSize = { 2: 'lg', 3: '2xs', 4: '2xs' } as const;

/**
 * Nothing to show yet — an empty thread list, a sources panel before the
 * first answer (answer 36). Not an error: an empty state is a normal state,
 * so it carries no alert semantics and announces nothing.
 */
export function EmptyState({ title, description, level = 3, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Heading level={level} data-size={titleSize[level]}>
        {title}
      </Heading>
      {description ? (
        <Paragraph data-size="sm" variant="long">
          {description}
        </Paragraph>
      ) : null}
      {children}
    </div>
  );
}
