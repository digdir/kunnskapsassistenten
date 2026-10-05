import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetViewport } from './matchMedia';

/**
 * Test environment fixes for jsdom.
 *
 * Designsystemet loads @oddbird/popover-polyfill, which reads CSS.escape at
 * import time. jsdom has no CSS object, so importing any Designsystemet
 * component throws before a test runs. The escape below is the spec algorithm
 * reduced to what a polyfill needs: it is never rendered, only used to build
 * selectors.
 */
if (typeof globalThis.CSS === 'undefined') {
  globalThis.CSS = {
    escape: (value: string) => value.replace(/[^a-zA-Z0-9_ -￿-]/g, '\\$&'),
  } as unknown as typeof globalThis.CSS;
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = (value: string) => value.replace(/[^a-zA-Z0-9_ -￿-]/g, '\\$&');
}

/**
 * jsdom runs no animations and has no Web Animations API, so
 * `document.getAnimations` is missing. Designsystemet's `Skeleton` calls it on
 * mount to line its shimmer up with the others, and throws before a test that
 * renders a loading state reaches its first assertion.
 *
 * An empty list is the truthful answer here: nothing IS animating.
 */
if (typeof document.getAnimations !== 'function') {
  document.getAnimations = () => [];
}

/**
 * jsdom implements no part of `<dialog>` beyond the element: `showModal`,
 * `show` and `close` are all missing, and the drawer below 1139 is a
 * Designsystemet `Dialog` — so any test that renders the shell in a narrow
 * window throws on the first open.
 *
 * What this shim gives is the `open` attribute and the `close` event, which is
 * what React and Designsystemet drive the component with. What it deliberately
 * does NOT give is the thing a modal dialog is FOR: the top layer, the focus
 * trap, the inert background, and Escape. jsdom has no layout and no top
 * layer, so a shim could only pretend, and a unit test that passed on the
 * pretence would be worse than no test — it would report a focus trap that
 * the browser, not us, is supposed to provide.
 *
 * Those four are measured in a real browser instead, in
 * tests/e2e/drawers.spec.ts. Here the shim only keeps the component mountable
 * so the state around it can be measured at all.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  // `show` and `showModal` are the same two lines here, and that is the point:
  // the difference between them is the top layer, which jsdom does not have.
  function open(this: HTMLDialogElement) {
    if (!this.open) this.setAttribute('open', '');
  }

  HTMLDialogElement.prototype.showModal = open;
  HTMLDialogElement.prototype.show = open;
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (!this.open) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/**
 * Testing Library normally registers its own afterEach, but only when vitest
 * runs with globals. This project imports describe/it/expect explicitly, so
 * the cleanup is registered here instead — without it the DOM from one test
 * is still there in the next.
 */
afterEach(cleanup);

/**
 * jsdom has no matchMedia at all, so importing this installs one. See
 * matchMedia.ts: without it any component that asks about the viewport — the
 * layout, SourcesView and its reduced-motion check — throws before a test
 * reaches its first assertion.
 */
afterEach(resetViewport);

/**
 * Storage is shared by every test in a file, and the app now writes to it:
 * the layout remembers collapsed panels and the filter in `localStorage`, and
 * the mock remembers threads in `sessionStorage`. Without this, one test
 * collapsing a panel decides what the next test opens on, and the failure
 * shows up in whichever test happens to run second.
 */
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
