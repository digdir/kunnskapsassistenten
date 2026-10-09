import { createContext } from 'react';
import type { Layout, Slot, ViewId } from './viewModel';

export type LayoutContextValue = {
  layout: Layout;
  /** Show a view that already sits in the slot. */
  setActiveView: (slot: Slot, view: ViewId) => void;
  setCollapsed: (slot: Slot, collapsed: boolean) => void;
  toggleCollapsed: (slot: Slot) => void;
  /** Resize a fixed slot. */
  setWidth: (slot: Slot, width: number) => void;
  /** Move a view to another slot. No UI calls this yet. */
  moveView: (view: ViewId, target: Slot) => void;
  /**
   * Whether the user switched this slot to its view; decides focus on mount. Never persisted.
   */
  isSwitchedByUser: (slot: Slot) => boolean;
};

/** Own file so LayoutProvider.tsx exports only a component and Fast Refresh keeps working. */
export const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);
