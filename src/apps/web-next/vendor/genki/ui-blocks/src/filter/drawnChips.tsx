// Chips drawn for several values over Suggestion's own, which CSS hides (filter.css).

import type { ReactNode } from 'react';

/** One chip for several values; removing it removes them all. */
export interface DrawnChip {
  /** Stable while the chip stands, as the key of its `<data>`. */
  key: string;
  label: string;
  values: readonly string[];
}

interface Item {
  value: string;
  label: string;
}

/** No key a platform sends starts with a null. */
const DRAWN = '\u0000drawn:';

const valueOf = (chip: DrawnChip) => `${DRAWN}${chip.key}`;

const isDrawn = (value: string) => value.startsWith(DRAWN);

/** Suggestion's `selected`: a chip per value, then the drawn ones. */
export const withDrawnChips = (items: Item[], drawn: readonly DrawnChip[]): Item[] => [
  ...items,
  ...drawn.map((chip) => ({ value: valueOf(chip), label: chip.label })),
];

/** The values after a change, less those of a drawn chip Suggestion no longer holds. */
export const valuesAfter = (
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
): string[] => {
  const kept = new Set(items.map((item) => item.value));
  const removed = new Set(
    drawn.filter((chip) => !kept.has(valueOf(chip))).flatMap((chip) => chip.values),
  );
  return items.map((item) => item.value).filter((value) => !isDrawn(value) && !removed.has(value));
};

/** Whether the change took a drawn chip off: its focus is then lost with it. */
export const removedDrawnChip = (
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
): boolean => {
  const kept = new Set(items.map((item) => item.value));
  return drawn.some((chip) => !kept.has(valueOf(chip)));
};

/** The values of the chips Suggestion holds for a selection, as `withDrawnChips` lays them out. */
export const chipValues = (values: readonly string[], drawn: readonly DrawnChip[]): string[] => [
  ...values,
  ...drawn.map(valueOf),
];

/** How many chips come or go; u-combobox reads out a change of one itself. */
export const changedChips = (before: readonly string[], after: readonly string[]): number => {
  const was = new Set(before);
  const is = new Set(after);
  return (
    [...is].filter((value) => !was.has(value)).length +
    [...was].filter((value) => !is.has(value)).length
  );
};

/** Focus after a drawn chip that held it goes: the next drawn chip that stays, else the field. */
export const keepFocusFromDrawnChip = (
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
  field: HTMLInputElement | null,
) => {
  const focused = document.activeElement;
  const row = field?.parentElement;
  if (!field || !row || !(focused instanceof HTMLDataElement) || focused.parentElement !== row) {
    return;
  }
  const kept = new Set(items.map((item) => item.value));
  const gone = drawn.find((chip) => !kept.has(valueOf(chip)));
  // On a drawn chip that stays: u-combobox found the one before.
  if (!gone || (isDrawn(focused.value) && kept.has(focused.value))) return;
  const chips = [...row.children].filter(
    (chip): chip is HTMLDataElement => chip instanceof HTMLDataElement && isDrawn(chip.value),
  );
  const after = chips.slice(chips.findIndex((chip) => chip.value === valueOf(gone)) + 1);
  (after.find((chip) => kept.has(chip.value)) ?? field).focus({ focusVisible: true });
};

/** Suggestion's `renderSelected`: the marker filter.css keeps a drawn chip visible by. */
export const renderChip = ({ label, value }: Item): ReactNode =>
  isDrawn(value) ? <span className="uib-filter-drawn-chip">{label}</span> : label;
