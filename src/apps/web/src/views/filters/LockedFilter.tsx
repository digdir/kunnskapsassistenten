import { Heading, Link, Paragraph, Tag } from '@digdir/designsystemet-react';
import { useId, type MouseEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { filterDimensions, type FilterSelection } from '../../model';

export type LockedFilterProps = {
  /** The filter the thread on screen is locked to. */
  locked: FilterSelection;
  /** «Ny tråd»: a new conversation, with the reader's own filter. */
  onNewThread?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/** The filter panel while the thread is locked. Every question is asked with the lock (the
    BFF ignores the client's filter), so fields would change nothing. `Tag`, not `Chip`: these
    cannot be removed; in a list, so a screen reader says how many. */
export function LockedFilter({ locked, onNewThread }: LockedFilterProps) {
  const headingId = useId();
  const values = filterDimensions.flatMap((dimension) =>
    locked[dimension].map((value) => ({ dimension, value })),
  );

  return (
    <section className="locked-filter" aria-labelledby={headingId}>
      <Heading level={3} data-size="2xs" id={headingId}>
        Avgrenset til
      </Heading>
      <ul className="locked-filter__values">
        {values.map(({ dimension, value }) => (
          <li key={`${dimension}\u0000${value}`}>
            <Tag data-color="neutral" data-size="sm">
              {value}
            </Tag>
          </li>
        ))}
      </ul>
      <Paragraph data-size="sm" variant="long">
        Tråden er avgrenset til dette, og alle spørsmål i den bruker det. Vil du velge et annet
        filter, starter du en ny tråd.
      </Paragraph>
      {/* What the click does besides navigating is `newThread` in FiltersView. */}
      <Link asChild data-size="sm">
        <RouterLink to="/" onClick={onNewThread}>
          Ny tråd
        </RouterLink>
      </Link>
    </section>
  );
}
