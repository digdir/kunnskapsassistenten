import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ask, MOCK } from './helpers';

/**
 * The card a title in «Kilder brukt i svaret» opens has a visible «Tilbake til svaret», like the
 * excerpt a footnote opens, so a mouse or touch reader has a way back too. It is the next stop
 * after the heading the reader lands on, its name is its visible text, and pressing it does what
 * Escape does: focus goes back to the title, in view. In the narrow layout the drawer closes
 * first.
 *
 * Behaviour only, on the scripted Nkom answer. The controls: focus elsewhere and the title out of
 * view before the press, and the drawer open before it.
 */
const QUESTION = 'Hvordan jobber Nkom med måloppnåelse?';
const DOCUMENT = 'Tildelingsbrev Nkom 2026 (DFD)';

function titleLink(page: Page) {
  return page
    .getByRole('main')
    .getByRole('group')
    .filter({ hasText: 'Kilder brukt i svaret' })
    .getByRole('link', { name: DOCUMENT, exact: true });
}

test.describe('the way back from a document a title opened', () => {
  test(
    '«Tilbake til svaret» follows the heading and goes back to the title',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'kilder brukt i svaret');
      await page.goto('/');
      await ask(page, QUESTION);
      const panel = page.getByRole('complementary', { name: 'Kilder' });
      const back = page.getByRole('button', { name: 'Tilbake til svaret', exact: true });

      const link = titleLink(page);
      await link.click();
      const heading = panel.getByRole('heading', { name: DOCUMENT, level: 3 });
      await expect(heading).toBeFocused();

      await expect(panel.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(1);
      await expect(back).toBeVisible();
      await expect(back, 'the name is the visible text').toHaveText('Tilbake til svaret');
      await expect(back).toHaveAccessibleName('Tilbake til svaret');
      const box = await back.boundingBox();
      expect(box?.width ?? 0, 'the text is drawn, not only the icon').toBeGreaterThan(
        3 * (box?.height ?? 0),
      );

      await page.keyboard.press('Tab');
      await expect(back, 'the next stop after the heading').toBeFocused();
      await expect(link).not.toBeFocused();

      await expectNoAxeViolations(page, 'dokumentkortet med veien tilbake til svaret');

      await page.getByRole('main').evaluate((main) => main.scrollTo({ top: 0 }));
      await expect(link, 'out of view before the press').not.toBeInViewport();
      await back.click();
      await expect(link).toBeFocused();
      await expect(link).toBeInViewport();
    },
  );

  test(
    'at 390 «Tilbake til svaret» closes the drawer, then goes to the title',
    MOCK,
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await ask(page, QUESTION);

      const link = titleLink(page);
      await link.click();
      const drawer = page.getByRole('dialog', { name: /^Kilder$/iu });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole('heading', { name: DOCUMENT, level: 3 })).toBeFocused();

      await page.getByRole('main').evaluate((main) => main.scrollTo({ top: 0 }));
      await expect(link, 'out of view before the press').not.toBeInViewport();
      await drawer.getByRole('button', { name: 'Tilbake til svaret', exact: true }).click();

      await expect(drawer).toHaveCount(0);
      await expect(link).toBeFocused();
      await expect(link).toBeInViewport();
    },
  );
});
