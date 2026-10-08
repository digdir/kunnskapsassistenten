import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { useViewportWidth } from './useViewportWidth';
import { defaultLayout, drawerMaxViewport, layoutStyle, sidebarSlots } from './viewModel';

/**
 * Bredden raden regnes fra, og hvorfor det er layoutvinduet.
 *
 * Etter et bytte fra desktop til telefon i samme økt, og etter at en telefon
 * ble snudd, sto det et mørkt felt under panelene. Høyden styres av CSS
 * (`height: 100%` fra `html` og ned), og den fulgte med. Det som ikke fulgte
 * med, var bredden: raden ble regnet fra `innerWidth`, som på en telefon er
 * det synlige vinduet. Var raden for bred, zoomet nettleseren ut, det synlige
 * vinduet ble bredere, og raden holdt seg for bred. Skallet dekket da bare den
 * øverste delen av et utzoomet vindu (målt 06.10: 774 × 1678 CSS-px, zoom 0,51,
 * skall på 852 px).
 *
 * jsdom har ingen layout. `setViewportWidth` setter layoutvinduet
 * (`documentElement.clientWidth`) og sender `resize`, slik nettleseren gjør når
 * vinduet endres eller snus. `innerWidth` settes for seg der testen trenger et
 * synlig vindu som er større.
 */

afterEach(() => {
  resetViewport();
});

/** The row as the shell draws it at this width. */
function rowAt(viewport: number): number {
  const drawer = viewport < drawerMaxViewport;
  const style = layoutStyle(defaultLayout, viewport, drawer);
  let sum = Number.parseFloat(style['--ka-main-min-width']);
  for (const slot of sidebarSlots) {
    sum += Number.parseFloat(style[`--ka-${slot}-width`]);
    if (!drawer && !defaultLayout.slots[slot].collapsed) sum += 32;
  }
  return sum;
}

describe('useViewportWidth', () => {
  it('leser layoutvinduet, ikke det synlige vinduet når siden er zoomet ut', () => {
    setViewportWidth(393);
    // Zoomed out to 0.51, as the browser did with a row 774 px wide.
    window.innerWidth = 774;
    window.dispatchEvent(new Event('resize'));

    const { result } = renderHook(() => useViewportWidth());

    expect(result.current).toBe(393);
  });

  it('gir en rad som får plass i layoutvinduet, så det ikke blir noe å zoome ut', () => {
    setViewportWidth(393);
    window.innerWidth = 774;

    const { result } = renderHook(() => useViewportWidth());

    expect(rowAt(result.current)).toBeLessThanOrEqual(393);
    // What the old reading gave: a row as wide as the zoomed-out window, which
    // is what kept it zoomed out.
    expect(rowAt(window.innerWidth)).toBe(774);
  });

  it('følger med fra desktop til telefon, snudd og tilbake', () => {
    setViewportWidth(1440);
    const { result } = renderHook(() => useViewportWidth());
    expect(result.current).toBe(1440);

    for (const width of [393, 852, 393]) {
      act(() => setViewportWidth(width));
      expect(result.current).toBe(width);
      expect(rowAt(result.current)).toBeLessThanOrEqual(width);
    }
  });

  it('flytter seg ikke når bare det synlige vinduet endres, som ved zoom', () => {
    setViewportWidth(393);
    const { result } = renderHook(() => useViewportWidth());

    act(() => {
      window.innerWidth = 774;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(393);
  });
});
