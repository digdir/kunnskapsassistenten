// A year field's values, kept to the years a reader may mean. A collection's year field can hold
// page numbers and parse noise, and years far ahead where a document names a period that runs for
// centuries; genki returns them all, so the list showed «2252 (0)». Every field the profile marks
// `kind: 'year'` is kept to its `years`, or to `FIRST_YEAR` up to this year.
import type { FilterField, FilterSelection } from '@genai/ui-blocks';
import type { FieldSpec, YearBounds } from './profile.js';

/** The first year kept when the profile names none. */
export const FIRST_YEAR = 1900;

/**
 * The year it is in Norway, the last year kept unless the profile names one. Oslo and not the
 * machine's clock: an hour into the new year in Norway, a browser on UTC still has the old one.
 */
export const currentYear = (now: Date): number =>
  Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Oslo', year: 'numeric' }).format(now));

const YEAR = /^\d{4}$/;

/**
 * A year field's options within its bounds, newest first. A value the reader has chosen stays,
 * whatever it is, so its chip keeps its label and can be removed. Any other field is left as it is.
 */
export const boundYears = (
  field: FilterField,
  bounds: YearBounds | undefined,
  chosen: readonly string[],
  thisYear: number,
): FilterField => {
  if (field.kind !== 'year') return field;
  const first = bounds?.first ?? FIRST_YEAR;
  const last = bounds?.last ?? thisYear;
  const keep = (value: string) => {
    if (chosen.includes(value)) return true;
    if (!YEAR.test(value)) return false;
    const year = Number(value);
    return year >= first && year <= last;
  };
  // A chosen value that is no year goes last.
  const order = (value: string) => (YEAR.test(value) ? Number(value) : -1);
  return {
    ...field,
    options: field.options
      .filter((option) => keep(option.value))
      .sort((a, b) => order(b.value) - order(a.value)),
  };
};

/** The facets genki gave, each year field kept to the bounds its profile gives it. */
export const withinYears = (
  found: readonly FilterField[],
  fields: readonly FieldSpec[],
  selection: FilterSelection,
  thisYear: number,
): FilterField[] =>
  found.map((field) =>
    boundYears(
      field,
      fields.find((spec) => spec.id === field.id)?.years,
      selection[field.id] ?? [],
      thisYear,
    ),
  );
