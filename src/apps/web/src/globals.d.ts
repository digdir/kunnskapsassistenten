/**
 * Designsystemet lets you silence its own console warnings in production by
 * setting window.dsWarnings = false. The declaration lives in
 * @digdir/designsystemet-web, but that package is an indirect dependency, so
 * we repeat it here to be sure it is in scope.
 * See packages/web/src/utils/utils.ts in Designsystemet.
 */
declare global {
  interface Window {
    dsWarnings?: boolean;
  }
}

export {};
