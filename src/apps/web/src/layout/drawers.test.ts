import { describe, expect, it } from 'vitest';
import {
  bothSidebarsMinViewport,
  defaultLayout,
  drawerMaxViewport,
  drawerPlacement,
  drawerWidth,
  layoutStyle,
  railWidth,
  withAllSidebarsCollapsed,
  withCollapsed,
  withWidth,
  type Layout,
} from './viewModel';

/**
 * The arithmetic under the drawers.
 *
 * What is measured here is the model: where the breakpoint sits, what the row
 * is made of below it, and how wide the answer column may be. The drawer
 * itself — focus trap, Escape, inert background, no horizontal scrolling — is
 * the browser's work and is measured in a browser, in tests/e2e/drawers.spec.ts.
 *
 * The numbers are written out rather than imported, for the reason
 * resize.test.ts gives: a test that imports the number it checks agrees with
 * the code even when the code and the decision do not.
 */
const bothOpen: Layout = withCollapsed(defaultLayout, 'secondary-sidebar', false);

/** The three windows the drawers are about. */
const AT_1024 = 1024;
/** 1440 at 200 % zoom. WCAG 1.4.4 Resize text. */
const AT_720 = 720;

describe('drawerMaxViewport', () => {
  it('is where the widest surviving state stops fitting beside the answer', () => {
    // 400 (navigasjonspanelet) + 32 + 640 (gulvet til hovedkolonnen) + 67
    // (kildepanelet som rail). De to andre tilstandene er smalere og følger
    // med: 67 + 640 + 32 + 336 = 1075, og 67 + 640 + 67 = 774.
    expect(drawerMaxViewport).toBe(1139);
  });

  it('sits below the one-sidebar breakpoint, which is why one drawer at a time needs no rule', () => {
    // Regel B er allerede i kraft overalt der skuffene gjelder, så to skuffer
    // kan ikke være åpne samtidig fordi to sidekolonner ikke kan det.
    expect(drawerMaxViewport).toBeLessThan(bothSidebarsMinViewport);
    expect(bothSidebarsMinViewport).toBe(1440);
  });
});

describe('drawerPlacement', () => {
  it('slides each drawer in from the edge its slot stands at', () => {
    // Lest av `slotOrder`, som `growthDirection`, så en layout som flyttet et
    // panel ville flyttet dette med seg i stedet for å være uenig med det.
    // `left` og `right` er Designsystemets egne verdier.
    expect(drawerPlacement('primary-sidebar')).toBe('left');
    expect(drawerPlacement('secondary-sidebar')).toBe('right');
  });
});

describe('drawerWidth', () => {
  it('draws the design width, not one the reader dragged in a wide window', () => {
    // En bredde valgt for en kolonne som står VED SIDEN AV svaret sier
    // ingenting om en som ligger OVER det.
    const dragged = withWidth(bothOpen, 'primary-sidebar', 480);
    expect(drawerWidth('primary-sidebar', AT_1024)).toBe(400);
    expect(drawerWidth('secondary-sidebar', AT_1024)).toBe(432);
    // Og bredden i modellen er fortsatt 480: den er ignorert, ikke glemt.
    expect(dragged.slots['primary-sidebar'].sizing).toMatchObject({ width: 480 });
  });

  it('never draws a drawer wider than the screen it is on', () => {
    expect(drawerWidth('secondary-sidebar', 320)).toBe(320);
  });
});

describe('layoutStyle i skuff-modus', () => {
  it('lar begge sidekolonnene stå som rail på rada, åpen eller ikke', () => {
    // Det som er åpent tegnes over hovedkolonnen og tar ikke plass på rada.
    const style = layoutStyle(bothOpen, AT_1024, true);
    expect(style['--ka-primary-sidebar-width']).toBe(`${railWidth}px`);
    expect(style['--ka-secondary-sidebar-width']).toBe(`${railWidth}px`);
    expect(style['--ka-primary-sidebar-min-width']).toBe(`${railWidth}px`);
  });

  it('gir hovedkolonnen gulvet sitt så lenge vinduet har plass til det', () => {
    // 1024 − 67 − 67 = 890, som er over 640. Gulvet står.
    expect(layoutStyle(bothOpen, AT_1024, true)['--ka-main-min-width']).toBe('640px');
  });

  it('lar gulvet vike når vinduet er smalere enn railene pluss 640', () => {
    // 1440 med 200 % zoom er 720 CSS-px, og 67 + 640 + 67 = 774. Gulvet finnes
    // for at kildene skal kunne leses VED SIDEN AV svaret, og i skuff-modus er
    // ingenting ved siden av svaret — så det å holde på det ville bare kjøpt
    // en vannrett rullelist. WCAG 1.4.10 og 1.4.4.
    expect(layoutStyle(bothOpen, AT_720, true)['--ka-main-min-width']).toBe('586px');
    expect(720 - 2 * railWidth).toBe(586);
  });

  it('holder taket på 800, så hovedkolonnen ikke blir en linje tvers over skjermen', () => {
    expect(layoutStyle(bothOpen, AT_1024, true)['--ka-main-max-width']).toBe('800px');
  });

  it('melder hvor bred hver skuff skal tegnes', () => {
    const style = layoutStyle(bothOpen, AT_1024, true);
    expect(style['--ka-primary-sidebar-drawer-width']).toBe('400px');
    expect(style['--ka-secondary-sidebar-drawer-width']).toBe('432px');
  });

  it('endrer ingenting over brytepunktet', () => {
    // Rail, regel B og panelbredder er uendret der skuffene ikke gjelder.
    const wide = layoutStyle(bothOpen, 1440, false);
    expect(wide['--ka-primary-sidebar-width']).toBe('400px');
    expect(wide['--ka-secondary-sidebar-width']).toBe('336px');
    expect(wide['--ka-main-min-width']).toBe('640px');
    expect(wide['--ka-primary-sidebar-drawer-width']).toBeUndefined();
  });
});

describe('withAllSidebarsCollapsed', () => {
  it('folder begge bort, uansett hva som sto åpent', () => {
    const folded = withAllSidebarsCollapsed(bothOpen);
    expect(folded.slots['primary-sidebar'].collapsed).toBe(true);
    expect(folded.slots['secondary-sidebar'].collapsed).toBe(true);
  });

  it('lar bredder og visninger stå: det er bare det åpne som lukkes', () => {
    const dragged = withWidth(bothOpen, 'primary-sidebar', 480);
    const folded = withAllSidebarsCollapsed(dragged);
    expect(folded.slots['primary-sidebar'].sizing).toMatchObject({ width: 480 });
    expect(folded.slots['primary-sidebar'].activeView).toBe(
      bothOpen.slots['primary-sidebar'].activeView,
    );
  });
});
