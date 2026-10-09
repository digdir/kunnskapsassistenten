import { Link, Paragraph } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import type { CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';
import { corpusLine } from './corpusText';

export type CorpusLineProps = {
  /** The unconditional facets, or undefined while they load. */
  facets?: FilterFacet[];
  /** The corpus being searched, when one is known. */
  corpus?: CorpusOption;
};

/** The corpus name, with the rest behind «Vis mer»: the whole sentence wraps to two lines. A
    button with `aria-expanded`, not `Details`, whose summary would take a line of its own. The
    open state survives a corpus switch: the reader is reading what just changed. */
export function CorpusLine({ facets, corpus }: CorpusLineProps) {
  const { source, detail } = corpusLine(facets, corpus);
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <Paragraph asChild data-size="xs">
      <div className="filters-view__corpus">
        <span className="filters-view__corpus-source">{source}</span>

        {detail && (
          <>
            {/* `button` for `aria-expanded`; `Link` keeps it as tall as the text, where
                Designsystemet's `Button` (42 px at `sm`) would set the row's height. The label
                says what of, for a reader who lists the buttons out of context. */}
            <Link asChild className="filters-view__corpus-toggle">
              <button
                type="button"
                aria-label={open ? 'Vis mindre om korpuset' : 'Vis mer om korpuset'}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpen((shown) => !shown)}
              >
                {open ? 'Vis mindre' : 'Vis mer'}
              </button>
            </Link>

            {/* Always rendered: `aria-controls` must point at an element in the document. */}
            <span hidden={!open} id={detailId} className="filters-view__corpus-detail">
              {detail}
            </span>
          </>
        )}
      </div>
    </Paragraph>
  );
}
