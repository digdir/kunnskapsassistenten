import { expect, test } from '@playwright/test';
import { saveScreenshot, setColorScheme } from './a11y';
import { ask, facetField, openSources, showThreads, MOCK, REAL_ANSWER } from './helpers';

/**
 * Screenshots for the visual review, not assertions.
 *
 * The role brief asks for every view in both colour schemes, under stable
 * names, so they can be held up against the Figma images in
 * `design/omraader/`. A pixel comparison is deliberately not what this is:
 * it would fail on every font-rendering difference between two machines, and
 * the deviations that matter are not pixels. A person looks at these, and the
 * findings go in `docs/review/visuell-<dato>.md`.
 *
 * One file per view per mode, always the same name, so a diff between two
 * runs is a diff in the product.
 */
test.describe('skjermbilder', () => {
  for (const mode of ['light', 'dark'] as const) {
    const suffix = mode === 'light' ? 'lys' : 'mork';

    test(`filtrering, tråder og tom chat i ${mode}`, MOCK, async ({ page }) => {
      await page.goto('/');
      await setColorScheme(page, mode);

      // Wait for the facets. Without this the shot catches the skeletons,
      // which is a state worth having but not the one this file is for.
      // By label and not by role: Suggestion has no `role="combobox"` until
      // someone has touched it. See funn-tverrgaaende.md.
      await expect(facetField(page, 'Dokumenttyper')).toBeVisible();

      // The filter view is what a first-time user meets (answer 1), so the
      // front page shows the filter and the empty chat at once.
      await saveScreenshot(page, `filters-${suffix}`);
      await saveScreenshot(page, `chat-tom-${suffix}`);

      await showThreads(page);
      await expect(page.locator('.threads-view__group').first()).toBeVisible();
      await saveScreenshot(page, `threads-${suffix}`);
    });

    test(`svar og kildepanel i ${mode}`, REAL_ANSWER, async ({ page }) => {
      await page.goto('/');
      await setColorScheme(page, mode);
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

      // The answer with the sources panel still closed, which is the state
      // the design draws as «Svaret som vises».
      await saveScreenshot(page, `chat-svar-${suffix}`);

      await openSources(page, 1);
      await saveScreenshot(page, `sources-${suffix}`);

      // The bottom of the answer: the action row, the closing question and
      // the compose field over the tinted ground.
      await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 99_999));
      await page.waitForTimeout(400);
      await saveScreenshot(page, `chat-svar-bunn-${suffix}`);
    });
  }
});
