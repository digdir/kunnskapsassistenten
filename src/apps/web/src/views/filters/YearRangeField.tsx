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

/**
 * The year filter as periods, behind the `year-ranges` flag (#115).
 *
 * The same field as `FacetField` — Designsystemet's Suggestion with
 * `multiple`, the same label row, «Velg alle», «Tøm» and the limit — with two
 * differences:
 *
 *   1. The list is not the years. It is what the text so far can become,
 *      from `suggestPeriods`: the period the text is when it is one («2021»,
 *      «2023-2028», «23-28»), the years with documents that begin with the
 *      digits typed («2», «202»), and the periods whose end is being typed
 *      («2019-20»). So `filter={false}`, and each option has the number of
 *      documents the facets count in it. A whole period with no documents
 *      still shows, with 0, and can be chosen.
 *   2. The chips are periods. The selection is still a list of years — that
 *      is what the backend takes — and the chips are that list drawn by
 *      `toRanges`: years in a row are one chip, a gap starts the next. A chip
 *      is removed as one; taking one year out of the middle of a period is
 *      not in this round.
 */
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

  /*
   * The periods back into years. An option that overlaps a chip, or sits
   * next to it, simply joins it the next time the chips are drawn.
   *
   * A value of '' is the hint, chosen by Enter when nothing fits: it is not
   * a choice, and the text stays to be finished, as in FacetField.
   */
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
        {/*
          No Toggle: there is no list of years to open, only the period the
          text makes, and an arrow that opened an empty box promised one.
        */}
        <Suggestion.Clear />
        <Suggestion.List data-overscroll="contain" data-autoplacement="false">
          {/*
            The options or the hint, never both. u-datalist decides whether the
            empty option shows when the input event arrives, before React has
            drawn the options, so with both in the list the hint stood over
            the options it was wrong about (measured in Chromium).

            The hint is an option too, with an empty value: a click on it
            empties the field. While a year was half typed («2», «202») it was
            all the list held, and a click there took the text away instead
            of choosing anything (measured on main 879f0de). So it is only
            there when nothing fits.

            The `label` of the period the text reads as is the text as typed.
            Enter in the field chooses the option whose label is what the
            field holds, as it does in the other fields when a value's name
            is typed in full — so «23-28» and Enter is 2023–2028. The others
            are labelled as they read. What the reader sees and hears is the
            children: the period written out, and its documents.
          */}
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
