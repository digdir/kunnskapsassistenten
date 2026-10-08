import { describe, expect, it } from 'vitest';
import { withStoredWidths } from './persistence';
import { widthRange } from './resize';
import {
  bothSidebarsMinViewport,
  defaultLayout,
  drawerMaxViewport,
  drawerWidth,
  layoutStyle,
  sidebarSlots,
  slotGap,
  withCollapsed,
  withOneSidebarOpen,
  withWidth,
  type Layout,
  type SidebarSlot,
} from './viewModel';

/**
 * Raden får plass i vinduet, på hver bredde fra 280 til 2000 px.
 *
 * Det som måles, er regnestykket CSS-en tegner fra (`layoutStyle`):
 * panelenes bredder, mellomrommet ved et åpent panel og hovedkolonnens
 * minstebredde. Summen skal aldri bli større enn vinduet, for da ruller noe
 * sidelengs (WCAG 1.4.10).
 *
 * Hver bredde for seg, i en løkke, så overgangene mellom skuff, ett panel og
 * to paneler er med uten at noen har valgt dem ut. Tilstandene er de som kan
 * nås: alle kombinasjoner av åpent og lukket, regelen om ett panel under
 * `bothSidebarsMinViewport`, og panelbredder fra designet, fra en økt som dro
 * dem så langt det gikk, og fra et lager med tall som er altfor store.
 *
 * Det jsdom ikke kan måle, som tekst som ikke brytes, passer
 * tests/e2e/viewport-fit.spec.ts på.
 */

const FIRST = 280;
const LAST = 2000;
const widths = Array.from({ length: LAST - FIRST + 1 }, (_, index) => FIRST + index);

const px = (value: string | undefined) => Number.parseFloat(value ?? 'NaN');

type Row = {
  drawer: boolean;
  main: number;
  sidebars: number;
  gaps: number;
};

/** The row as the shell draws it, from the same numbers the CSS gets. */
function row(layout: Layout, viewport: number): Row {
  const drawer = viewport < drawerMaxViewport;
  const style = layoutStyle(layout, viewport, drawer);
  let sidebars = 0;
  let gaps = 0;
  for (const slot of sidebarSlots) {
    sidebars += px(style[`--ka-${slot}-width`]);
    // `data-collapsed` in Shell.tsx: a rail, or every panel in drawer mode,
    // has no gap. An open panel on the row has one (global.css).
    if (!drawer && !layout.slots[slot].collapsed) gaps += slotGap;
  }
  return { drawer, main: px(style['--ka-main-min-width']), sidebars, gaps };
}

/** Every open/closed combination, as the provider would hand it on. */
function reachable(layout: Layout, viewport: number): Layout[] {
  const combinations: Layout[] = [];
  for (const primary of [false, true]) {
    for (const secondary of [false, true]) {
      combinations.push(
        withCollapsed(
          withCollapsed(layout, 'primary-sidebar', primary),
          'secondary-sidebar',
          secondary,
        ),
      );
    }
  }
  if (viewport >= bothSidebarsMinViewport || viewport < drawerMaxViewport) return combinations;
  // One panel at a time between the drawers and room for two (LayoutProvider).
  return combinations.flatMap((candidate) =>
    sidebarSlots.map((keep) => withOneSidebarOpen(candidate, keep)),
  );
}

/** The panel widths a session can leave behind. */
function sized(viewport: number): { name: string; layout: Layout }[] {
  const widest = (layout: Layout, slot: SidebarSlot) =>
    withWidth(layout, slot, widthRange(layout, slot, viewport).max);
  return [
    { name: 'designet', layout: defaultLayout },
    {
      name: 'dratt så langt det går',
      layout: widest(widest(defaultLayout, 'primary-sidebar'), 'secondary-sidebar'),
    },
    {
      name: 'altfor store tall i lageret',
      layout: withStoredWidths(defaultLayout, {
        collapsed: {},
        widths: { 'primary-sidebar': 99_999, 'secondary-sidebar': 99_999 },
        sourcesDismissed: false,
      }),
    },
  ];
}

