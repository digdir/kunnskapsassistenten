import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, useState } from 'react';
import { chosenFirst, useChosenFirst } from './chosenFirst';
import {
  changedChips,
  chipValues,
  keepFocusFromDrawnChip,
  renderChip,
  valuesAfter,
  withDrawnChips,
  type DrawnChip,
} from './drawnChips';
import type { FacetFieldProps } from './FacetField';
import { useListFollowsField } from './listFollowsField';
import {
  allChosenText,
  MAX_VALUES_PER_FIELD,
  noneChosenText,
  SCREEN_READER_TEXTS,
} from './suggestionField';
import {
  documentsIn,
  formatRange,
  listedYearsIn,
  parseYearInput,
  rangeFromKey,
  rangeKey,
  suggestPeriods,
  toRanges,
  type YearRange,
} from './yearRanges';

/** What the field says about what it reads: over the years before anything is typed, and alone
 * when the text is no year or period. */
const HINT = 'Skriv et år eller en periode, som 2021 eller 2023–2028';

/** A chip per period, drawn over the chip per year (drawnChips.tsx), so the list ticks years. */
function periodsOf(years: readonly string[]): DrawnChip[] {
  return toRanges(years).map((range) => ({
    key: rangeKey(range),
    label: formatRange(range),
    values: years.filter((year) => Number(year) >= range.from && Number(year) <= range.to),
  }));
}

/** An option's value: a year as the filter holds it, so a chosen one is ticked, or a period. */
function optionValue(range: YearRange): string {
  return range.from === range.to ? String(range.from) : rangeKey(range);
}

/** The period an option or a chip's value stands for. */
function rangeOf(value: string): YearRange | undefined {
  return /^\d+$/u.test(value) ? { from: Number(value), to: Number(value) } : rangeFromKey(value);
}

/** FacetField for years, which takes periods (digdir/kunnskapsassistenten#115). Before anything
 * is typed, the list is the years with documents; then what the text can become
 * (`suggestPeriods`), hence `filter={false}`, and a year with 0 documents can still be chosen.
 * A period stands for the years in it with documents (`listedYearsIn`), so one with none is not
 * offered. Suggestion holds the chosen years, and the chips are drawn as periods, removed whole. */
