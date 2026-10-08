import { createContext } from 'react';
import type { ViewHeadContextValue } from './viewHeadContext';

/**
 * The panel's own head row (with «Skjul tråder og filter»), ABOVE the scrolling region, so panel
 * controls take no height from the pinned head. `element` is null before mount and on a rail; the
 * context is absent outside a shell.
 */
export type PanelHeadContextValue = ViewHeadContextValue;

export const PanelHeadContext = createContext<PanelHeadContextValue | undefined>(undefined);
