import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SCREENSHOTS } from './paths';

/**
 * The rule sets every state is checked against.
 *
 * WCAG 2.0, 2.1 and 2.2 at level AA, which is what «WCAG 2.x AA er krav»
 * means. Best-practice rules are deliberately left out: they are advice, not
 * the requirement, and a suite that fails on advice gets switched off.
 *
 * It said `wcag2a` and `wcag2aa` only until #142, and that is two versions
 * short. `docs/review/tools/a11y.sh` has run 2.1 and 2.2 since it was
 * written, so the two measurements of the same requirement disagreed without
 * anyone comparing them — which is how a `target-size` violation stood on
 * every route while 149 e2e tests were green (KA CC on #142, found by #2).
 *
 * Measured on `main` the day it was widened: 29 red, every one of them
 * `target-size` and every one of them the same button, which #142 fixed. The
 * 2.1 tags add nothing red — that set was already clean.
 *
 * `wcag22a` is left out because axe has no rule under it: WCAG 2.2's one
 * level-A criterion is 3.2.6 Consistent Help, which nothing automatic can
 * decide.
 */
const RULE_SETS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * `window.ka` is declared in src/layout/colorScheme.ts, which these tests do
 * not compile against — they run in the browser, not in the bundle. Declared
 * again here, narrowly, so `page.evaluate` is typed.
 */
declare global {
  interface Window {
    ka?: { colorScheme: { get(): string; set(scheme: string): string } };
  }
}

/**
 * Known, reasoned exceptions. Empty today, and it should stay that way.
 *
 * Anything added here needs a sentence saying why the rule does not apply,
 * not why it is inconvenient. An exception without a reason is a bug with
 * paperwork.
 */
const DISABLED_RULES: string[] = [];

/**
 * Put the page at rest before measuring it.
 *
 * A tooltip is shown by focus or hover and fades in over
 * `--dsc-tooltip-transition-duration` after a 150 ms delay. Axe run against
 * one mid-fade reports `color-contrast (serious)` on `.ds-tooltip` — and it is
 * not a contrast problem: measured 2026-09-15, the same tooltip gives one
 * violation immediately and none 600 ms later, with identical computed
 * colours, white on rgb(31, 44, 61), about 13:1.
 *
 * So this is the same class as the trace files and the shared port: the suite
 * going red for reasons inside its own plumbing. `walkWithTab` leaves focus
 * wherever it stopped, and whether that element happens to own a tooltip is
 * not something a test should depend on.
 *
 * Dropping focus and the pointer is what makes the tooltip go away — the same
 * move `saveScreenshot` makes below, for the same kind of reason — and then we
 * wait for it to finish going. A page that never had one moves straight on.
 */
async function settle(page: Page, keepFocus = false): Promise<void> {
  /*
   * The blur is the default because a focused control shows a tooltip, and a
   * tooltip caught mid-fade reads as a contrast violation — see above.
   *
   * But it CLOSES anything that lives on focus, and then axe measures a state
   * nobody is in. Measured 2026-09-17 on an open `Suggestion` list with a row
   * highlighted by ArrowDown: before the blur, 259 visible options, one open
   * `u-datalist` and an `aria-activedescendant` on the input; after it, zero,
   * zero and none, with focus on `<body>`. The test that was meant to cover
   * exactly that state had been running axe on a shut list since the day it
   * was written.
   *
   * So a caller that is measuring a state held open by focus passes
   * `keepFocus`. It keeps the tooltip wait, which is the other half of the
   * job.
   */
  if (!keepFocus) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
  }

  await page
    .waitForFunction(
      () => {
        const tip = document.querySelector('.ds-tooltip');
        return !tip || !(tip as HTMLElement).checkVisibility();
      },
      undefined,
      { timeout: 2000 },
    )
    // A tooltip that will not go away is a finding in its own right, but it is
    // not this helper's to report: let axe run and say what it sees.
    .catch(() => {});

  /*
   * And no colour is still on its way from one value to another.
   *
   * Same class as the tooltip, found the same way. Measured 2026-09-17 on a
   * facet list one keystroke after ArrowDown: axe reported `color-contrast`
   * 1,04:1 on the highlighted row, `#f9fafb` on `#ffffff` — the highlight's
   * text colour against a background that had not finished arriving. Two
   * hundred milliseconds later it was gone, and it stayed gone at 400, 800 and
   * 1500 ms. Nothing was wrong with the colours; the measurement was early.
   *
   * Anything that will END is waited for. The list's entrance is a
   * `CSSAnimation` and not a transition, so «transitions only» would have
   * waited for nothing in exactly the case this was written for — measured in
   * that state: zero running transitions, one running animation, and it is the
   * one that matters. What is skipped is anything that LOOPS: a skeleton
   * shimmer never finishes, and waiting for one would cost every axe call the
   * full timeout.
   */
  await page
    .waitForFunction(
      () =>
        !document.getAnimations().some((animation) => {
          if (animation.playState !== 'running') return false;
          const timing = animation.effect?.getComputedTiming();
          return timing !== undefined && timing.iterations !== Infinity;
        }),
      undefined,
      { timeout: 2000 },
    )
    .catch(() => {});
}

