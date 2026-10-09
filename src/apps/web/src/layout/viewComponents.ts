import type { ComponentType } from 'react';
import { ChatSlotView } from './slotViews/ChatSlotView';
import { SourcesSlotView } from './slotViews/SourcesSlotView';
import type { SlotViewProps, ViewId } from './viewModel';
import { FiltersView } from '../views/filters';
import { ThreadsView } from '../views/threads';

/**
 * Which component renders which view. Every view, `chat` included, goes through this table so any
 * view can move between slots. `chat` and `sources` need more than `SlotViewProps`, so they get
 * small adapters in `slotViews/` instead of new props for every view.
 */
export const viewComponents: Record<ViewId, ComponentType<SlotViewProps>> = {
  threads: ThreadsView,
  filters: FiltersView,
  chat: ChatSlotView,
  sources: SourcesSlotView,
};
