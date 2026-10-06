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
 *   1. The list is not the years. It is what the reader typed, read as a
 *      period by `parseYearInput`: «2021», «2023-2028», «2023 til 2028»,
 *      «23-28». So `filter={false}`, and the one option is built from the
 *      text, with the number of documents the facets count in it. A period
 *      with no documents still shows, with 0, and can be chosen.
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
  const count = typed ? documentsIn(typed, facet.values) : undefined;

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
   */
  function change(items: { value: string }[]) {
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
            One or the other, never both. u-datalist decides whether the empty
            option shows when the input event arrives, before React has drawn
            the period, so with both in the list the hint stood over the
            option it was wrong about (measured in Chromium).

            The option's `label` is the text as typed. Enter in the field
            chooses the option whose label is what the field holds, as it does
            in the other fields when a value's name is typed in full — so
            «23-28» and Enter is 2023–2028. What the reader sees and hears is
            the children: the period written out, and its documents.
          */}
          {typed ? (
            <Suggestion.Option value={rangeKey(typed)} label={query.trim()}>
              {count === undefined ? formatRange(typed) : `${formatRange(typed)} (${count})`}
            </Suggestion.Option>
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
