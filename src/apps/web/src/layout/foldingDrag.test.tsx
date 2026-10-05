import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * A drag that folds a panel goes on until the pointer is let go (Simens issue
 * 80, round 2). PanelSeparator.test.tsx measures the arithmetic; this is the
 * slot's half: the separator has to outlive the fold, because a rail draws
 * none, and the focus has to land somewhere when it finally goes.
 *
 * jsdom has pointer events but no pointer capture, so the capture is stubbed.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const capture = {
  setPointerCapture: HTMLElement.prototype.setPointerCapture,
  hasPointerCapture: HTMLElement.prototype.hasPointerCapture,
  releasePointerCapture: HTMLElement.prototype.releasePointerCapture,
};

beforeEach(() => {
  localStorage.clear();
  resetViewport();
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
});

afterEach(() => {
  Object.assign(HTMLElement.prototype, capture);
});

function drawShell() {
  // 1920, with the navigation panel open and the sources panel on its rail,
  // which is how the app starts.
  setViewportWidth(1920);
  render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Shell routeOwnsMain />
      </LayoutProvider>
    </MemoryRouter>,
  );
  return screen.getByRole('separator', { name: 'Endre bredde på tråder og filter' });
}

const navigation = () => document.querySelector('.primary-sidebar');

describe('en draging som lukker panelet', () => {
  it('beholder skillet og fokuset over skinnen mens pekeren holdes nede', () => {
    const separator = drawShell();
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });

    expect(navigation()?.hasAttribute('data-collapsed')).toBe(true);
    expect(separator.isConnected).toBe(true);
    expect(document.activeElement).toBe(separator);
  });

  it('åpner panelet igjen med det samme skillet når pekeren dras tilbake', () => {
    const separator = drawShell();
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 216, pointerId: 1 });

    expect(navigation()?.hasAttribute('data-collapsed')).toBe(false);
    expect(screen.getByRole('separator', { name: 'Endre bredde på tråder og filter' })).toBe(
      separator,
    );

    // Let go open, and it stays: the separator of an open panel.
    fireEvent.pointerUp(separator, { clientX: 216, pointerId: 1 });
    expect(separator.isConnected).toBe(true);
    expect(document.activeElement).toBe(separator);
  });

  it('tar skillet bort når pekeren slippes over skinnen, og sender fokuset til knappen', () => {
    const separator = drawShell();
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });
    fireEvent.pointerUp(separator, { clientX: 189, pointerId: 1 });

    expect(separator.isConnected).toBe(false);
    expect(screen.queryByRole('separator', { name: 'Endre bredde på tråder og filter' })).toBe(
      null,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Vis tråder og filter' }),
    );
  });

  it('glemmer dragingen når vinduet går over i skuffemodus, så det ikke står igjen et skille på skinnen', () => {
    // The separator goes when the window crosses into drawer mode, and it
    // never hears the pointer being let go. Back at 1920, the rail must not
    // have one.
    const separator = drawShell();
    fireEvent.pointerDown(separator, { button: 0, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(separator, { clientX: 189, pointerId: 1 });

    act(() => setViewportWidth(1000));
    act(() => setViewportWidth(1920));

    expect(navigation()?.hasAttribute('data-collapsed')).toBe(true);
    expect(screen.queryByRole('separator', { name: 'Endre bredde på tråder og filter' })).toBe(
      null,
    );
  });
});
