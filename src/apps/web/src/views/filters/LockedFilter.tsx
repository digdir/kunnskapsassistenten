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

/**
 * The filter panel while the thread on screen is locked.
 *
 * Every question in a locked conversation is asked with the filter it was
 * started with: the BFF ignores the one the client sends, and in live the
 * client sends the lock (src/layout/filterContext.ts, `locked`; issue
 * 90). The fields would let the reader
 * change a filter that changes nothing, so they are not drawn: this says what
 * the thread is narrowed to, and where to go to choose something else.
 *
 * `Tag`, not `Chip`: these cannot be removed or changed, and a Chip is a
 * control (chip.md, «Statiske, ikke-fjernbare merkelapper: Tag»). In a list,
 * so a screen reader says how many there are (tag.md).
 *
 * The values alone, in the panel's dimension order, for the reason
 * ActiveFilter gives: the value is the word the reader ticked, and it is
 * word for word the «Avgrenset til» line over every answer in the thread.
 */
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
      {/*
        The router's link, as «Ny tråd» in the thread list is: leaving the
        thread is what lets the lock go, and the panel then shows the fields
        with the reader's own choice in them. What the click does besides
        navigating is the filter view's; see `newThread` there.
      */}
      <Link asChild data-size="sm">
        <RouterLink to="/" onClick={onNewThread}>
          Ny tråd
        </RouterLink>
      </Link>
    </section>
  );
}
