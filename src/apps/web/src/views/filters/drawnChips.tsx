// Chips we draw for several values at once, over Suggestion's chip per value. Suggestion still
// holds every chosen value as a `<data>` chip of its own, which CSS hides (filters.css), so
// u-combobox ticks the options, takes one value off when a ticked option is chosen, and reads
// out and counts single values. The drawn chips come last, as `<data>` too: u-combobox gives
// ArrowLeft and Backspace from the field to the last chip, and a hidden one cannot take focus.
// `compact-filter-chips` draws one chip for the whole field; `year-ranges` draws one per period.

import type { ReactNode } from 'react';

/** One chip for several values; removing it removes them all. */
export type DrawnChip = {
  /** Stable while the chip stands, as the key of its `<data>`. */
  key: string;
  label: string;
  values: readonly string[];
};

type Item = { value: string; label: string };

/** No key the backend sends starts with a null. */
const DRAWN = '\u0000drawn:';

const valueOf = (chip: DrawnChip) => `${DRAWN}${chip.key}`;

const isDrawn = (value: string) => value.startsWith(DRAWN);

/** Suggestion's `selected`: a chip per value, then the drawn ones. */
export function withDrawnChips(items: Item[], drawn: readonly DrawnChip[]): Item[] {
  return [...items, ...drawn.map((chip) => ({ value: valueOf(chip), label: chip.label }))];
}

/**
 * The values after a change from Suggestion: what it holds, less the values of a drawn chip it
 * no longer holds. A ticked option chosen again takes its own chip off, as without drawn chips.
 */
export function valuesAfter(
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
): string[] {
  const kept = new Set(items.map((item) => item.value));
  const removed = new Set(
    drawn.filter((chip) => !kept.has(valueOf(chip))).flatMap((c) => c.values),
  );
  return items.map((item) => item.value).filter((value) => !isDrawn(value) && !removed.has(value));
}

/** Whether the change took a drawn chip off: its focus is then lost with it. */
export function removedDrawnChip(
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
): boolean {
  const kept = new Set(items.map((item) => item.value));
  return drawn.some((chip) => !kept.has(valueOf(chip)));
}

/** The values of the chips Suggestion holds for a selection, as `withDrawnChips` lays them out. */
export function chipValues(values: readonly string[], drawn: readonly DrawnChip[]): string[] {
  return [...values, ...drawn.map(valueOf)];
}

/** How many chips come or go between two selections. u-combobox reads a change out itself only
 * when it is one; then the field must not say it too, or it is heard twice. */
export function changedChips(before: readonly string[], after: readonly string[]): number {
  const was = new Set(before);
  const is = new Set(after);
  return (
    [...is].filter((value) => !was.has(value)).length +
    [...was].filter((value) => !is.has(value)).length
  );
}

/**
 * Focus after a drawn chip that held it goes. u-combobox moves it to the chip before, as it does
 * for its own; before the first drawn chip stands a hidden one, which cannot take it. Then to the
 * next drawn chip that stays, else the field.
 */
export function keepFocusFromDrawnChip(
  items: readonly { value: string }[],
  drawn: readonly DrawnChip[],
  field: HTMLInputElement | null,
) {
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
}

/** Suggestion's `renderSelected`: the marker filters.css keeps a drawn chip visible by. */
export function renderChip({ label, value }: Item): ReactNode {
  return isDrawn(value) ? <span className="drawn-chip">{label}</span> : label;
}
