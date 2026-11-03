import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { ask, MOCK } from './helpers';

/**
 * Lars, 2026-11-03: «When I press a link in "Kilder brukt i svaret" I expect to be taken to the
 * document, not a document's first excerpt. Also don't want it to be marked blue.»
 *
 * Behaviour only, as a reader meets it: the link takes focus to the document's heading in the
 * sources panel, every excerpt stays closed, no excerpt offers «Tilbake til svaret» (which only the
 * excerpt a marker opened has), the address gets no fragment, and Escape comes back to the link.
 */
const QUESTION = 'Hvordan jobber Nkom med måloppnåelse?';
const DOCUMENT = 'Tildelingsbrev Nkom 2026 (DFD)';

function summaryLink(page: Page) {
  return page
    .getByRole('main')
    .getByRole('group')
    .filter({ hasText: 'Kilder brukt i svaret' })
    .getByRole('link', { name: DOCUMENT, exact: true });
}

test.describe('a title in «Kilder brukt i svaret»', () => {
  test(
    'goes to the document in the sources panel, with nothing opened or marked',
    MOCK,
    async ({ page }) => {
      await page.goto('/');
      await ask(page, QUESTION);
      const address = page.url();

      const link = summaryLink(page);
      await link.click();

      const panel = page.getByRole('complementary', { name: 'Kilder' });
      await expect(panel.getByRole('heading', { name: DOCUMENT, level: 3 })).toBeFocused();
      await expect(panel.getByText('Lukk', { exact: true })).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);
      expect(page.url(), 'the address must not get a fragment').toBe(address);

      await page.keyboard.press('Escape');
      await expect(link).toBeFocused();

      await expectNoAxeViolations(page, 'kildepanelet etter en tittel under svaret');
    },
  );

  test('at 390 opens the drawer on the document, with nothing opened', MOCK, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await ask(page, QUESTION);

    await summaryLink(page).click();

    const drawer = page.getByRole('dialog', { name: /^Kilder$/iu });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: DOCUMENT, level: 3 })).toBeFocused();
    await expect(drawer.getByText('Lukk', { exact: true })).toHaveCount(0);
  });
});