/**
 * Runs axe on whatever is on screen and fails the test on any violation.
 *
 * `keepFocus` for a state that only exists while something has focus — an open
 * dropdown, a highlighted row. Without it the state is gone before axe looks;
 * see `settle`.
 *
 * `allRules` runs every rule axe has on by default, best-practice included,
 * instead of `RULE_SETS`. For pages of written content, where the advice rules
 * catch what the WCAG set lets through: the table on `/onboarding` had an
 * empty header cell (`empty-table-header`, best-practice) that the measurement
 * in #226 could not see and the review found by hand. Not the default, for the
 * reason given at `RULE_SETS`.
 */
export async function expectNoAxeViolations(
  page: Page,
  what: string,
  { keepFocus = false, allRules = false }: { keepFocus?: boolean; allRules?: boolean } = {},
): Promise<void> {
  await settle(page, keepFocus);

  const builder = new AxeBuilder({ page });
  if (!allRules) builder.withTags(RULE_SETS);
  const results = await builder.disableRules(DISABLED_RULES).analyze();

  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'ukjent'}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
  );

  expect(summary, `axe-brudd i ${what}`).toEqual([]);
}

/**
 * Saves a screenshot under a stable name, for comparing against Figma.
 *
 * Not an assertion. A visual diff would fail on every font-rendering
 * difference between machines, and the review of these images is a person
 * looking at them, which is what the role brief asks for.
 */
export async function saveScreenshot(page: Page, name: string): Promise<void> {
  if (!SCREENSHOTS) return;
  // Inter comes from a CDN, and the fallback's metrics are not Inter's. A
  // reference image taken before the font lands has different line breaks
  // from the product, which is the one thing a reference image must not have.
  await page.evaluate(() => document.fonts.ready);
  // Drop focus first. A reference image is the resting state; a button left
  // focused by the click that got us here reads as a hover or an active
  // state, and the person comparing against Figma has to guess which.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // And move the pointer off whatever was clicked last. Blurring does not
  // end a hover: the mouse stays where Playwright left it, so the last
  // button pressed keeps its hover surface and the image says the user is
  // pointing at something. Caught in the collapsed-sidebar shots on
  // 2026-09-14, where the nav toggle sat highlighted and the sources toggle
  // beside it did not.
  await page.mouse.move(0, 0);
  await mkdir(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(SCREENSHOTS, `${name}.png`), fullPage: false });
}

/** Both colour schemes, applied through the API the product actually ships. */
export async function setColorScheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((value) => window.ka?.colorScheme.set(value), scheme);
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', scheme);
}

/**
 * Everything on the page sits inside a landmark.
 *
 * Its own check rather than a tag in `RULE_SETS`, because `region` is a
 * best-practice rule and not `wcag2a`/`wcag2aa` — so every existing call to
 * `expectNoAxeViolations` is blind to it, and adding the whole
 * `best-practice` set to the shared run would change what every test in the
 * suite asserts. This one rule is what caught the drag handle sitting outside
 * every landmark after #50, and this is what keeps it from happening again.
 */
export async function expectAllContentInLandmarks(page: Page, what: string): Promise<void> {
  await settle(page);

  const results = await new AxeBuilder({ page }).withRules(['region']).analyze();
  const outside = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => node.target.join(' ')),
  );

  expect(outside, `innhold utenfor alle landemerker i ${what}`).toEqual([]);
}

/**
 * What an element's text and its focus ring actually measure against the
 * surface behind them, as contrast ratios.
 *
 * Measured here rather than left to axe, because axe ABSTAINS on exactly the
 * rows this exists for. An option inside an open `Suggestion` list comes back
 * under `incomplete`, never `violations`, with «Element's background color
 * could not be determined because it is overlapped by another element» —
 * measured 2026-09-17 in both modes: eleven incomplete nodes in that state,
 * four of them options, the highlighted row among them, and not one option in
 * `passes`. `expectNoAxeViolations` reads `violations`, so it cannot fail on a
 * row axe never judged.
 *
 * Two numbers, because a highlighted row has two things to check and they have
 * different thresholds: the text is 4,5:1 (WCAG 1.4.3) and the ring around it
 * is a non-text indicator at 3:1 (1.4.11).
 *
 * The background is the first opaque ancestor, since the option itself is
 * transparent, and the walk crosses shadow roots — the list is a `u-datalist`
 * with one of its own, and `parentElement` stops at the boundary.
 */
export async function contrastAgainstBackdrop(
  locator: Locator,
): Promise<{ text: number; ring: number; background: string }> {
  return locator.evaluate((element) => {
    const channels = (color: string): number[] =>
      (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

    const luminance = (color: string): number => {
      const [r, g, b] = channels(color).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const ratio = (a: string, b: string): number => {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
    };

    const opaqueBehind = (start: Element): string => {
      let node: Element | null = start;
      while (node) {
        const color = getComputedStyle(node).backgroundColor;
        if (color && !/rgba\(0, 0, 0, 0\)|transparent/.test(color)) return color;
        const root = node.getRootNode();
        node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
      }
      // The page itself, if nothing on the way said otherwise.
      return getComputedStyle(document.documentElement).backgroundColor;
    };

    const style = getComputedStyle(element);
    const background = opaqueBehind(element);
    return {
      text: ratio(style.color, background),
      ring: ratio(style.outlineColor, background),
      background,
    };
  });
}

/** Marks a test as covering one line in docs/review/funksjonssjekk.md. */
export function covers(testInfo: TestInfo, row: string): void {
  testInfo.annotations.push({ type: 'dekker', description: row });
}
