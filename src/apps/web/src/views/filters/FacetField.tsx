import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { useFlag } from '../../flags';
import type { FilterFacet } from '../../model';
import { MAX_VALUES_PER_FIELD, SCREEN_READER_TEXTS } from './suggestionField';

/** What the view may do with a field from outside: put the keyboard in it. */
export type FacetFieldHandle = { focus: () => void };

/** Chosen values from which `compact-filter-chips` (digdir/kunnskapsassistenten#116) draws
 * one chip instead of one per value. All chosen always does. */
const COMPACT_FROM = 6;

/** The value of the one summary chip; no key the backend sends starts with a null. */
const SUMMARY_VALUE = '\u0000chosen';

export type FacetFieldProps = {
  /** For the view's focus handling after the active filter goes (ActiveFilter). */
  ref?: Ref<FacetFieldHandle>;
  facet: FilterFacet;
  /** Selected {@link FacetValue.value}s. Empty means «no restriction». */
  selected: string[];
  onChange: (values: string[]) => void;
};

/** Designsystemet's Suggestion with `multiple`, whose chips show the selection. `data-overscroll`
 * lifts its inline width lock so our CSS can widen the list; `autoPlacement` is a dead prop in
 * 1.21.0, `data-autoplacement` works. Its Clear clears only typed text, hence our «Tøm». */
export function FacetField({ ref, facet, selected, onChange }: FacetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const total = facet.values.length;
  const chosen = selected.length;
  // Every listed value ticked, the rule `askedSelection` leaves the field out by. Not
  // `chosen === total`: a field with all ticked is not sent, so the facets are counted
  // without it and may list fewer values than are ticked.
  const allChosen = total > 0 && facet.values.every((value) => selected.includes(value.value));
  const dimension = facet.label.toLocaleLowerCase('nb-NO');

  // With all or many chosen, one chip («Alle dokumenttyper», «12 virksomheter»)
  // instead of hundreds. While it stands the list shows no ticks: u-combobox
  // ticks only options a chip carries, and choosing a chosen value does nothing.
  const compactFlag = useFlag('compact-filter-chips');
  const compact = compactFlag && chosen > 0 && (allChosen || chosen >= COMPACT_FROM);

  // `{ label, value }`, not bare strings: Suggestion's `sanitizeItems` makes a
  // bare string both, and the chip shows the key («arsrapport»), not the name.
  const selectedItems = compact
    ? [{ value: SUMMARY_VALUE, label: allChosen ? `Alle ${dimension}` : `${chosen} ${dimension}` }]
    : selected.map((value) => ({
        value,
        label: facet.values.find((candidate) => candidate.value === value)?.label ?? value,
      }));

  // u-combobox names a chip `label` + `data-sr-remove` («Årsrapport, Trykk for
  // å fjerne»). With chips in three fields, the dimension has to be in it.
  const screenReaderTexts = {
    ...SCREEN_READER_TEXTS,
    'data-sr-remove': `Trykk for å fjerne fra ${facet.label.toLocaleLowerCase('nb-NO')}`,
  };

  // The state goes in the description: a label that changes with the value fails screen
  // readers. None and all must read differently; all chosen is no restriction and is not sent
  // (the BFF strikes it, and every organisation would break the limit).
  const state =
    chosen === 0
      ? 'Ingen avgrensning'
      : allChosen
        ? `Alle ${total} valgt, altså ingen avgrensning`
        : `${chosen} av ${total} valgt`;

  // The question would be turned away. The way out is in the message: fewer, or all.
  const overLimit = chosen > MAX_VALUES_PER_FIELD && !allChosen;

  // Picking a value leaves its key in the input (u-combobox restores the typed text only on
  // the native datalist path), so the next open would show «Ingen treff». Dispatched, because
  // u-combobox and Suggestion's filtering both go stale on `value` alone.
  function clearQuery() {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function change(values: string[]) {
    clearQuery();
    onChange(values);
  }

  // '' is «Ingen treff», which u-combobox chooses on Enter (its label is the typed text): not a
  // choice, so nothing changes. A '' already selected (an older thread's filter, which «Ny tråd»
  // carries over; `readStoredFilter` drops stored ones) goes with the next change.
  function choose(items: { value: string }[]) {
    const values = [
      ...new Set(items.flatMap((item) => (item.value === SUMMARY_VALUE ? selected : [item.value]))),
    ];
    if (values.includes('') && !selected.includes('')) return;
    change(values.filter((value) => value !== ''));
  }

  // «Velg alle» and «Tøm» vanish in the render they cause, so focus moves to the field first,
  // not to `<body>` (WCAG 2.4.3). Only from the buttons: `onSelectedChange` must not pull focus
  // out of the chips, where ArrowLeft and Enter walk and remove.
  function changeFromButton(values: string[]) {
    inputRef.current?.focus();
    change(values);
  }

  return (
    <Field>
      <div className="facet-field__label-row">
        <Label>{facet.label}</Label>

        <div className="facet-field__actions">
          {!allChosen && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Velg alle ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() =>
                // Adds, never removes: a ticked value not listed now stays.
                changeFromButton([
                  ...new Set([...selected, ...facet.values.map((value) => value.value)]),
                ])
              }
            >
              Velg alle
            </Button>
          )}
          {chosen > 0 && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Tøm ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() => changeFromButton([])}
            >
              Tøm
            </Button>
          )}
        </div>
      </div>

      {/* Above the chips, not after: under a hundred chips it would be out of sight.
          `ds-field` links it to the input wherever it stands. */}
      {overLimit && (
        <ValidationMessage>
          {`Høyst ${MAX_VALUES_PER_FIELD} kan brukes i ett felt, og ${chosen} er valgt. Fjern noen, eller velg alle.`}
        </ValidationMessage>
      )}

      <Suggestion
        multiple
        selected={selectedItems}
        onSelectedChange={choose}
        {...screenReaderTexts}
      >
        {/* Names the dimension: three bare «Søk» read as one repeated control. */}
        <Suggestion.Input
          ref={inputRef}
          placeholder={`Søk i ${facet.label.toLocaleLowerCase('nb-NO')}`}
        />
        <Suggestion.Toggle />
        <Suggestion.Clear />
        <Suggestion.List data-overscroll="contain" data-autoplacement="false">
          {facet.values.map((value) => (
            // The count stays out of `label`, which the chip and the filtering use.
            <Suggestion.Option key={value.value} value={value.value} label={value.label}>
              {value.count === undefined ? value.label : `${value.label} (${value.count})`}
            </Suggestion.Option>
          ))}
          {/* After the values: Enter takes the FIRST option labelled with the text,
              and «Ingen treff» carries the text (see `choose`). CSS hides it
              whenever a value shows. */}
          <Suggestion.Empty>Ingen treff</Suggestion.Empty>
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
}