export function YearRangeField({ ref, facet, selected, onChange }: FacetFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDataListElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  useListFollowsField(selected, listRef, inputRef);
  const first = useChosenFirst(selected, listRef);
  const [query, setQuery] = useState('');

  const facetYears = facet.values.map((value) => value.value);
  const total = facetYears.length;
  const chosen = selected.length;
  // As in FacetField: every listed year ticked, whatever else is.
  const allChosen = total > 0 && facetYears.every((year) => selected.includes(year));

  const drawn = periodsOf(selected);
  const selectedItems = withDrawnChips(
    selected.map((year) => ({ value: year, label: year })),
    drawn,
  );

  const typed = parseYearInput(query);
  // A period is the years in it the field lists, so one with none of them adds nothing.
  const isEmptyPeriod = (range: YearRange) =>
    range.from !== range.to && listedYearsIn(range, facet.values).length === 0;
  // Nothing typed: every year with documents, as listed. No count counts as some (yearRanges.ts).
  const offered =
    query.trim() === ''
      ? facet.values
          .filter((value) => value.count === undefined || value.count > 0)
          .map((value) => rangeOf(value.value))
          .filter((range) => range !== undefined)
      : suggestPeriods(query, facet.values).filter((range) => !isEmptyPeriod(range));
  const options = chosenFirst(offered, (range) => first.has(optionValue(range)));

  // A year with its documents; a period with its years, as a document with several years would
  // count once in each and the sum could pass the documents there are.
  function optionText(range: YearRange): string {
    if (range.from !== range.to) {
      const years = listedYearsIn(range, facet.values).length;
      return `${formatRange(range)} (${years} år med dokumenter)`;
    }
    const count = documentsIn(range, facet.values);
    return count === undefined ? formatRange(range) : `${formatRange(range)} (${count})`;
  }

  // u-combobox counts its chips, here a year's each and a period's; the count is the years.
  const screenReaderTexts = {
    ...SCREEN_READER_TEXTS,
    'data-sr-found': `${chosen} valgt, naviger bakover for å endre`,
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

  /* u-combobox tells a change when exactly one chip comes or goes, and with a chip per year and
     one per period that is never so; then the view's live region tells it. */
  function told(next: readonly string[]): boolean {
    return changedChips(chipValues(selected, drawn), chipValues(next, periodsOf(next))) === 1;
  }

  // Years and periods back into years; an overlapping or adjacent one joins its chip.
  // '' is the hint, chosen by Enter when nothing fits: not a choice, as in FacetField.
  // A year stays as chosen, listed or not; a period brings only the years in it the field lists,
  // so it never sends more values than the collection has years.
  function change(items: { value: string; label: string }[]) {
    if (items.some((item) => item.value === '')) return;
    const years = new Set<number>();
    for (const value of valuesAfter(items, drawn)) {
      const range = rangeOf(value);
      if (!range) continue;
      if (range.from === range.to) years.add(range.from);
      else for (const year of listedYearsIn(range, facet.values)) years.add(year);
    }
    const next = [...years].sort((a, b) => a - b).map(String);
    keepFocusFromDrawnChip(items, drawn, inputRef.current);
    clearQuery();

    // What u-combobox took or gave: a year, a period from the text, or a drawn period.
    const kept = new Set(items.map((item) => item.value));
    const was = new Set(selectedItems.map((item) => item.value));
    const removed = selectedItems.find((item) => !kept.has(item.value));
    const added = items.find((item) => !was.has(item.value));
    const range = added && rangeOf(added.value);

    // A period whose years are all chosen adds nothing, and is not ticked to be taken off; said,
    // or the text would just go.
    if (next.length === chosen && next.every((year) => selected.includes(year))) {
      if (range) onChange(selected, `${formatRange(range)} er alt valgt.`);
      return;
    }

    const said = told(next)
      ? undefined
      : removed
        ? `${SCREEN_READER_TEXTS['data-sr-removed']} ${removed.label}`
        : range && `${SCREEN_READER_TEXTS['data-sr-added']} ${formatRange(range)}`;
    onChange(next, said);
  }

  /* As in FacetField: the button goes in the render it causes, so focus goes first, and the
     change is told in the view's live region unless u-combobox tells it. */
  function changeFromButton(values: string[], said: string) {
    inputRef.current?.focus();
    clearQuery();
    onChange(values, told(values) ? undefined : said);
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
              onClick={() =>
                changeFromButton(
                  [...new Set([...selected, ...facetYears])],
                  allChosenText(facet.label, total),
                )
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
              onClick={() => changeFromButton([], noneChosenText(facet.label))}
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
        renderSelected={renderChip}
        {...screenReaderTexts}
      >
        <Suggestion.Input
          ref={inputRef}
          placeholder="Skriv et år eller en periode"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Suggestion.Toggle />
        <Suggestion.Clear />
        <Suggestion.List ref={listRef} data-overscroll="contain">
          {/* Over the years, for the eye only: not an option to walk to or choose, and the
              placeholder says the same to a screen reader. */}
          {query.trim() === '' && (
            <div className="year-range-field__hint" aria-hidden="true">
              {HINT}
            </div>
          )}
          {/* Options or the hint, never both: u-datalist decides on the empty option before
              React draws the options. The period the text reads as is labelled as typed, so
              Enter chooses it («23-28» is 2023–2028). */}
          {options.length > 0 || query.trim() === '' ? (
            options.map((range) => {
              const asTyped = typed !== undefined && rangeKey(typed) === rangeKey(range);
              return (
                <Suggestion.Option
                  key={optionValue(range)}
                  value={optionValue(range)}
                  label={asTyped ? query.trim() : formatRange(range)}
                >
                  {optionText(range)}
                </Suggestion.Option>
              );
            })
          ) : (
            <Suggestion.Empty>
              {typed
                ? `Ingen dokumenter i ${formatRange(typed)}.`
                : `Ikke et år eller en periode. ${HINT}.`}
            </Suggestion.Empty>
          )}
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
}
