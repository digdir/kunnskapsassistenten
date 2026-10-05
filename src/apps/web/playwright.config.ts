import { defineConfig, devices } from '@playwright/test';
import { ARTIFACTS, BASE_URL, PORT, RUN_ARTIFACTS, TEST_TIMEOUT } from './tests/e2e/paths';

/**
 * End-to-end tests for kunnskapsassistenten-frontend.
 *
 * They run against `vite preview`, not the dev server: the built app is what
 * a user gets, and a bug that only exists after minification or after the
 * production `import.meta.env` substitution would otherwise never be caught.
 * `npm run build` is part of the server command for the same reason.
 *
 * `VITE_API_MODE=mock` is set on the whole command rather than only on the
 * preview, because Vite substitutes that variable at BUILD time. Setting it
 * on the preview alone would build a default bundle and change nothing.
 *
 * Artifacts — traces, the HTML report, failure screenshots — are written
 * outside the repository, to ~/.cache/ka-review/e2e/. Prettier reads
 * .prettierignore and not .gitignore, and .prettierignore belongs to the
 * foundation, so anything this suite writes inside the tree would break
 * `npm run format:check` for everyone. The deliberate screenshots are a
 * different matter and go to design/skjermbilder-frontend/e2e/, which the
 * build rules ask for and which is not a git repository.
 *
 * Chromium only, and that is a choice worth knowing about: this suite tests
 * the product, not browser compatibility. `field-sizing: content` in the
 * compose field is one known place where Firefox behaves differently, and it
 * is documented where it is used rather than tested here.
 */
const config = defineConfig({
  testDir: './tests/e2e',
  // Per run, not per suite: see RUN_ARTIFACTS in tests/e2e/paths.ts for
  // what a shared one costs.
  outputDir: RUN_ARTIFACTS,
  fullyParallel: true,
  /*
   * Fire arbeidere lokalt, ikke halve maskinen.
   *
   * Playwright tar som standard halvparten av kjernene, altså åtte her — per
   * suite. Fem agenter deler maskinen, og målt 15.09: én e2e-suite tok
   * chromium-prosessene fra 9 til 17 og lasten fra 24,6 til 31,0, mens
   * `npm test` samtidig startet 17 vitest-prosesser. Suitene ble ikke
   * raskere av det; de ble røde. Fem samtidige suiter ga 24 falske røde i
   * strømme-testene ved load 17, og enkelttester som er grønne alene har
   * falt på tastetrykk sendt før appen rakk å tegne.
   *
   * `GITHUB_ACTIONS` og ikke `CI` er skillet, fordi `CI=true` er det vi selv
   * setter lokalt (se regler.md): en `ubuntu-latest`-kjører har fire kjerner,
   * der Playwright selv velger to, og fire ville vært en oppjustering av noe
   * som ikke er problemet vårt. CI beholder sin egen standard.
   */
  workers: process.env.GITHUB_ACTIONS ? undefined : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Playwright's own 30 s, unless KA_E2E_ANSWER_TIMEOUT raised the answer budget.
  ...(TEST_TIMEOUT ? { timeout: TEST_TIMEOUT } : {}),
  reporter: [['list'], ['html', { outputFolder: `${ARTIFACTS}/report`, open: 'never' }]],

  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}`,
    locale: 'nb-NO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /*
   * The viewport belongs HERE and not in the `use` above, and that is the
   * whole point of this block.
   *
   * `devices['Desktop Chrome']` carries a viewport of its own — 1280 × 720 —
   * and a project's `use` is merged over the top-level one. So a
   * `viewport: { width: 1440, height: 900 }` written above the spread was
   * silently replaced, and the suite ran at 1280 × 720 for four days while
   * every comment in it, and `docs/review/funksjonssjekk.md`, said 1440 × 900.
   * Found by #2 in PR #55 and measured here with a throwaway spec that
   * printed `window.innerWidth`.
   *
   * 1440 is the width the page template is drawn at, and 900 the height the
   * design frames use; every measurement in design/omraader/ assumes both.
   * The specs that test the layout itself — `layout.spec.ts`, `resize.spec.ts`
   * — set their own viewport per test and were never affected.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never reuse. A preview server already on the port belongs to somebody
    // else — another run of this suite, or a worker's own server — and
    // attaching to it is how a run ends up serving a `dist` it did not build
    // (funksjonssjekk.md, «Et bygg som ikke er ferdig, lyver») or losing the
    // server mid-suite when its owner finishes. With `false` and
    // `--strictPort` a collision fails here, loudly, with the port in the
    // message, instead of turning into a scatter of failed tests further in.
    //
    // `KA_E2E_PORT` is how two runs coexist; see tests/e2e/paths.ts.
    reuseExistingServer: false,
    timeout: 180_000,
    // `VITE_MOCK_SPEED=fast` for the same reason `VITE_API_MODE` is here:
    // Vite substitutes both at BUILD time, so they have to be on the command
    // that builds. The mock's own default is `realistic`, which is what makes
    // the skeleton, the thinking panel and the streaming visible to a person
    // — and what would make this suite sit and wait out every answer.
    env: { VITE_API_MODE: 'mock', VITE_MOCK_SPEED: 'fast' },
  },
});

// No server of our own when KA_E2E_BASE_URL points at one that is already
// running, such as the pod behind the BFF (tests/e2e/paths.ts).
if (BASE_URL) delete config.webServer;

export default config;
