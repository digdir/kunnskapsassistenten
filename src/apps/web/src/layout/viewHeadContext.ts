import { createContext } from 'react';

/**
 * The pinned head of a scrolling region, offered by the shell and filled by
 * whichever view happens to sit there.
 *
 * Three panels asked for the same thing within a day, and one of them
 * measured why a view cannot build it for itself:
 *
 *   - the sources panel needs «Kilder til svar 1 av 2» and the search to stay
 *     put while a `[n]` marker scrolls the panel 987 px to an excerpt (#54);
 *   - the filter panel needs the corpus line to stay put while the document
 *     list and the facets scroll (#55);
 *   - the answer column needs the search strip to stay put while the reader
 *     steps through hits at the top of a long answer (#60).
 *
 * #54 got there with a view-local rule, and only because nothing in the
 * sources panel sits above its head. #55 could not: «Filtrering» stuck to the
 * top of the scrolling region lands on top of the «Tråder» button, which is
 * ABOVE it in the same box — so the button keeps its place in the tab order,
 * the browser scrolls it into view when it gets focus, and it arrives
 * underneath the head. Clicks go to the head and the focus ring is invisible.
 * WCAG 2.4.11.
 *
 * That is not a bug in the rule, it is the shape of `position: sticky`:
 * anything above the pinned element in the same scrolling box becomes
 * unreachable when the element is pinned. So the head cannot be placed by
 * whoever happens to want it. The shell places it — first in the scrolling
 * region, with nothing above it — and the view says what goes in it.
 *
 * `element` is null until the slot has mounted its box, and the context is
 * absent entirely outside a shell: the preview pages under each view's
 * own `preview/` folder, and most unit tests, mount a view on its own. `ViewHead`
 * falls back to drawing the head where it stands, which is what those want.
 */
export type ViewHeadContextValue = {
  /** The shell's box for this slot, or null before it has been mounted. */
  element: HTMLElement | null;
};

export const ViewHeadContext = createContext<ViewHeadContextValue | undefined>(undefined);
