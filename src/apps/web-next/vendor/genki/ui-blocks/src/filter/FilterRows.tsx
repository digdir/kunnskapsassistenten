// The `panel` variant's fields, the dev boards' filter beside the threads (dev-filter-panel):
// «Fjern alle filtre» over them, and each field a row that opens, one at a time, to a checkbox per
// value with its exact count, or to the field's list when it has too many values to tick.
import { Checkbox, Link } from '@digdir/designsystemet-react';
import { useFormat } from '@genai/i18n/react';
import { ChevronDownIcon, ChevronRightIcon } from '@navikt/aksel-icons';
import { useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { FacetField, type FieldHandle } from './FacetField.js';
import { useT } from './i18n.js';
import { fieldValueLabels, isEmptySelection, showsAsAll } from './selection.js';
import type { FilterField, FilterSelection } from './types.js';
import { YearRangeField } from './YearRangeField.js';

/** Values from which a row opens to the field's list, with its search, instead of checkboxes. */
export const CHECKBOXES_UP_TO = 12;

interface RowsProps {
  ref?: Ref<FieldHandle> | undefined;
  fields: readonly FilterField[];
  selection: FilterSelection;
  /** `said` is for the filter's live region. */
  onChange: (selection: FilterSelection, said?: string) => void;
  /** The level of each row's heading. */
  level: 3 | 4 | 5 | 6;
  yearPeriods: boolean;
  compact: boolean;
  max: number;
}

/** A field's ticks: one checkbox per value, its count beside it, and a ticked value no longer listed. */
const Checkboxes = ({
  field,
  selected,
  onChange,
}: {
  field: FilterField;
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) => {
  const f = useFormat();
  const unlisted = selected.filter(
    (value) => !field.options.some((option) => option.value === value),
  );
  const options = [...field.options, ...unlisted.map((value) => ({ value, count: undefined }))];
  return (
    <fieldset className="uib-filter-checkboxes">
      <legend className="ds-sr-only">{field.label}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          className="uib-filter-checkbox"
          value={option.value}
          checked={selected.includes(option.value)}
          onChange={(event) =>
            onChange(
              event.currentTarget.checked
                ? [...selected, option.value]
                : selected.filter((value) => value !== option.value),
            )
          }
          label={
            <>
              <span className="uib-filter-checkbox-label">
                {fieldValueLabels(field, [option.value])[0]}
              </span>
              {option.count === undefined ? null : (
                <span className="uib-filter-checkbox-count">{f.number(option.count)}</span>
              )}
            </>
          }
        />
      ))}
    </fieldset>
  );
};

/** «Fjern alle filtre», then a row per field, the first open. */
export const FilterRows = ({
  ref,
  fields,
  selection,
  onChange,
  level,
  yearPeriods,
  compact,
  max,
}: RowsProps) => {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState<string | undefined>(fields[0]?.id);
  const toggles = useRef(new Map<string, HTMLButtonElement | null>());
  const first = () => (fields[0] ? toggles.current.get(fields[0].id) : undefined);
  useImperativeHandle(ref, () => ({ focus: () => first()?.focus() }));
  const Heading = `h${level}` as 'h3';

  return (
    <div className="uib-filter-rows">
      <div className="uib-filter-clear-all">
        {isEmptySelection(selection) ? null : (
          // A `button` drawn as a link, quiet over the fields, as the design draws it.
          <Link asChild>
            <button
              type="button"
              onClick={() => {
                // It goes once nothing is chosen, so focus moves to the first row (WCAG 2.4.3).
                first()?.focus();
                onChange({}, t('filter.clearedAll'));
              }}
            >
              {t('filter.clearAll')}
            </button>
          </Link>
        )}
      </div>

      {fields.map((field) => {
        const selected = selection[field.id] ?? [];
        const isOpen = open === field.id;
        const bodyId = `${id}-${field.id}`;
        const chosen = fieldValueLabels(field, selected);
        const few = field.options.length <= CHECKBOXES_UP_TO;
        const Field = field.kind === 'year' && yearPeriods ? YearRangeField : FacetField;
        const change = (values: string[], said?: string) =>
          onChange({ ...selection, [field.id]: values }, said);
        return (
          <div key={field.id} className="uib-filter-row" data-open={isOpen || undefined}>
            <Heading className="uib-filter-row-heading">
              <button
                type="button"
                className="uib-filter-row-toggle"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                ref={(button) => {
                  toggles.current.set(field.id, button);
                }}
                onClick={() => setOpen(isOpen ? undefined : field.id)}
              >
                <span className="uib-filter-row-text">
                  <span className="uib-filter-row-name">{field.heading ?? field.label}</span>
                  {/* A space between the two in the button's name, whatever lays them out. */}{' '}
                  <span className="uib-filter-row-chosen">
                    {chosen.length === 0 || showsAsAll(field, selected)
                      ? t(field.kind === 'year' ? 'filter.allYears' : 'filter.all')
                      : chosen.join(', ')}
                  </span>
                </span>
                {isOpen ? (
                  <ChevronDownIcon aria-hidden className="uib-filter-row-icon" />
                ) : (
                  <ChevronRightIcon aria-hidden className="uib-filter-row-icon" />
                )}
              </button>
            </Heading>
            {/* Kept, only hidden, so a field's list and text survive folding. A field at the small
                size, as the rows around it; the ticks size themselves. */}
            <div
              id={bodyId}
              className="uib-filter-row-body"
              hidden={!isOpen}
              data-size={few ? undefined : 'sm'}
            >
              {few ? (
                <Checkboxes
                  field={field}
                  selected={selected}
                  onChange={(values) => change(values)}
                />
              ) : (
                <Field
                  field={field}
                  selected={selected}
                  compact={compact}
                  max={max}
                  labelHidden
                  onChange={change}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
