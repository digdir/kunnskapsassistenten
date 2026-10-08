import { apiMode } from './apiMode';

// Vite bakes `import.meta.env` into the bundle, but the dataset must be the
// deployment's choice, so the server also writes `window.__KA_CONFIG__`
// (server/config.ts). The mode stays build-only (apiMode.ts).

declare global {
  interface Window {
    /** Written by the server. Absent in development and in tests. */
    __KA_CONFIG__?: Partial<ImportMetaEnv>;
  }
}

/**
 * The merged environment; runtime wins, as the container's later word. Guarded
 * because plain Node, where Playwright loads specs, has no `import.meta.env` or `window`.
 */
export function kaEnv(): Partial<ImportMetaEnv> {
  const built: Partial<ImportMetaEnv> = import.meta.env ?? {};
  const runtime = typeof window === 'undefined' ? undefined : window.__KA_CONFIG__;
  return { ...built, ...runtime, VITE_API_MODE: apiMode() };
}
