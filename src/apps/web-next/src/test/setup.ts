// What jsdom lacks and the blocks use. Written for this client, not imported from apps/web.

// Designsystemet loads @oddbird/popover-polyfill, which reads CSS.escape when it is imported.
const cssEscape = (value: string) => value.replace(/[^a-zA-Z0-9_ -￿-]/g, '\\$&');
if (typeof globalThis.CSS === 'undefined') {
  (globalThis as { CSS?: unknown }).CSS = { escape: cssEscape, supports: () => false };
} else if (typeof globalThis.CSS.escape !== 'function') {
  globalThis.CSS.escape = cssEscape;
}

// The shell asks the viewport's width; a wide screen unless a test says otherwise.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom has the element, not its methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};
Element.prototype.scrollIntoView ??= () => {};
// Designsystemet's spinner and skeleton keep their animations in step through this.
if (typeof document.getAnimations !== 'function') document.getAnimations = () => [];
