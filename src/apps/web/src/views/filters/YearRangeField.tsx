import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, useState } from 'react';
import type { FacetFieldProps } from './FacetField';
import { MAX_VALUES_PER_FIELD, SCREEN_READER_TEXTS } from './suggestionField';
import {
  documentsIn,
  formatRange,
  parseYearInput,
  rangeFromKey,
  rangeKey,
  suggestPeriods,
  toRanges,
  yearsIn,
} from './yearRanges';

/** What the field says when it has nothing to offer for the text. */
const HINT = 'Skriv et år eller en periode, som 2021 eller 2023–2028';

/** FacetField for years, behind `year-ranges` (digdir/kunnskapsassistenten#115). The list is
 * what the text can become (`suggestPeriods`), hence `filter={false}`; a period with 0
 * documents can still be chosen. Chips are the chosen years as periods, removed whole. */
export function YearRangeField({ ref, facet, selected, onChange }: FacetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const [query, setQuery] = useState('');

  const facetYears = facet.values.map((value) => value.value);
  const total = facetYears.length;
  const chosen = selected.length;
  // As in FacetField: every listed year ticked, whatever else is.
  const allChosen = total > 0 && facetYears.every((year) => selected.includes(year));

  const selectedItems = toRanges(selected).map((range) => ({
    value: rangeKey(range),
    label: formatRange(range),
  }));

  const typed = parseYearInput(query);
  const suggestions = suggestPeriods(query, facet.values);

  const screenReaderTexts = {
    ...SCREEN_READER_TEXTS,
    'data-sr-remove': `Trykk for å fjerne fra ${facet.label.toLocaleLowerCase('nb-NO')}`,
  };

  const state =
    chosen === 0
      ? 'Ingen avgrensning'
      : allChosen
        ? `Alle ${total} valgt, altså ingen avgrensning`
        : `${chosen} år valgt`;

  const overLimit = chosen > MAX_VALUES_PER_FIELD && !allChosen;

  /* Empties the search text, as FacetField does and for the same reason. */
  function clearQuery() {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Periods back into years; an overlapping or adjacent one joins its chip.
  // '' is the hint, chosen by Enter when nothing fits: not a choice, as in FacetField.
  function change(items: { value: string }[]) {
    if (items.some((item) => item.value === '')) return;
    const years = new Set<number>();
    for (const item of items) {
      const range = rangeFromKey(item.value);
      if (range) for (const year of yearsIn(range)) years.add(year);
    }
    clearQuery();
    onChange([...years].sort((a, b) => a - b).map(String));
  }

  /* As in FacetField: the button goes in the render it causes, so focus goes first. */
  function changeFromButton(values: string[]) {
    inputRef.current?.focus();
    clearQuery();
    onChange(values);
  }

  return (
    <Field className="year-range-field">
      <div className="facet-field__label-row">
        <Label>{facet.label}</Label>

        <div className="facet-field__actions">
          {!allChosen && total > 0 && (
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              aria-label={`Velg alle ${facet.label.toLocaleLowerCase('nb-NO')}`}
              onClick={() => changeFromButton([...new Set([...selected, ...facetYears])])}
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

      {overLimit && (
        <ValidationMessage>
          {`Høyst ${MAX_VALUES_PER_FIELD} kan brukes i ett felt, og ${chosen} er valgt. Fjern noen, eller velg alle.`}
        </ValidationMessage>
      )}

      <Suggestion
        multiple
        filter={false}
        selected={selectedItems}
        onSelectedChange={change}
        {...screenReaderTexts}
      >
        <Suggestion.Input
          ref={inputRef}
          placeholder="Skriv et år eller en periode"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        {/* No Toggle: there is no list to open, and an arrow promises one. */}
        <Suggestion.Clear />
        <Suggestion.List data-overscroll="contain" data-autoplacement="false">
          {/* Options or the hint, never both: u-datalist decides on the empty option before
              React draws the options. The period the text reads as is labelled as typed, so
              Enter chooses it («23-28» is 2023–2028). */}
          {suggestions.length > 0 ? (
            suggestions.map((range) => {
              const key = rangeKey(range);
              const count = documentsIn(range, facet.values);
              const asTyped = typed !== undefined && rangeKey(typed) === key;
              return (
                <Suggestion.Option
                  key={key}
                  value={key}
                  label={asTyped ? query.trim() : formatRange(range)}
                >
                  {count === undefined ? formatRange(range) : `${formatRange(range)} (${count})`}
                </Suggestion.Option>
              );
            })
          ) : (
            <Suggestion.Empty>
              {query.trim() === '' ? HINT : `Ikke et år eller en periode. ${HINT}.`}
            </Suggestion.Empty>
          )}
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
}
