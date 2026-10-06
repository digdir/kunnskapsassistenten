import { describe, expect, it } from 'vitest';
import { clampWidth, growthDirection, widthRange } from './resize';
import {
  bothSidebarsMinViewport,
  defaultLayout,
  fittedWidths,
  withCollapsed,
  withWidth,
  type Layout,
} from './viewModel';

/** Both sidebars open, which is the state every bound here is about. */
const bothOpen: Layout = withCollapsed(defaultLayout, 'secondary-sidebar', false);

/** The three windows the product is measured at. */
const AT_1280 = 1280;
const AT_1440 = bothSidebarsMinViewport;
const AT_1536 = 1536;
const AT_1920 = 1920;

describe('widthRange', () => {
  it('lets the navigation panel grow into what the answer column is not using', () => {
    // 1920 − 432 (sources) − 32 − 32 (two gaps) − 640 (the answer column's
    // floor) = 784. The panel has no ceiling of its own (issue 80), so
    // this is the ceiling.
    expect(widthRange(bothOpen, 'primary-sidebar', AT_1920)).toEqual({ min: 400, max: 784 });
  });

  it('gives either panel all the window has once the other is a rail', () => {
    // Window − 67 (the rail) − 32 (this panel's gap) − 640. Issue 80
    // asked for at least half the window; the answer column's 640 floor
    // allows that from 1478 up, so 1512 gets it and 1440 falls 19 short.
    const sourcesOpen = withCollapsed(
      withCollapsed(defaultLayout, 'primary-sidebar', true),
      'secondary-sidebar',
      false,
    );
    expect(widthRange(defaultLayout, 'primary-sidebar', AT_1440).max).toBe(701);
    expect(widthRange(sourcesOpen, 'secondary-sidebar', AT_1440).max).toBe(701);
    expect(widthRange(defaultLayout, 'primary-sidebar', 1512).max).toBe(773);
    expect(widthRange(sourcesOpen, 'secondary-sidebar', AT_1920).max).toBe(1181);
  });

  it('reads the room a folded panel would have open, which is what a drag that folded it needs', () => {
    // Folded, the panel puts no gap beside itself, and read off the folded
    // layout the room would be 32 px wider than the panel can have once it
    // opens. usePanelWidth asks about the open layout for that reason.
    const folded = withCollapsed(defaultLayout, 'primary-sidebar', true);
    expect(widthRange(folded, 'primary-sidebar', AT_1920).max).toBe(1213);
    expect(
      widthRange(withCollapsed(folded, 'primary-sidebar', false), 'primary-sidebar', AT_1920).max,
    ).toBe(1181);
  });

  it('gives nothing away at 1440, where everything is already on its floor', () => {
    // 400 + 32 + 640 + 32 + 336 is the window exactly. A separator that
    // claimed room here would be promising something the window does not have.
    expect(widthRange(bothOpen, 'primary-sidebar', AT_1440)).toEqual({ min: 400, max: 400 });
    expect(widthRange(bothOpen, 'secondary-sidebar', AT_1440)).toEqual({ min: 336, max: 336 });
  });

  it('measures the room against the other panel as it is drawn, not as it was asked for', () => {
    // The sources panel wants 560 and 1440 can only draw 336. The navigation
    // panel's room is what is left beside the 336 actually on screen.
    const widened = withWidth(bothOpen, 'secondary-sidebar', 560);
    expect(fittedWidths(widened, AT_1440)['secondary-sidebar']).toBe(336);
    expect(widthRange(widened, 'primary-sidebar', AT_1440).max).toBe(400);
  });

  it('takes its room from the answer column and never from the other panel', () => {
    // At 1536 the three slots are at their preferred widths with nothing to
    // spare, so neither panel may grow. Narrowing one is the reader's own
    // second act, and it is what frees the other.
    expect(widthRange(bothOpen, 'primary-sidebar', AT_1536).max).toBe(400);

    // 1536 − 336 − 32 − 32 − 640 = 496.
    const narrowed = withWidth(bothOpen, 'secondary-sidebar', 336);
    expect(widthRange(narrowed, 'primary-sidebar', AT_1536).max).toBe(496);
  });

  it('counts a collapsed neighbour as a rail with no gap', () => {
    // 1280 − 67 (the rail) − 32 (this panel's own gap) − 640 = 541. Rule B
    // keeps only one sidebar open down here, so this is the state the narrow
    // window is actually in.
    expect(widthRange(defaultLayout, 'primary-sidebar', AT_1280)).toEqual({ min: 400, max: 541 });
  });

  it('never reports a ceiling under the floor, however little room there is', () => {
    // Narrower than the design goes at all. The floor is what is drawn and
    // what `aria-valuemin` and `aria-valuemax` then both say.
    const range = widthRange(bothOpen, 'secondary-sidebar', 900);
    expect(range).toEqual({ min: 336, max: 336 });
    expect(range.max).toBeGreaterThanOrEqual(range.min);
  });
});

