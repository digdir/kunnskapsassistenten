/** Repeats `window.dsWarnings` from @digdir/designsystemet-web, an indirect dependency. */
declare global {
  interface Window {
    dsWarnings?: boolean;
  }
}

export {};
