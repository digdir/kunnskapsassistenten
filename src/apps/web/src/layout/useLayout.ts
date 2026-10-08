import { use } from 'react';
import { LayoutContext, type LayoutContextValue } from './layoutContext';
import type { Slot, SlotState } from './viewModel';

export function useLayout(): LayoutContextValue {
  const value = use(LayoutContext);
  if (!value) {
    throw new Error('useLayout må brukes inne i en LayoutProvider.');
  }
  return value;
}

/** The state of one slot, for a view that only cares about its own slot. */
export function useSlot(slot: Slot): SlotState {
  return useLayout().layout.slots[slot];
}
