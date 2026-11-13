import {
  Button,
  EXPERIMENTAL_Suggestion as Suggestion,
  Field,
  Label,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { renderChip, removedDrawnChip, valuesAfter, withDrawnChips } from './drawnChips.js';
import { useT } from './i18n.js';
import { chosenFirst, useChosenFirst, useListFollowsField } from './listBehaviour.js';
import { everyListed, showsAsAll } from './selection.js';
import type { FilterField } from './types.js';

/** What the filter may do with a field from outside: put the keyboard in it. */
export interface FieldHandle {
  focus: () => void;
}

export interface FieldProps {
  ref?: Ref<FieldHandle> | undefined;
  field: FilterField;
  /** Chosen option values. Empty is no narrowing. */
  selected: readonly string[];
  /** `said` is for the filter's live region: the change, where u-combobox says nothing. */
  onChange: (values: string[], said?: string) => void;
  /** One chip for `COMPACT_FROM` or more chosen values too; all of two or more listed always are. */
  compact: boolean;
  /** Most values a field may send. */
  max: number;
  /** Named by the row it opens from (the `panel` variant), so its label is for screen readers. */
  labelHidden?: boolean | undefined;
}

/** Chosen values from which `compact` draws one chip instead of one per value. */
const COMPACT_FROM = 6;

/** u-combobox's texts for chosen values, by attribute; an empty one falls back to English. */
export const useComboboxTexts = () => {
  const t = useT();
  return {
    'data-sr-items': t('filter.srItems'),
    'data-sr-empty': t('filter.srEmpty'),
    'data-sr-found': t('filter.srFound'),
    'data-sr-added': t('filter.srAdded'),
    'data-sr-removed': t('filter.srRemoved'),
    'data-sr-invalid': t('filter.srInvalid'),
    'data-sr-of': t('filter.srOf'),
  };
};

/** A field's label inside a sentence: «Velg alle dokumenttyper». */
export const useInSentence = () => {
  const t = useT();
  return (label: string) => label.toLocaleLowerCase(t.locale);
};

/** Designsystemet's multiple Suggestion; its Clear clears only typed text, hence «Tøm». */
export const FacetField = ({
  ref,
  field,
  selected,
  onChange,
  compact: compactChips,
  max,
  labelHidden = false,
}: FieldProps) => {
  const t = useT();
  const texts = useComboboxTexts();
  const name = useInSentence()(field.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDataListElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const first = useChosenFirst(selected, listRef);
  useListFollowsField(selected, listRef, inputRef);
  const total = field.options.length;
  const chosen = selected.length;
  // Every listed value ticked, as `narrowing` reads it; a field with all ticked is not sent.
  const allChosen = everyListed(field, selected);
  const labelOf = (value: string) =>
    field.options.find((option) => option.value === value)?.label ?? value;

  // One drawn chip over those per value: «Alle virksomheter», or by flag «12 virksomheter».
  const isCompact = (values: readonly string[]) =>
    showsAsAll(field, values) || (compactChips && values.length >= COMPACT_FROM);
  const compact = isCompact(selected);
  const drawn = compact
    ? [
        {
          key: 'chosen',
          label: showsAsAll(field, selected)
            ? t('filter.compactAll', { field: name })
            : t('filter.compactSome', { count: chosen, field: name }),
          values: selected,
        },
      ]
    : [];

  // `{ label, value }`, or Suggestion makes a bare string both and the chip shows the key.
  const selectedItems = withDrawnChips(
    selected.map((value) => ({ value, label: labelOf(value) })),
    drawn,
  );

  // A chip's name holds the field, and the count is ours, since the drawn chip is not a value.
  const screenReaderTexts = {
    ...texts,
    ...(compact && { 'data-sr-found': t('filter.srFoundAll', { count: chosen }) }),
    'data-sr-remove': compact
      ? t('filter.srRemoveAll', { field: name })
      : t('filter.srRemove', { field: name }),
  };

  // The state is in the description, since a label that changes fails screen readers.
  const state =
    chosen === 0
      ? t('filter.stateNone')
      : allChosen
        ? t('filter.stateAll', { total })
        : t('filter.stateSome', { count: chosen, total });

  // The question would be turned away. The way out is in the message: fewer, or all.
  const overLimit = chosen > max && !allChosen;

  // Cleared after a pick, or the next open shows «Ingen treff»; dispatched so both filters see it.
  const clearQuery = () => {
    const input = inputRef.current;
    if (!input || input.value === '') return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const change = (values: string[], said?: string) => {
    clearQuery();
    onChange(values, said);
  };

  // u-combobox speaks only when one chip comes or goes; otherwise `said` does, never both.
  const toldByCombobox = (next: readonly string[]) => {
    const added = next.filter((value) => !selected.includes(value)).length;
    const removed = selected.filter((value) => !next.includes(value)).length;
    return added + removed + (isCompact(next) !== compact ? 1 : 0) === 1;
  };

  // '' is «Ingen treff», no choice; a stored '' goes with the next change.
  const choose = (items: { value: string }[]) => {
    const values = [...new Set(valuesAfter(items, drawn))];
    if (values.includes('') && !selected.includes('')) return;
    const next = values.filter((value) => value !== '');

    // The drawn chip goes with focus on it, so focus goes to the field.
    if (removedDrawnChip(items, drawn)) {
      inputRef.current?.focus();
      change(next, t('filter.noneChosen', { field: name }));
      return;
    }

    // One value, which across COMPACT_FROM takes the drawn chip with it.
    const [added] = next.filter((value) => !selected.includes(value));
    const [removed] = selected.filter((value) => !next.includes(value));
    const said =
      toldByCombobox(next) || !(added ?? removed)
        ? undefined
        : added
          ? t('filter.added', { value: labelOf(added) })
          : t('filter.removed', { value: labelOf(removed ?? '') });
    change(next, said);
  };

  // «Velg alle» and «Tøm» vanish, so focus moves to the field first (WCAG 2.4.3).
  const changeFromButton = (values: string[], said: string) => {
    inputRef.current?.focus();
    change(values, toldByCombobox(values) ? undefined : said);
  };

  return (
    <Field className="uib-filter-field">
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
                // Adds, never removes: a ticked value not listed now stays.
                changeFromButton(
                  [...new Set([...selected, ...field.options.map((option) => option.value)])],
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

      {/* Above the chips, so a hundred chips cannot push it out of sight. */}
      {overLimit && (
        <ValidationMessage>{t('filter.overLimit', { max, count: chosen })}</ValidationMessage>
      )}

      <Suggestion
        multiple
        selected={selectedItems}
        onSelectedChange={choose}
        renderSelected={renderChip}
        {...screenReaderTexts}
      >
        {/* Names the field: several bare «Søk» read as one repeated control. */}
        <Suggestion.Input ref={inputRef} placeholder={t('filter.searchIn', { field: name })} />
        <Suggestion.Toggle aria-label={t('filter.listToggle')} />
        <Suggestion.Clear />
        <Suggestion.List ref={listRef} data-overscroll="contain">
          {chosenFirst(field.options, (option) => first.has(option.value)).map((option) => (
            // The count stays out of `label`, which the chip and the filtering use.
            <Suggestion.Option
              key={option.value}
              value={option.value}
              label={option.label ?? option.value}
            >
              {option.count === undefined
                ? (option.label ?? option.value)
                : `${option.label ?? option.value} (${option.count})`}
            </Suggestion.Option>
          ))}
          {/* After the values: Enter takes the first option with the text (see `choose`). */}
          <Suggestion.Empty>{t('filter.noMatches')}</Suggestion.Empty>
        </Suggestion.List>
      </Suggestion>

      <Field.Description>{state}</Field.Description>
    </Field>
  );
};
