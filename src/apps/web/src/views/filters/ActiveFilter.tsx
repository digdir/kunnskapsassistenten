import { Button, Chip, Heading, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { FilterSelection } from '../../model';
import type { ChosenValue } from './withoutField';

export type ActiveFilterProps = {
  selection: FilterSelection;
  /** The values to show: those no field can. See `valuesWithoutField`. Never empty. */
  chosen: ChosenValue[];
  /**
   * Whether facets arrived and fields are drawn below. Then the values here
   * are of a dimension the facets came without, and waiting for the facets
   * will not bring a field for them, so the block has to say something else.
   */
  hasFields: boolean;
  onChange: (selection: FilterSelection) => void;
  /**
   * Called when the block goes away with focus inside it: the last value
   * removed, «Tøm» pressed, or the facets arriving so the fields take over.
   * The view puts focus back, because the right place is whatever replaced
   * the block, and only the view draws that. Must keep its identity between
   * renders; a new one would be taken for an unmount.
   */
  onFocusLost: () => void;
  /** Tells the reader, through the view's own live region, what was removed. */
  onAnnounce: (text: string) => void;
};

/** One key per chip. The same value could in principle sit in two dimensions. */
function keyOf({ dimension, value }: ChosenValue): string {
  return `${dimension}\u0000${value}`;
}

/**
 * The filter that is in force where there is no field to draw it in.
 *
 * A filter stored on the thread still narrows every question, whether or not
 * the facets can be fetched: the key is missing and the server answers with
 * an empty list, or Typesense is down and it answers 502. Until now the panel
 * then said «Filtrering er ikke tilgjengelig ennå» or «Klarte ikke å hente
 * filtrene» and nothing else, so the reader could neither see the narrowing
 * nor get rid of it (#4 in the trial of the backend, #170). The same goes for
 * one dimension when the facets come back without it.
 *
 * Without a field the values cannot be changed — there is nothing to choose
 * among — but they can be removed, and that is all this offers.
 *
 * `Chip.Removable`, one per value, is Designsystemet's own «active filter that
 * can be removed» (chip.md). A field shows its own values as chips inside the
 * Suggestion, and this shows only the ones no field does, so no value is ever
 * drawn twice (behov-til-komponent.md, «Velg én av to»).
 *
 * The chips carry the value alone, with no dimension name, and that is not a
 * shortcut: without facets there is neither the dimension's label nor the
 * value's to look up. The value IS the word the reader ticked — `facetsFrom`
 * and the mock both set `label` to the value (see filterSummary.ts in the chat
 * view) — so it is shown as it is, in the panel's dimension order. That is
 * word for word the «Avgrenset til: Årsrapport · 2024» line over the answer,
 * which is why the heading says the same.
 *
 * The view mounts this only while there is something to show, so the block
 * and its section come and go together, and the last removal unmounts it.
 */
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
  /*
   * The chip the keyboard goes to after a removal, undefined when nothing was
   * removed. Read in an effect, because the chip to focus is not settled
   * until React has drawn the selection without the one that went.
   */
  const focusAfterRemove = useRef<string | undefined>(undefined);

  /*
   * A chip that is pressed removes itself, and focus would fall to `<body>`,
   * above the skip link (WCAG 2.4.3). The next chip is where the reader was
   * heading, and the one before is the fallback when they took the last — the
   * same order as «Dine dokumenter» (OwnDocuments.tsx). When none is left,
   * this is unmounted, and the cleanup below takes over.
   */
  useEffect(() => {
    const target = focusAfterRemove.current;
    if (target === undefined) return;
    focusAfterRemove.current = undefined;
    chipRefs.current.get(target)?.focus();
  }, [selection]);

  /*
   * Every way the block goes away: the last chip or «Tøm» — the view then has
   * nothing to show here — or the facets arriving, when Typesense is back and
   * the refetch a removal started succeeded. A reader standing on a chip
   * would be dropped on `<body>`, in the last case with no action of their
   * own to explain it.
   *
   * A layout effect, because on unmount its cleanup runs while the chips are
   * still in the document: that is the only moment `contains` can say where
   * focus was. What it says is handed to the view, which moves focus in the
   * same commit, once what replaces the block is drawn.
   */
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

  /*
   * What is shown here and nothing else. With no facets that is the whole
   * filter; with some, a field the reader can see keeps its values, and a
   * button above other chips may not empty it.
   */
  function clear() {
    const next = { ...selection };
    for (const { dimension } of chosen) next[dimension] = [];
    onAnnounce('Avgrensningen er fjernet.');
    onChange(next);
  }

  return (
    <section ref={sectionRef} className="active-filter" aria-labelledby={headingId}>
      {/*
        «Tøm» beside the heading, as it stands beside the label of every
        field (FacetField). A filter saved with «Velg alle» can hold every
        organisation in the corpus, and removing them chip by chip is not a
        way out of it.
      */}
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

      {/*
        Two sentences for two situations. Without facets the fields may come
        back, so «før filtrene kan hentes» is true. With fields on screen it
        is not: the facets are here, this dimension is not among them, and no
        wait will change that (KA CC, bør 1 on #177).
      */}
      <Paragraph data-size="sm" variant="long">
        {hasFields
          ? 'Det finnes ikke noe felt for dette, men det gjelder fortsatt for spørsmålene dine. Du kan fjerne det.'
          : 'Filteret gjelder fortsatt for spørsmålene dine. Du kan fjerne det, men ikke endre det før filtrene kan hentes.'}
      </Paragraph>

      <div className="active-filter__chips">
        {chosen.map((item) => (
          /*
            `data-wrap`: an organisation's name is the information, and the
            chip's default ellipsis would cut it — the same call the chips
            inside the fields make (filters.css).

            The accessible name says what pressing does, because the cross is
            a pseudo-element with no text and the chip would otherwise read
            as the value alone (chip.md, «Tilgjengelighet»).
          */
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