/** Every reachable state at every width, as one list of failures. */
function failures(check: (row: Row, viewport: number) => string | undefined): string[] {
  const found: string[] = [];
  for (const viewport of widths) {
    for (const { name, layout } of sized(viewport)) {
      for (const state of reachable(layout, viewport)) {
        const problem = check(row(state, viewport), viewport);
        if (!problem) continue;
        const open = sidebarSlots.filter((slot) => !state.slots[slot].collapsed).join(' og ');
        found.push(`${viewport} px, ${name}, åpent: ${open || 'ingen'}: ${problem}`);
      }
    }
  }
  return found;
}

describe('raden og vinduet, fra 280 til 2000 px', () => {
  it('er aldri bredere enn vinduet', () => {
    const found = failures(({ main, sidebars, gaps }, viewport) => {
      const sum = main + sidebars + gaps;
      return sum > viewport ? `${sum} px på rad, ${sum - viewport} for mye` : undefined;
    });

    expect(found.slice(0, 10), `${found.length} tilfeller`).toEqual([]);
  });

  it('gir hovedkolonnen mellom 0 og det som er ledig', () => {
    const found = failures(({ main, sidebars, gaps }, viewport) => {
      const free = viewport - sidebars - gaps;
      if (Number.isNaN(main)) return 'ingen minstebredde';
      if (main < 0) return `minstebredden er ${main}`;
      return main > free ? `minstebredden ${main} er over de ledige ${free}` : undefined;
    });

    expect(found.slice(0, 10), `${found.length} tilfeller`).toEqual([]);
  });

  it('har aldri et panel med negativ bredde', () => {
    const found = failures(({ sidebars }) =>
      sidebars < 0 ? `panelene er ${sidebars} px til sammen` : undefined,
    );

    expect(found).toEqual([]);
  });

  it('tegner panelene som skinner under skuffgrensen, uansett lagret bredde', () => {
    // Two rails of 67, whatever was stored: a drawer stands over the answer
    // column and takes no part in the row.
    const found = failures(({ drawer, sidebars }) =>
      drawer && sidebars !== 2 * 67 ? `panelene er ${sidebars} px i skuffmodus` : undefined,
    );

    expect(found).toEqual([]);
  });
});

describe('lagrede bredder og skuffer, fra 280 til 2000 px', () => {
  it('klemmer en lagret bredde inn i det vinduet har plass til', () => {
    const stored = withStoredWidths(defaultLayout, {
      collapsed: {},
      widths: { 'primary-sidebar': 99_999, 'secondary-sidebar': 99_999 },
      sourcesDismissed: false,
    });
    const found: string[] = [];
    for (const viewport of widths) {
      if (viewport < drawerMaxViewport) continue;
      for (const state of reachable(stored, viewport)) {
        const style = layoutStyle(state, viewport);
        for (const slot of sidebarSlots) {
          const width = px(style[`--ka-${slot}-width`]);
          if (width > viewport) found.push(`${viewport} px: ${slot} er ${width}`);
        }
      }
    }

    expect(found.slice(0, 10), `${found.length} tilfeller`).toEqual([]);
  });

  it('har aldri en skuff som er bredere enn vinduet', () => {
    const found = widths.flatMap((viewport) =>
      sidebarSlots
        .filter((slot) => drawerWidth(slot, viewport) > viewport)
        .map((slot) => `${viewport} px: ${slot} er ${drawerWidth(slot, viewport)}`),
    );

    expect(found).toEqual([]);
  });

  it('lar ikke et panel dras bredere enn det raden har plass til', () => {
    const found: string[] = [];
    for (const viewport of widths) {
      // No drag handle in drawer mode (PanelSeparator).
      if (viewport < drawerMaxViewport) continue;
      for (const state of reachable(defaultLayout, viewport)) {
        for (const slot of sidebarSlots) {
          if (state.slots[slot].collapsed) continue;
          const dragged = withWidth(state, slot, widthRange(state, slot, viewport).max);
          const { main, sidebars, gaps } = row(dragged, viewport);
          if (main + sidebars + gaps > viewport) {
            found.push(`${viewport} px: ${slot} dratt til ${main + sidebars + gaps} på rad`);
          }
        }
      }
    }

    expect(found.slice(0, 10), `${found.length} tilfeller`).toEqual([]);
  });
});
