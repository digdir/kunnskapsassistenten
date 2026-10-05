import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { PanelSeparator } from './PanelSeparator';
import { LAYOUT_STORAGE_KEY } from './persistence';
import { widthRange } from './resize';
import { useLayout } from './useLayout';
import { defaultLayout, withCollapsed, type Layout, type SidebarSlot } from './viewModel';

/**
 * The keyboard half of the drag handle.
 *
 * WCAG 2.5.7 asks that anything done by dragging can be done without it, and
 * these are the keys that do it. The pointer half is measured in the browser,
 * in tests/e2e/resize.spec.ts, because jsdom does no layout and a drag over a
 * page with no widths would prove nothing.
 */
const bothOpen: Layout = withCollapsed(defaultLayout, 'secondary-sidebar', false);

type Options = {
  /** The window to draw in. 1920 has room for anything the design asks for. */
  width?: number;
  /**
   * Hand the provider no layout at all, so it restores from `localStorage`
   * the way a reload does. Every other case says what it wants to see, which
   * is what `initialLayout` is for.
   */
  restore?: boolean;
};

function draw(slot: SidebarSlot, { width = 1920, restore = false }: Options = {}) {
  setViewportWidth(width);
  render(
    <LayoutProvider initialLayout={restore ? undefined : bothOpen}>
      <PanelSeparator slot={slot} />
    </LayoutProvider>,
  );
}

function open(slot: SidebarSlot, options: Options = {}) {
  draw(slot, options);
  return screen.getByRole('separator');
}

const width = (separator: HTMLElement) => Number(separator.getAttribute('aria-valuenow'));

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('the separator as a control', () => {
  it('is named after the views in the panel it resizes, in Norwegian', () => {
    // Not «navigasjonspanelet»: a slot's accessible name comes from what sits
    // in it, so a view moved to the other sidebar takes its name along. Same
    // rule the collapse button follows — «Skjul tråder og filter».
    expect(open('primary-sidebar').getAttribute('aria-label')).toBe(
      'Endre bredde på tråder og filter',
    );
    document.body.innerHTML = '';
    expect(open('secondary-sidebar').getAttribute('aria-label')).toBe('Endre bredde på kilder');
  });

  it('reports where it is and how far it can go, in pixels', () => {
    const separator = open('primary-sidebar');

    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(width(separator)).toBe(400);
    expect(separator.getAttribute('aria-valuemin')).toBe('400');
    // 1920 − 432 (sources) − 32 − 32 (two gaps) − 640 (the answer column's
    // floor). The window is the ceiling; the panel has none of its own.
    expect(separator.getAttribute('aria-valuemax')).toBe('784');
  });

  it('says what the number is, since a separator carries no unit', () => {
    // Without `aria-valuetext` a screen reader reads «400» and the reader has
    // to guess at what. KA CC, reviewing PR #50.
    const separator = open('primary-sidebar');
    expect(separator.getAttribute('aria-valuetext')).toBe('400 piksler');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator.getAttribute('aria-valuetext')).toBe('416 piksler');
  });

  it('is a tab stop, and is only there while there is something to do', () => {
    // No `aria-disabled` state to be in: a separator that cannot move is not
    // rendered at all, so the one on screen always works. See the last
    // describe in this file.
    const separator = open('primary-sidebar');
    expect(separator.getAttribute('tabindex')).toBe('0');
    expect(separator.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('the arrow keys', () => {
  it('moves the edge 16 px, and 64 with Shift held', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(480);

    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(width(separator)).toBe(400);
  });

  it('moves the edge the way the key points, so the panel after the answer column narrows', () => {
    // The key is about the edge and not about the panel: pressing the key
    // that points at the inline end moves the edge that way, whichever panel
    // is on the other side of it. Anything else has the edge walking against
    // the finger.
    const separator = open('secondary-sidebar');
    expect(width(separator)).toBe(432);

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(width(separator)).toBe(432);
  });

  it('stops at the bounds instead of running past them', () => {
    const separator = open('primary-sidebar');

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    }
    expect(width(separator)).toBe(784);

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
    }
    expect(width(separator)).toBe(400);
  });

  it('keeps the page still: the browser must not scroll on an arrow key here', () => {
    const separator = open('primary-sidebar');
    const handled = fireEvent.keyDown(separator, { key: 'ArrowRight' });

    // fireEvent returns false when a handler called preventDefault.
    expect(handled).toBe(false);
  });

  it('leaves keys it has no business with alone', () => {
    const separator = open('primary-sidebar');
    expect(fireEvent.keyDown(separator, { key: 'Tab' })).toBe(true);
    expect(width(separator)).toBe(400);
  });
});

describe('Home, End and Enter', () => {
  it('goes to the narrowest and the widest the panel may be', () => {
    // About the VALUE and not about the screen, which is the reading a person
    // who cannot see the edge can act on: Home is the smallest number the
    // separator reports, wherever on the row the panel sits.
    const separator = open('secondary-sidebar');

    fireEvent.keyDown(separator, { key: 'End' });
    expect(width(separator)).toBe(Number(separator.getAttribute('aria-valuemax')));

    fireEvent.keyDown(separator, { key: 'Home' });
    expect(width(separator)).toBe(336);
  });

  it('puts the edge back where the design draws it', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(464);

    fireEvent.keyDown(separator, { key: 'Enter' });
    expect(width(separator)).toBe(400);
  });

  it('forgets a width that is back at the default', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').widths).toEqual({
      'primary-sidebar': 416,
    });

    fireEvent.keyDown(separator, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').widths).toEqual({});
  });
});

