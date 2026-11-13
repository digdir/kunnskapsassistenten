import type { ChosenValue } from './FilterStates.js';
import type { FilterField, FilterSelection } from './types.js';
import { formatRange, toRanges } from './yearRanges.js';

const keysOf = (a: FilterSelection, b: FilterSelection) =>
  new Set([...Object.keys(a), ...Object.keys(b)]);

/** Whether two selections hold the same values, in any order. An absent field is an empty one. */
export const sameSelection = (a: FilterSelection, b: FilterSelection) =>
  [...keysOf(a, b)].every((field) => {
    const left = new Set(a[field] ?? []);
    const right = new Set(b[field] ?? []);
    return left.size === right.size && [...left].every((value) => right.has(value));
  });

/** Whether anything is chosen in any field. */
export const isEmptySelection = (selection: FilterSelection) =>
  Object.values(selection).every((values) => values.length === 0);

/** Every chosen value, in the selection's order, with its label where a field lists it. */
export const chosenValues = (
  selection: FilterSelection,
  fields: readonly FilterField[] | undefined,
): ChosenValue[] =>
  Object.entries(selection).flatMap(([field, values]) => {
    const options = fields?.find((candidate) => candidate.id === field)?.options;
    return values.map((value) => ({
      field,
      value,
      label: options?.find((option) => option.value === value)?.label,
    }));
  });

/** The chosen values no field on screen can show, which a stored filter may still hold. */
export const valuesWithoutField = (
  selection: FilterSelection,
  fields: readonly FilterField[] | undefined,
): ChosenValue[] =>
  chosenValues(selection, fields).filter(
    (chosen) => !fields?.some((field) => field.id === chosen.field),
  );

/** What a question is asked with: a field with every listed value ticked is left out. */
export const narrowing = (
  selection: FilterSelection,
  fields: readonly FilterField[] | undefined,
): FilterSelection => {
  let changed = false;
  const asked: Record<string, readonly string[]> = { ...selection };
  for (const field of fields ?? []) {
    const chosen = selection[field.id] ?? [];
    if (field.options.length === 0 || chosen.length === 0) continue;
    const ticked = new Set(chosen);
    if (field.options.every((option) => ticked.has(option.value))) {
      asked[field.id] = [];
      changed = true;
    }
  }
  return changed ? asked : selection;
};

/**
 * One field's chosen values in the reader's words: each option's label, and a year field's years
 * in a row as one period, «2020–2025». The filter's rows, the answer's chips and the line under
 * the field all name values with it, so the three never drift apart.
 */
export const fieldValueLabels = (
  field: FilterField | undefined,
  values: readonly string[],
): string[] => {
  if (field?.kind === 'year' && values.every((value) => /^\d+$/u.test(value)))
    return toRanges(values).map(formatRange);
  return values.map(
    (value) => field?.options.find((option) => option.value === value)?.label ?? value,
  );
};

/** What a question narrows to, field by field in the fields' order, in the reader's words. */
export const valueLabels = (
  selection: FilterSelection,
  fields: readonly FilterField[] | undefined,
): string[] => {
  const asked = narrowing(selection, fields);
  const order = [
    ...(fields ?? []).map((field) => field.id),
    ...Object.keys(asked).filter((id) => !fields?.some((field) => field.id === id)),
  ];
  return order.flatMap((id) =>
    fieldValueLabels(
      fields?.find((field) => field.id === id),
      asked[id] ?? [],
    ),
  );
};

/**
 * How many documents a selection reads from, exactly: the counts of the field each document has
 * one value in, the type field, else a year field, summed over its chosen values, or all of them
 * when none is chosen. Each count is given the other fields, as the facets are. Undefined while a
 * count is missing.
 */
export const documentCount = (
  fields: readonly FilterField[] | undefined,
  selection: FilterSelection,
  typeField?: string,
): number | undefined => {
  const field = [
    fields?.find((candidate) => candidate.id === typeField),
    fields?.find((candidate) => candidate.kind === 'year'),
  ]
    .filter((candidate) => candidate !== undefined && candidate.options.length > 0)
    .find((candidate) => candidate?.options.every((option) => option.count !== undefined));
  if (!field) return undefined;
  const chosen = narrowing(selection, fields)[field.id] ?? [];
  return field.options
    .filter((option) => chosen.length === 0 || chosen.includes(option.value))
    .reduce((sum, option) => sum + (option.count ?? 0), 0);
};
