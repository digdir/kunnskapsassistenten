import { expect, test, type Locator, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ask, MOCK } from './helpers';

/**
 * Lars, 2026-11-03: «When I press a link in "Kilder brukt i svaret" I expect to be taken to the
 * document, not a document's first excerpt. Also don't want it to be marked blue.»
 *
 * Behaviour only, as a reader meets it: the link takes focus to the document's level-3 heading in
 * the sources panel, or into it, onto something named for the document (KA CC: one assertion for
 * KA's view and genki's part, whose heading holds the card's toggle), without opening or closing
 * the card; every excerpt stays closed, no excerpt offers «Tilbake til svaret» (which only the
 * excerpt a marker opened has), the address gets no fragment, and Escape comes back to the link.
 * An open excerpt is told by its toggle, which reads «Lukk utdrag N»; the control follows a footnote,
 * which opens and marks its excerpt, and counts one of each.
 */
const QUESTION = 'Hvordan jobber Nkom med måloppnåelse?';
const DOCUMENT = 'Tildelingsbrev Nkom 2026 (DFD)';

// An open excerpt's toggle reads «Lukk utdrag N». It has no role of its own in the accessibility
// tree (a `<summary>` inside its `group`), so it is found by that whole text.
function openExcerpts(scope: Locator) {
  return scope.getByText(/^Lukk utdrag \d+$/u);
}

/**
 * Focus is on the document's heading or inside it, on something named for the document, and the
 * heading is in view.
 */
async function expectFocusOnDocument(page: Page, scope: Locator) {
  const heading = scope.getByRole('heading', { name: DOCUMENT, level: 3 });
  await expect
    .poll(() => heading.evaluate((element) => element.contains(document.activeElement)), {
      message: 'focus is on the document heading or inside it',
    })
    .toBe(true);
  await expect(page.locator(':focus')).toHaveAccessibleName(DOCUMENT);
  await expect(heading).toBeInViewport();
}

/** Whether the card is open, where its heading holds a toggle (genki's part); else null. */
async function cardOpen(page: Page): Promise<string | null> {
  const toggle = page
    .getByRole('heading', { name: DOCUMENT, level: 3, includeHidden: true })
    .locator('[aria-expanded]');
  return (await toggle.count()) === 0 ? null : toggle.first().getAttribute('aria-expanded');
}

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
    async ({ page }, testInfo) => {
      covers(testInfo, 'kilder brukt i svaret');
      await page.goto('/');
      await ask(page, QUESTION);
      const address = page.url();

      const link = summaryLink(page);
      const openBefore = await cardOpen(page);
      await link.click();

      const panel = page.getByRole('complementary', { name: 'Kilder' });
      await expectFocusOnDocument(page, panel);
      expect(await cardOpen(page), 'going to the card does not open or close it').toBe(openBefore);
      await expect(openExcerpts(panel)).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);
      expect(page.url(), 'the address must not get a fragment').toBe(address);

      await page.keyboard.press('Escape');
      await expect(link).toBeFocused();

      await expectNoAxeViolations(page, 'kildepanelet etter en tittel under svaret');

      // The control: a footnote does open and mark its excerpt, so both counts above can fail.
      await page
        .getByRole('main')
        .getByRole('link', { name: /^Utdrag 1:/u })
        .first()
        .click();
      await expect(openExcerpts(panel)).toHaveCount(1);
      await expect(panel.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(1);
    },
  );

  test('at 390 opens the drawer on the document, with nothing opened', MOCK, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await ask(page, QUESTION);

    const openBefore = await cardOpen(page);
    await summaryLink(page).click();

    const drawer = page.getByRole('dialog', { name: /^Kilder$/iu });
    await expect(drawer).toBeVisible();
    await expectFocusOnDocument(page, drawer);
    expect(await cardOpen(page), 'going to the card does not open or close it').toBe(openBefore);
    await expect(openExcerpts(drawer)).toHaveCount(0);
  });
});
