import { Button } from '@digdir/designsystemet-react';
import { useState } from 'react';
import { ShowUseIcon } from '../../components/icons';

type ShowUseButtonProps = {
  /** What the footnote names, as the reader reads it: «utdrag 3» or «kilde 2». */
  name: string;
  /** How many places in the answer cite it. */
  uses: number;
  /** Shows the reader use `use` (1-based) in the answer. */
  onShowUse: (use: number) => void;
};

/** The back-link to where the answer cites a footnote; each press goes to the next use. */
export function ShowUseButton({ name, uses, onShowUse }: ShowUseButtonProps) {
  // The use the back-link last went to, 0 before the first press.
  const [use, setUse] = useState(0);
  const at = use === 0 ? 1 : use;
  // «2/3»: the name is built from the visible text (WCAG 2.5.3).
  const useCount = `${at}/${uses}`;
  const label =
    uses > 1 ? `Vis hvor svaret bruker ${name} (${useCount})` : `Vis hvor svaret bruker ${name}`;

  return (
    <Button
      type="button"
      variant="tertiary"
      data-size="sm"
      className="source-excerpt__uses"
      aria-label={label}
      onClick={() => {
        const next = (use % uses) + 1;
        setUse(next);
        onShowUse(next);
      }}
    >
      <ShowUseIcon aria-hidden />
      {uses > 1 && <span className="source-excerpt__use-count">{useCount}</span>}
    </Button>
  );
}
