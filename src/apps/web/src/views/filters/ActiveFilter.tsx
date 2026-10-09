import { Button, Chip, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { FilterSelection } from '../../model';
import type { ChosenValue } from './withoutField';

export type ActiveFilterProps = {
  selection: FilterSelection;
  /** The values to show: those no field can. See `valuesWithoutField`. Never empty. */
  chosen: ChosenValue[];
  /** Whether fields are drawn below. Then these values belong to a dimension the facets came
   * without, and waiting will not bring a field for them. */
  hasFields: boolean;
  onChange: (selection: FilterSelection) => void;
  /** Called when the block goes with focus inside it (last value removed, «Tøm», or facets
   * arriving); the view moves focus to what replaced it. Must keep its identity between
   * renders, or a new one is taken for an unmount. */
  onFocusLost: () => void;
  /** Tells the reader, through the view's own live region, what was removed. */
  onAnnounce: (text: string) => void;
};

/** One key per chip. The same value could in principle sit in two dimensions. */
function keyOf({ dimension, value }: ChosenValue): string {
  return `${dimension}\u0000${value}`;
}

/** The filter in force where no field shows it: facets failed (empty list, or 502 when Typesense
 * is down) or lack this dimension. It still narrows every question, so it must show and be
 * removable. Chips show the value alone, which `facetsFrom` also uses as the label. */
export function ActiveFilter({
  selection,
  chosen,
  hasFields,
  onChange,
  onFocusLost,
  onAnnounce,
}: ActiveFilterProps) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement | null>());
  // The chip to focus after a removal; read in an effect, once React has drawn
  // the selection without the removed one.
  const focusAfterRemove = useRef<string | undefined>(undefined);

  // A pressed chip removes itself; focus goes to the next, else the previous,
  // not to `<body>` (WCAG 2.4.3). With none left, the cleanup below takes over.
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === undefined) return;
    focusAfterRemove.current = undefined;
    chipRefs.current.get(target)?.focus();
  }, [selection]);

  // A reader on a chip would land on `<body>` however the block goes. A layout effect: its
  // cleanup runs while the chips are still in the document, the only moment `contains` can
  // tell; the view moves focus in the same commit.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    return () => {
      if (section?.contains(document.activeElement)) onFocusLost();
    };
  }, [onFocusLost]);

  function remove(removed: ChosenValue) {
    const index = chosen.findIndex((candidate) => keyOf(candidate) === keyOf(removed));
    const next = chosen[index + 1] ?? chosen[index - 1];
    focusAfterRemove.current = next ? keyOf(next) : undefined;
    chipRefs.current.delete(keyOf(removed));

    onAnnounce(`Fjernet fra filteret: ${removed.value}`);
    onChange({
      ...selection,
      [removed.dimension]: selection[removed.dimension].filter((value) => value !== removed.value),
    });
  }

  // Only what is shown here: a field the reader can see keeps its values.
  function clear() {
    const next = { ...selection };
    for (const { dimension } of chosen) next[dimension] = [];
    onAnnounce('Avgrensningen er fjernet.');
    onChange(next);
  }

  return (
    <section ref={sectionRef} className="active-filter" aria-labelledby={headingId}>
      {/* «Tøm» as on every field: a filter saved with «Velg alle» can hold every
          organisation, too many to remove chip by chip. */}
      <div className="active-filter__head">
        <Heading level={3} data-size="2xs" id={headingId}>
          Avgrenset til
        </Heading>
        <Button
          variant="tertiary"
          data-color="neutral"
          data-size="sm"
          aria-label="Tøm avgrensningen"
          onClick={clear}
        >
          Tøm
        </Button>
      </div>

      {/* Without facets the fields may come back; with fields on screen, this
          dimension is not among them, and waiting will not change that. */}
      <Paragraph data-size="sm" variant="long">
        {hasFields
          ? 'Det finnes ikke noe felt for dette, men det gjelder fortsatt for spørsmålene dine. Du kan fjerne det.'
          : 'Filteret gjelder fortsatt for spørsmålene dine. Du kan fjerne det, men ikke endre det før filtrene kan hentes.'}
      </Paragraph>

      <div className="active-filter__chips">
        {chosen.map((item) => (
          // `data-wrap`: the name is the information, so no ellipsis (as in
          // filters.css). The label says what pressing does: the cross has no text.
          <Chip.Removable
            key={keyOf(item)}
            ref={(chip) => {
              chipRefs.current.set(keyOf(item), chip);
            }}
            data-wrap="wrap"
            aria-label={`Fjern filter: ${item.value}`}
            onClick={() => remove(item)}
          >
            {item.value}
          </Chip.Removable>
        ))}
      </div>
    </section>
  );
}
