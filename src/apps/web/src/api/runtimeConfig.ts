/**
 * The environment, whether it was baked in at build time or handed over at
 * runtime.
 *
 * `import.meta.env` is Vite's, and Vite substitutes it during `vite build` —
 * so a built bundle has its mode and its corpus frozen into it. That is right
 * for a developer running `npm run dev` and wrong for a container: one image
 * has to be able to run as the mock demo and against the real backend, and
 * the dataset it asks has to be a deployment's decision rather than a
 * rebuild.
 *
 * So the server writes `window.__KA_CONFIG__` into a small script the page
 * loads before the bundle (see server/config.ts), and this is the one place
 * that knows both sources exist. Everything else reads `kaEnv()` and cannot
 * tell which one answered.
 *
 * Runtime wins where both have a value, because runtime is the later and more
 * specific statement: the image was built with some default, and the
 * container was started with an intention.
 */

declare global {
  interface Window {
    /** Written by the server. Absent in development and in tests. */
    __KA_CONFIG__?: Partial<ImportMetaEnv>;
  }
}

/**
 * Read with `?.` twice over, because this module is evaluated outside a
 * browser and outside Vite as well.
 *
 * `import.meta.env` is undefined in plain Node, which is where Playwright
 * loads spec files that import `src/api/mock` — the whole suite died on
 * `Cannot read properties of undefined` before a single test ran once the
 * mock client began reading the corpus store. `window` is undefined in the
 * same place. No environment means no configuration, which is mock mode:
 * the same answer the app gives a developer who has set nothing.
 */
export function kaEnv(): Partial<ImportMetaEnv> {
  const built: Partial<ImportMetaEnv> = import.meta.env ?? {};
  const runtime = typeof window === 'undefined' ? undefined : window.__KA_CONFIG__;
  return runtime ? { ...built, ...runtime } : built;
}