describe('a window with no room in it', () => {
  it('draws no separator at all, because there is no edge to move', () => {
    // 1440 is the three slots at their floors exactly: 400 + 32 + 640 + 32 +
    // 336 is the window. Floor, ceiling and the width on screen are one
    // number, so every key and every drag here does nothing.
    //
    // PR #50 left it drawn, out of the tab order and `aria-disabled`, on the
    // argument that the line is the edge. The line is not this element — the
    // panel's own border draws it, and `.panel-separator::before` only lights
    // up under the pointer, under focus and while dragging. What goes is the
    // grip and the `col-resize` cursor, which promised a drag this window
    // cannot deliver. Brukerblikk 3, funn 2; Lars 17.09.
    draw('primary-sidebar', { width: 1440 });
    expect(screen.queryByRole('separator')).toBeNull();

    // The width arithmetic itself is unchanged and measured in resize.test.ts:
    // `widthRange` still answers { min: 400, max: 400 } here. What changed is
    // only what is drawn for it.
    expect(widthRange(bothOpen, 'primary-sidebar', 1440)).toEqual({ min: 400, max: 400 });
  });

  it('draws none for the panel after the answer column either', () => {
    draw('secondary-sidebar', { width: 1440 });
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('draws it again when the window grows, reporting the width on screen', () => {
    draw('primary-sidebar', { width: 1440 });
    expect(screen.queryByRole('separator')).toBeNull();

    act(() => setViewportWidth(1920));

    const separator = screen.getByRole('separator');
    expect(width(separator)).toBe(400);
    expect(separator.getAttribute('aria-valuemax')).toBe('784');
    expect(separator.getAttribute('tabindex')).toBe('0');
  });

  it('reports the width on screen, not the one the reader asked for elsewhere', () => {
    // Widened with the sources panel on its rail, then met with it open.
    // `aria-valuenow` is the only thing that tells a screen reader user where
    // the edge is; a value that says 1181 over a panel drawn at 784 is a lie
    // told to the one reader who cannot see the difference.
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        collapsed: { 'secondary-sidebar': false },
        widths: { 'primary-sidebar': 1181 },
        sourcesDismissed: false,
      }),
    );

    // 1181 + 32 + 640 + 32 + 432 is 2317 and the window is 1920. The widening
    // gives the 397 back and the sources panel keeps its 432, so the panel is
    // drawn at 784, which is also where End stops. See `fittedWidths`.
    const separator = open('primary-sidebar', { restore: true, width: 1920 });
    expect(width(separator)).toBe(784);
    expect(separator.getAttribute('aria-valuemax')).toBe('784');
  });
});

