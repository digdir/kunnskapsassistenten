export type ApiMode = 'mock' | 'live' | 'bff';

/**
 * Which backend the app talks to: `VITE_API_MODE` as the app was built, and
 * nothing set at runtime.
 *
 * At build time so the bundler knows which clients a build uses and can
 * leave the others out (see `createChatClient` in ./index.ts). Read at
 * runtime, every client was in every bundle, the mock corpus included.
 *
 * Unset, a production build talks to the BFF, which is where this client is
 * served from, and never answers from the mock without saying so. `npm run
 * dev` and the tests use the mock, which needs nothing running. Every other
 * build names its mode: the e2e suite builds `mock` (playwright.config.ts),
 * and the test environment's image `live` (Dockerfile).
 *
 * `?.` because this is also evaluated in plain Node, where `import.meta.env`
 * is undefined (see runtimeConfig.ts).
 */
export function apiMode(): ApiMode {
  const env = import.meta.env;
  return env?.VITE_API_MODE ?? (env?.PROD ? 'bff' : 'mock');
}
