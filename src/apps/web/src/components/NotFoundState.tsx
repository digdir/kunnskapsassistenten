import { Link } from '@digdir/designsystemet-react';
import { Link as RouterLink } from 'react-router';
import { EmptyState } from './EmptyState';

export type NotFoundStateProps = {
  /** Norwegian. What was not found, stated plainly. */
  title: string;
  /** Norwegian. Why it might not be there. */
  description: string;
};

/**
 * An unknown address or thread id, with the one way out. An `EmptyState`, not an `ErrorState`:
 * the page IS this, and `role="alert"` would announce what the reader is about to read anyway.
 * Level 2, directly under the route's h1.
 */
export function NotFoundState({ title, description }: NotFoundStateProps) {
  return (
    <EmptyState level={2} title={title} description={description}>
      <Link asChild>
        <RouterLink to="/">Gå til forsiden</RouterLink>
      </Link>
    </EmptyState>
  );
}
