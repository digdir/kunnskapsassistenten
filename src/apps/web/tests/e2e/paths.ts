import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the suite runs and where it writes.
 *
 * The port is 4173, `vite preview`'s own default. It deliberately sits
 * outside the 5173–5177 band the build rules hand out to the workers, so
 * running the tests never collides with somebody's dev server.
 *
 * `KA_E2E_PORT` moves it, and there is one situation that needs it: **two
 * runs of this suite must never share a port.** `reuseExistingServer` lets
 * the second run attach to the first one's preview server, and when the first
 * run finishes it takes the server down under the second — which then reports
 * every remaining test as failed with `ERR_CONNECTION_REFUSED`. Measured
 * 2026-09-15: 49 of 58 «failures» in the run that started second, none of
 * them the product.
 *
 * So: one run per port at a time. Running the suite from two worktrees on
 * this machine at once means `KA_E2E_PORT=4174 npx playwright test` in the
 * second one.
 */
export const PORT = Number(process.env.KA_E2E_PORT ?? 4173);

/**
 * A server that is already running, to test instead of the mock build — the
 * pod behind the BFF, for instance (`http://localhost:8791`). Unset, the
 * suite builds the app in mock mode and serves it itself on `PORT`.
 *
 * Against a real backend most of the suite does not apply: the tests tagged
 * `@mock` open fixture threads, ask the mock's `simuler …` questions or count
 * the mock's values. Run the rest with `--grep-invert @mock`, and the ones
 * that need a real answer with `--grep @ekte-svar --workers 1`, since every
 * test shares one identity when the BFF runs with `AUTH_MODE=off`.
 */
export const BASE_URL = process.env.KA_E2E_BASE_URL?.trim() || undefined;

/**
 * How long a test waits for a finished answer, in milliseconds.
 *
 * 30 seconds is plenty for the mock, whose whole answer takes about 7.5 s of
 * wall clock. A real model often takes longer — 66 s for one answer on
 * 29.09 — so `KA_E2E_ANSWER_TIMEOUT` sets it in seconds for a run against a
 * real backend. The waits poll, so a generous budget costs nothing when the
 * answer is quick.
 */
function answerTimeout(setting: string | undefined): number {
  if (!setting?.trim()) return 30_000;
  const seconds = Number(setting);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`KA_E2E_ANSWER_TIMEOUT må være et antall sekunder, ikke «${setting}».`);
  }
  return seconds * 1000;
}

export const ANSWER_TIMEOUT = answerTimeout(process.env.KA_E2E_ANSWER_TIMEOUT);

/**
 * How long one test may take in all. Playwright's own 30 seconds, unless the
 * answer budget has been raised: then room for four answers, since the
 * longest tests ask, reload and ask again. Without this, a raised answer
 * budget would only move the failure from the wait to the test's own
 * timeout.
 */
export const TEST_TIMEOUT = process.env.KA_E2E_ANSWER_TIMEOUT?.trim()
  ? ANSWER_TIMEOUT * 4
  : undefined;

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root: two levels up from tests/e2e/. */
export const REPO = resolve(here, '..', '..');

/**
 * Traces, the report and failure screenshots. Outside the repository on
 * purpose — see the note in playwright.config.ts.
 */
export const ARTIFACTS = join(
  process.env.HOME ?? process.env.USERPROFILE ?? '/tmp',
  '.cache',
  'ka-review',
  'e2e',
);

/**
 * Traces and failure screenshots, in a directory belonging to this run alone.
 *
 * It has to be per-run, and that is a bug fix rather than tidiness. Playwright
 * empties `outputDir` when a run starts and writes a trace for every test
 * while it runs (`retain-on-failure` records them all and throws the passing
 * ones away). Two runs sharing the directory means the second one deletes
 * files the first is still writing, and the first then fails in
 * `browserContext.close` with `ENOENT` on a `.trace` file.
 *
 * Playwright reports that as a failed test. It is not: the test body has
 * already passed and the teardown is what threw. Measured 2026-09-15 with
 * overlapping runs on this machine — 13 of 58 «failures», every one of them a
 * trace file and not a single product assertion, and a different 13 each time.
 * A suite that reports red for reasons in its own plumbing is worse than no
 * suite, because the first thing it costs is the reviewer's trust in it.
 *
 * The HTML report stays at a fixed path, because it is written once at the
 * end and is meant to be found again.
 */
export const RUN_ARTIFACTS = join(ARTIFACTS, 'runs', `${process.pid}-${Date.now().toString(36)}`);

/**
 * Drop run directories older than a day, so the cache does not grow forever.
 * Best effort: a run that cannot clean up is not a run that should fail.
 */
function pruneOldRuns(): void {
  const runs = join(ARTIFACTS, 'runs');
  if (!existsSync(runs)) return;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  try {
    for (const entry of readdirSync(runs)) {
      const path = join(runs, entry);
      if (statSync(path).mtimeMs < dayAgo) rmSync(path, { recursive: true, force: true });
    }
  } catch {
    // Another run may be pruning the same directory. Nothing here is worth
    // failing a test suite over.
  }
}

pruneOldRuns();

/**
 * The umbrella folder that holds `design/`, found by walking up until
 * `design/INDEX.md` turns up. It is not a git repository and it is not
 * inside this one, so it cannot be reached by a fixed relative path from
 * every checkout: the main checkout and each worktree sit at different
 * depths. `docs/review/tools/a11y.sh` finds it the same way.
 *
 * Returns undefined when the design folder is not there, which is what a
 * clone without the umbrella looks like. Only asked when a run wants the
 * reference images (`screenshotFolder` below).
 */
function findDesignFolder(): string | undefined {
  let candidate = REPO;

  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(candidate, 'design', 'INDEX.md'))) {
      return join(candidate, 'design');
    }
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  return undefined;
}

/**
 * Where the deliberate screenshots go, and whether they are written at all.
 *
 * `KA_E2E_SCREENSHOTS` decides, and without it nothing is written:
 *
 * - `design`: the reference images the build rules ask for,
 *   `design/skjermbilder-frontend/e2e/<view>-<modus>.png`, always the same
 *   names, so they can be compared against the Figma images in the
 *   `skjermbilder` folders under `design/omraader/`. A run that
 *   asks for this and finds no `design/INDEX.md` stops, rather than quietly
 *   writing nothing.
 * - an absolute path: that folder, for a run whose pictures are not the
 *   reference, such as a branch or the pod.
 *
 * Opt-in since 2026-09-29. The suite used to look for `design/INDEX.md` by
 * itself, so any checkout under the umbrella wrote into the real `design/`:
 * a worker's worktree on its branch, or a clone of the monorepo under
 * `monorepo-proeve/`, overwrote the reference images with whatever it
 * rendered. #5 had to run the suite from a copy outside the umbrella to
 * avoid it.
 */
function screenshotFolder(setting: string | undefined): string | undefined {
  if (!setting) return undefined;

  if (setting === 'design') {
    const designFolder = findDesignFolder();
    if (!designFolder) {
      throw new Error(
        `KA_E2E_SCREENSHOTS=design, men fant ikke design/INDEX.md oppover fra ${REPO}.`,
      );
    }
    return join(designFolder, 'skjermbilder-frontend', 'e2e');
  }

  if (isAbsolute(setting)) return setting;

  throw new Error(`KA_E2E_SCREENSHOTS må være «design» eller en absolutt sti, ikke «${setting}».`);
}

export const SCREENSHOTS = screenshotFolder(process.env.KA_E2E_SCREENSHOTS?.trim());
