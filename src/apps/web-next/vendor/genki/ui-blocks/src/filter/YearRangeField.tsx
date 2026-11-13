import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, useState } from 'react';
import {
  changedChips,
  chipValues,
  keepFocusFromDrawnChip,
  renderChip,
  valuesAfter,
  withDrawnChips,
  type DrawnChip,
} from './drawnChips.js';
import { useComboboxTexts, useInSentence, type FieldProps } from './FacetField.js';
import { useT } from './i18n.js';
import { chosenFirst, useChosenFirst, useListFollowsField } from './listBehaviour.js';
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
} from './yearRanges.js';

/** A chip per period, drawn over the chip per year (drawnChips.tsx), so the list ticks years. */
const periodsOf = (years: readonly string[]): DrawnChip[] =>
  toRanges(years).map((range) => ({
    key: rangeKey(range),
    label: formatRange(range),
    values: years.filter((year) => Number(year) >= range.from && Number(year) <= range.to),
  }));

/** An option's value: a year as the filter holds it, so a chosen one is ticked, or a period. */
const optionValue = (range: YearRange) =>
  range.from === range.to ? String(range.from) : rangeKey(range);

/** The period an option or a chip's value stands for. */
const rangeOf = (value: string): YearRange | undefined =>
  /^\d+$/u.test(value) ? { from: Number(value), to: Number(value) } : rangeFromKey(value);

/** A `year` field with `yearPeriods`: the years with documents, then what the text can be. */
export const YearRangeField = ({
  ref,
  field,
  selected,
  onChange,
  max,
  labelHidden = false,
}: FieldProps) => {
  const t = useT();
  const texts = useComboboxTexts();
  const name = useInSentence()(field.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDataListElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  useListFollowsField(selected, listRef, inputRef);
  const first = useChosenFirst(selected, listRef);
  const [query, setQuery] = useState('');

  const fieldYears = field.options.map((option) => option.value);
  const total = fieldYears.length;
  const chosen = selected.length;
  // As in FacetField: every listed year ticked, whatever else is.
  const allChosen = total > 0 && fieldYears.every((year) => selected.includes(year));

  const drawn = periodsOf(selected);
  const selectedItems = withDrawnChips(
    selected.map((year) => ({ value: year, label: year })),
    drawn,
  );

  const typed = parseYearInput(query);
  // A period is the years in it the field lists, so one with none of them adds nothing.
  const isEmptyPeriod = (range: YearRange) =>
    range.from !== range.to && listedYearsIn(range, field.options).length === 0;
  // Nothing typed: every year with documents, as listed. No count counts as some.
  const offered =
    query.trim() === ''
      ? field.options
          .filter((option) => option.count === undefined || option.count > 0)
          .map((option) => rangeOf(option.value))
          .filter((range) => range !== undefined)
      : suggestPeriods(query, field.options).filter((range) => !isEmptyPeriod(range));
  const options = chosenFirst(offered, (range) => first.has(optionValue(range)));

  // A year with its documents; a period with its years, as a document with several years would
  // count once in each and the sum could pass the documents there are.
  const optionText = (range: YearRange) => {
    if (range.from !== range.to) {
      const count = listedYearsIn(range, field.options).length;
      return `${formatRange(range)} (${t('filter.periodYears', { count })})`;
    }
    const count = documentsIn(range, field.options);
    return count === undefined ? formatRange(range) : `${formatRange(range)} (${count})`;
  };

  // u-combobox counts its chips, here a year's each and a period's; the count is the years.
  const screenReaderTexts = {
    ...texts,
    'data-sr-found': t('filter.srFoundYears', { count: chosen }),
    'data-sr-remove': t('filter.srRemove', { field: name }),
  };

  const state =
    chosen === 0
      ? t('filter.stateNone')
      : allChosen
        ? t('filter.stateAll', { total })
        : t('filter.stateYears', { count: chosen });

  const overLimit = chosen > max && !allChosen;

  /* Empties the search text, as FacetField does and for the same reason. */
  const clearQuery = () => {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /* u-combobox never tells a change here, so the filter's live region does. */
  const told = (next: readonly string[]) =>
    changedChips(chipValues(selected, drawn), chipValues(next, periodsOf(next))) === 1;

  // Years and periods back into years; '' is the hint, not a choice, as in FacetField. A year
  // stays as chosen, listed or not; a period brings only the years in it the field lists, so it
  // never sends more values than the collection has years (genki takes at most 100 per field).
  const change = (items: { value: string; label: string }[]) => {
    if (items.some((item) => item.value === '')) return;
    const years = new Set<number>();
    for (const value of valuesAfter(items, drawn)) {
      const range = rangeOf(value);
      if (!range) continue;
      if (range.from === range.to) years.add(range.from);
      else for (const year of listedYearsIn(range, field.options)) years.add(year);
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

    // A period whose years are all chosen adds nothing, which is said.
    if (next.length === chosen && next.every((year) => selected.includes(year))) {
      if (range)
        onChange([...selected], t('filter.yearAlreadyChosen', { period: formatRange(range) }));
      return;
    }

    const said = told(next)
      ? undefined
      : removed
        ? t('filter.removed', { value: removed.label })
        : range
          ? t('filter.added', { value: formatRange(range) })
          : undefined;
    onChange(next, said);
  };

  /* As in FacetField: focus goes first, and the change is told once. */
  const changeFromButton = (values: string[], said: string) => {
    inputRef.current?.focus();
    clearQuery();
    onChange(values, told(values) ? undefined : said);
  };

  return (
    <Field className="uib-filter-field uib-filter-years">
      <div className="uib-filter-label-row">
        <Label className={labelHidden ? 'ds-sr-only' : undefined}>{field.label}</Label>

        <div className="uib-filter-field-actions">
          {!allChosen && total > 0 && (
            <Button
              variant="tertiary"
              // Pinned to neutral, as kunnskapsassistenten draws it: quiet beside the field.
              data-color="neutral"
              data-size="sm"
              aria-label={t('filter.selectAllIn', { field: name })}
              onClick={() =>
                changeFromButton(
                  [...new Set([...selected, ...fieldYears])],
                  t('filter.allChosen', { total, field: name }),
                )
              }
            >
              {t('filter.selectAll')}
            </Button>
          )}
          {chosen > 0 && (
            <Button
              variant="tertiary"
              // Pinned to neutral, as kunnskapsassistenten draws it: quiet beside the field.
              data-color="neutral"
              data-size="sm"
              aria-label={t('filter.clearIn', { field: name })}
              onClick={() => changeFromButton([], t('filter.noneChosen', { field: name }))}
            >
              {t('filter.clear')}
            </Button>
          )}
        </div>
      </div>

      {overLimit && (
        <ValidationMessage>{t('filter.overLimit', { max, count: chosen })}</ValidationMessage>
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
          placeholder={t('filter.yearPlaceholder')}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Suggestion.Toggle aria-label={t('filter.listToggle')} />
        <Suggestion.Clear />
        <Suggestion.List ref={listRef} data-overscroll="contain">
          {/* Over the years, for the eye only; the placeholder says it to a screen reader. */}
          {query.trim() === '' && (
            <div className="uib-filter-years-hint" aria-hidden="true">
              {t('filter.yearHint')}
            </div>
          )}
          {/* Options or the hint, never both; the text's period is labelled as typed. */}
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
                ? t('filter.yearNoneIn', { period: formatRange(typed) })
                : t('filter.yearNotPeriod')}
            </Suggestion.Empty>
          )}
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
};