/**
 * The pointer on the edge. Simens issue 80: a panel dragged too narrow to
 * read folds away. Simens issue 81: a click is the path without a drag.
 *
 * jsdom does no layout, so what is measured here is the arithmetic on
 * `clientX` and what the drag leaves in the layout, not the pixels on
 * screen. It has pointer events but no pointer capture, so the capture is
 * stubbed for the length of these tests.
 */
describe('the pointer on the edge', () => {
  const capture = {
    setPointerCapture: HTMLElement.prototype.setPointerCapture,
    hasPointerCapture: HTMLElement.prototype.hasPointerCapture,
    releasePointerCapture: HTMLElement.prototype.releasePointerCapture,
  };

  beforeEach(() => {
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.releasePointerCapture = () => {};
  });

  afterEach(() => {
    Object.assign(HTMLElement.prototype, capture);
  });

  function Probe({ slot }: { slot: SidebarSlot }) {
    const { layout } = useLayout();
    const state = layout.slots[slot];
    return (
      <output data-testid="slot">
        {state.collapsed ? 'lukket' : 'åpen'}{' '}
        {state.sizing.mode === 'sized' ? state.sizing.width : ''}
      </output>
    );
  }

  function drawWithProbe(slot: SidebarSlot) {
    setViewportWidth(1920);
    render(
      <LayoutProvider initialLayout={bothOpen}>
        <PanelSeparator slot={slot} />
        <Probe slot={slot} />
      </LayoutProvider>,
    );
    return screen.getByRole('separator');
  }

  const slotState = () => screen.getByTestId('slot').textContent;

  it('folds the navigation panel away instead of stopping at the floor', () => {
    // 400 er gulvet. Pekeren går 211 px forbi det, altså under halve gulvet.
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });

    expect(slotState()).toBe('lukket 400');
  });

  it('stops at the floor when the drag only overshoots it', () => {
    // 150 px forbi gulvet er ikke forbi midten: panelet blir stående på 400.
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 250, pointerId: 1 });

    expect(slotState()).toBe('åpen 400');
  });

  it('opens again at the width it had before the drag, not at the floor', () => {
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(464);

    // På vei ned presses kanten mot gulvet og skrives som 400, før panelet
    // lukkes. Bredden skal likevel være 464 når det åpnes igjen.
    fireEvent.pointerDown(separator, { button: 0, clientX: 464, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 300, pointerId: 1 });
    expect(slotState()).toBe('åpen 400');
    fireEvent.pointerMove(separator, { clientX: 150, pointerId: 1 });

    expect(slotState()).toBe('lukket 464');
  });

  it('folds the sources panel when it is dragged the other way', () => {
    // Kildepanelet står etter hovedkolonnen og blir smalere når pekeren går
    // mot slutten av linja. 432 er standard, 336 gulvet og 168 halve gulvet:
    // 432 − 265 = 167.
    const separator = drawWithProbe('secondary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 1488, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 1753, pointerId: 1 });

    expect(slotState()).toBe('lukket 432');
  });

  /*
   * Simens issue 80, round 2: the drag goes on after the fold, and dragging
   * back opens the panel before the pointer is let go. The line is the same
   * both ways, half the floor, and the panel opens 16 px back past it.
   */
  it('åpner navigasjonspanelet igjen når pekeren kommer 16 px tilbake forbi linja', () => {
    // Half the floor is 200, and 200 + 16 = 216.
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });
    expect(slotState()).toBe('lukket 400');

    fireEvent.pointerMove(separator, { clientX: 215, pointerId: 1 });
    expect(slotState()).toBe('lukket 400');

    fireEvent.pointerMove(separator, { clientX: 216, pointerId: 1 });
    expect(slotState()).toBe('åpen 400');

    // And the edge follows the pointer from there, in the same drag.
    fireEvent.pointerMove(separator, { clientX: 450, pointerId: 1 });
    expect(slotState()).toBe('åpen 450');
  });

  it('åpner kildepanelet igjen på samme måte, den andre veien', () => {
    // Half the floor is 168, and 168 + 16 = 184: 432 − (1736 − 1488) = 184.
    const separator = drawWithProbe('secondary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 1488, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 1753, pointerId: 1 });
    expect(slotState()).toBe('lukket 432');

    fireEvent.pointerMove(separator, { clientX: 1737, pointerId: 1 });
    expect(slotState()).toBe('lukket 432');

    fireEvent.pointerMove(separator, { clientX: 1736, pointerId: 1 });
    expect(slotState()).toBe('åpen 336');
  });

  it('lukker og åpner så mange ganger pekeren krysser linja, og slipper lukket med bredden fra starten', () => {
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(464);

    fireEvent.pointerDown(separator, { button: 0, clientX: 464, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 150, pointerId: 1 });
    expect(slotState()).toBe('lukket 464');

    fireEvent.pointerMove(separator, { clientX: 300, pointerId: 1 });
    expect(slotState()).toBe('åpen 400');

    fireEvent.pointerMove(separator, { clientX: 150, pointerId: 1 });
    expect(slotState()).toBe('lukket 464');

    fireEvent.pointerUp(separator, { clientX: 150, pointerId: 1 });
    fireEvent.click(separator);
    expect(slotState()).toBe('lukket 464');
  });

  it('sier «Skjult» mens panelet er lukket midt i en draging, og holder verdien innenfor grensene', () => {
    const separator = drawWithProbe('primary-sidebar');
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });

    expect(separator.getAttribute('aria-valuetext')).toBe('Skjult');
    expect(width(separator)).toBe(400);
    expect(separator.getAttribute('aria-valuemin')).toBe('400');
    // The room the panel has OPEN: 1920 − 432 − 32 − 32 − 640. Read off the
    // folded layout it would be 816, with no gap beside this slot.
    expect(separator.getAttribute('aria-valuemax')).toBe('784');
  });

  /*
   * Simens issue 81 took the arrow buttons out of the panel head, and they
   * were the pointer path without a drag that WCAG 2.5.7 asks for. A click on
   * the edge is that path now: it goes between the design's width and the
   * widest the window has room for (the conductor's option A, 30.09).
   */
  it('klikk uten å dra gjør panelet så bredt det får plass til, og neste klikk tilbake', () => {
    // 1920 has room for 784 with the sources panel open beside it.
    const separator = drawWithProbe('primary-sidebar');

    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientX: 400, pointerId: 1 });
    fireEvent.click(separator);
    expect(slotState()).toBe('åpen 784');

    fireEvent.pointerDown(separator, { button: 0, clientX: 784, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientX: 784, pointerId: 1 });
    fireEvent.click(separator);
    expect(slotState()).toBe('åpen 400');
  });

  it('regner et klikk med litt skjelving som et klikk', () => {
    const separator = drawWithProbe('primary-sidebar');

    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 403, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientX: 403, pointerId: 1 });
    fireEvent.click(separator);

    expect(slotState()).toBe('åpen 784');
  });

  it('lar en draging være en draging, også når den ender i et klikk', () => {
    // Nettleseren sender `click` etter en draging på elementet som har
    // pekeren. Den skal ikke hoppe til taket etter at leseren har valgt 440.
    const separator = drawWithProbe('primary-sidebar');

    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 440, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientX: 440, pointerId: 1 });
    fireEvent.click(separator);

    expect(slotState()).toBe('åpen 440');
  });

  it('har ikke lenger dobbeltklikk: to klikk er fram og tilbake', () => {
    const separator = drawWithProbe('primary-sidebar');

    fireEvent.click(separator);
    fireEvent.click(separator);
    fireEvent.doubleClick(separator);

    expect(slotState()).toBe('åpen 400');
  });
});
