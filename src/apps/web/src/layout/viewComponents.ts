import type { ComponentType } from 'react';
import { ChatSlotView } from './slotViews/ChatSlotView';
import { SourcesSlotView } from './slotViews/SourcesSlotView';
import type { SlotViewProps, ViewId } from './viewModel';
import { FiltersView } from '../views/filters';
import { ThreadsView } from '../views/threads';

/**
 * Which component renders which view.
 *
 * All four views go through this table, `chat` included. It used to be an
 * exception, drawn by the router outlet in the main slot, and that exception
 * is gone: a view that only one slot can render is not movable, and movable
 * is the whole reason the layout is modelled at all (answers 10 and 48).
 *
 * The shell hands every view the same `SlotViewProps`. Two of them take those
 * props as they are. The two that do not are adapted in `slotViews/`, one
 * small component each, rather than growing `SlotViewProps` a field per view:
 *
 *   - `chat` needs the thread named in the URL, which is a router concern,
 *     and the sources it produces have to reach the sources view.
 *   - `sources` needs those documents.
 *
 * The adapters are the seam. A view stays a plain component that knows
 * nothing about routes or about the other views, and the shell stays a shell.
 */
export const viewComponents: Record<ViewId, ComponentType<SlotViewProps>> = {
  threads: ThreadsView,
  filters: FiltersView,
  chat: ChatSlotView,
  sources: SourcesSlotView,
};
