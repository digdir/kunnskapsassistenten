import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ask, MOCK } from './helpers';

/**
 * From an excerpt back to where the answer uses it: every cited excerpt has a button beside
 * «Utdrag N» that takes focus to a footnote that cites it, stepping through the uses when there
 * are several and wrapping after the last. In the narrow layout the sources panel is a modal
 * drawer, so both ways back, this one and «Tilbake til svaret», close it before focus moves.
 *
 * Behaviour only. The scripted Bufdir answer cites excerpt 1 twice and excerpt 2 once.
 */
const QUESTION = 'Hva er hovedutfordringene Bufdir rapporterer om i institusjonsbarnevernet?';
const DOCUMENT = 'Årsrapport Barne-, ungdoms- og familiedirektoratet 2024';

function footnotes(page: Page, n: number) {
  return page.getByRole('main').getByRole('link', { name: new RegExp(`^Utdrag ${n}: `, 'u') });
}

function titleLink(page: Page) {
  return page
    .getByRole('main')
    .getByRole('group')
    .filter({ hasText: 'Kilder brukt i svaret' })
    .getByRole('link', { name: DOCUMENT, exact: true });
}

test.describe('from an excerpt back to the answer', () => {
  test('steps through the uses of an excerpt, and wraps', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'utdrag viser tilbake til svaret');
    await page.goto('/');
    await ask(page, QUESTION);
    await expect(footnotes(page, 1)).toHaveCount(2);

    await titleLink(page).click();
    const panel = page.getByRole('complementary', { name: 'Kilder' });
    const backLink = panel.getByRole('button', { name: /^Vis hvor svaret bruker utdrag 1 / });
    await expect(backLink).toHaveAccessibleName('Vis hvor svaret bruker utdrag 1 (1/2)');
    await expect(backLink).toHaveText('1/2');
    // The control: before a press, focus is in the panel and on no footnote.
    await expect(footnotes(page, 1).first()).not.toBeFocused();
    // The panel with its back-links, before a press scrolls the answer.
    await expectNoAxeViolations(page, 'kildepanelet med veier tilbake til svaret');

    for (const [use, name] of [
      [0, '1/2'],
      [1, '2/2'],
      [0, '1/2'],
    ] as const) {
      await backLink.click();
      await expect(footnotes(page, 1).nth(use)).toBeFocused();
      await expect(footnotes(page, 1).nth(use)).toBeInViewport();
      await expect(backLink).toHaveAccessibleName(`Vis hvor svaret bruker utdrag 1 (${name})`);
    }

    const once = panel.getByRole('button', {
      name: 'Vis hvor svaret bruker utdrag 2',
      exact: true,
    });
    await expect(once).toHaveText('');
    await once.click();
    await expect(footnotes(page, 2)).toBeFocused();
  });

  test('at 390 both ways back close the drawer before focus moves', MOCK, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await ask(page, QUESTION);
    const drawer = page.getByRole('dialog', { name: /^Kilder$/iu });

    // «Tilbake til svaret», after a footnote opened its excerpt in the drawer.
    await footnotes(page, 1).first().click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Tilbake til svaret' }).click();
    await expect(drawer).toHaveCount(0);
    await expect(footnotes(page, 1).first()).toBeFocused();

    // The back-link, from the drawer a title opened.
    await titleLink(page).click();
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole('button', { name: 'Vis hvor svaret bruker utdrag 2', exact: true })
      .click();
    await expect(drawer).toHaveCount(0);
    await expect(footnotes(page, 2)).toBeFocused();
  });
});
