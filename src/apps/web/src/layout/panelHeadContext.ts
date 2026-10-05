import { createContext } from 'react';
import type { ViewHeadContextValue } from './viewHeadContext';

/**
 * The panel's own head row — the line with «Skjul tråder og filter» on it —
 * offered by the shell and filled by whichever view sits in the slot.
 *
 * The second place a view can write into, and deliberately a different one
 * from `ViewHeadContext`. That one is the top of the SCROLLING REGION: it
 * pins, it scrolls with nothing above it, and it is where a view puts what
 * must stay visible while the panel scrolls. This is the row ABOVE the
 * scrolling region, beside the collapse button, and it never scrolls at all.
 *
 * It exists because of a measurement rather than a preference. «Tråder» sat
 * in the filter view's pinned head and cost 48 px of a head that already took
 * 179 of a 598 px scrolling window at 1280 × 720 — and the panel scrolls at
 * every width we draw, 1920 included (988 px of content in 958). The button
 * is one control that belongs to the PANEL rather than to what is in it, so
 * it belongs on the panel's row. Measured in
 * design/hoydebudsjett-forslag-2026-09-21.md, N1; Lars said yes on 21.09.
 *
 * Same shape as the view head, and that is on purpose: a view fills it with
 * `PanelHead` exactly the way it fills the other with `ViewHead`, and neither
 * needs to know how the shell draws it.
 *
 * `element` is null before the slot has mounted its box, and ALSO when the
 * panel is drawn as a rail — a rail is one button wide and has no room for a
 * second. The context is absent entirely outside a shell, where a view is
 * mounted on its own.
 */
export type PanelHeadContextValue = ViewHeadContextValue;

export const PanelHeadContext = createContext<PanelHeadContextValue | undefined>(undefined);
