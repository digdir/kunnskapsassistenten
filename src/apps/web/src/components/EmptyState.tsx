import { Heading, Paragraph } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
  /** Norwegian. What is missing, stated plainly. */
  title: string;
  /** Norwegian. What the user can do about it. */
  description?: string;
  /** Title level: 3 under a panel head, 2 for a whole page, so no level is skipped. */
  level?: 2 | 3 | 4;
  /** A button or link that resolves the empty state. */
  children?: ReactNode;
};

/** Size from `level`, not a second prop that could disagree: `2xs` in a panel, `lg` as a page. */
const titleSize = { 2: 'lg', 3: '2xs', 4: '2xs' } as const;

/** Nothing to show yet. A normal state, not an error, so no alert semantics and no announcement. */
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