describe('clampWidth', () => {
  it('keeps a width inside the range, in whole pixels', () => {
    expect(clampWidth(420.4, { min: 400, max: 480 })).toBe(420);
    expect(clampWidth(200, { min: 400, max: 480 })).toBe(400);
    expect(clampWidth(900, { min: 400, max: 480 })).toBe(480);
  });
});

describe('growthDirection', () => {
  it('grows a panel away from the answer column, whichever side it sits on', () => {
    // Read off `slotOrder`, so a layout that moved a panel would move this
    // with it rather than disagree with it.
    expect(growthDirection('primary-sidebar')).toBe(1);
    expect(growthDirection('secondary-sidebar')).toBe(-1);
  });
});

describe('fittedWidths', () => {
  it('draws the panels at what was asked for while there is room', () => {
    expect(fittedWidths(bothOpen, AT_1920)).toEqual({
      'primary-sidebar': 400,
      'secondary-sidebar': 432,
    });
  });

  it('gives the sources panel away first when the window runs short', () => {
    // 400 + 32 + 640 + 32 + 432 = 1536. At 1480 the 56 px missing come out of
    // the sources panel, which is decision 2026-09-14 option A, and the
    // navigation panel is untouched.
    expect(fittedWidths(bothOpen, 1480)).toEqual({
      'primary-sidebar': 400,
      'secondary-sidebar': 376,
    });
  });

  it('takes the navigation panel back to 400 once the sources panel is on its floor', () => {
    // A panel the reader widened in a window with room, in a window without.
    // 480 + 32 + 640 + 32 + 432 = 1616, and 1440 is 176 short: the widening
    // gives its 80 first and the sources panel the other 96.
    const widened = withWidth(bothOpen, 'primary-sidebar', 480);
    expect(fittedWidths(widened, AT_1440)).toEqual({
      'primary-sidebar': 400,
      'secondary-sidebar': 336,
    });
  });

  it('gives a widening back before the other panel gives any of its own width', () => {
    // Widened to 1181 with the sources panel on its rail, then the sources
    // panel opens. 1181 + 32 + 640 + 32 + 432 = 2317, 397 more than 1920: all
    // of it comes out of the widening, and the sources panel keeps its 432.
    const widened = withWidth(bothOpen, 'primary-sidebar', 1181);
    expect(fittedWidths(widened, AT_1920)).toEqual({
      'primary-sidebar': 784,
      'secondary-sidebar': 432,
    });
  });

  it('draws a stored width that does not fit at the same number End stops at', () => {
    // Two answers to «how wide can it be» are one answer (KA CC on #224).
    const end = widthRange(bothOpen, 'primary-sidebar', AT_1920).max;
    const stored = withWidth(bothOpen, 'primary-sidebar', 5000);
    expect(fittedWidths(stored, AT_1920)['primary-sidebar']).toBe(end);

    const endSources = widthRange(bothOpen, 'secondary-sidebar', AT_1920).max;
    const storedSources = withWidth(bothOpen, 'secondary-sidebar', 5000);
    expect(fittedWidths(storedSources, AT_1920)['secondary-sidebar']).toBe(endSources);
  });

  it('takes both widenings back, the sources panel first, before either goes below the design', () => {
    // 900 + 700 + 64 + 640 = 2304, 384 over 1920. The sources panel gives its
    // 268 first, back to 432, and the navigation panel the last 116.
    const both = withWidth(withWidth(bothOpen, 'primary-sidebar', 900), 'secondary-sidebar', 700);
    expect(fittedWidths(both, AT_1920)).toEqual({
      'primary-sidebar': 784,
      'secondary-sidebar': 432,
    });
  });

  it('stops at the floors, and leaves an undesigned window to the stylesheet', () => {
    // Under 1280 nothing is drawn for this product yet. What matters is that
    // the numbers stop at the floors rather than going negative.
    expect(fittedWidths(bothOpen, 800)).toEqual({
      'primary-sidebar': 400,
      'secondary-sidebar': 336,
    });
  });

  it('never squeezes a rail', () => {
    // A collapsed panel is one button wide. The sources panel is collapsed in
    // `defaultLayout`, so this is the state a reader meets.
    expect(fittedWidths(defaultLayout, 1000)['secondary-sidebar']).toBe(67);
  });
});
