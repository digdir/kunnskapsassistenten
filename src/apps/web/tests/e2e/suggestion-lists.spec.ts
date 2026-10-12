import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';
import { MOCK } from './helpers';

/* How a filter field's list orders and places itself in a browser: the chosen first from the
   next opening, nothing moving while it is open, and inside the window as the field grows
   (chosenFirst.ts, listFollowsField.ts). */

function organisations(page: Page) {
  const field = page
    .getByRole('navigation', { name: 'Tråder og filter' })
    .locator('ds-field')
    .filter({ has: page.getByPlaceholder('Søk i virksomheter') });
  return {
    input: field.getByPlaceholder('Søk i virksomheter'),
    list: field.getByRole('listbox', { name: 'Virksomheter' }),
  };
}

test(
  'de valgte står øverst når lista åpner igjen, og ingenting flytter seg mens den er åpen',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await page.goto('/');
    const { input, list } = organisations(page);
    await input.click();
    const options = list.getByRole('option');
    const before = await options.allTextContents();
    const picked = before[2];

    await options.nth(2).click();
    await expect(list.getByRole('option', { selected: true })).toHaveText([picked]);
    await expect(options).toHaveText(before);

    await page.keyboard.press('Escape');
    await input.click();
    await expect(options.first()).toHaveText(picked);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  },
);

test(
  'lista åpner øverst igjen etter rulling, så de valgte synes',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await page.goto('/');
    const { input, list } = organisations(page);
    await input.click();
    const options = list.getByRole('option');
    const picked = (await options.nth(30).textContent()) ?? '';

    // The click scrolls the option into view, and the list remembers where it was.
    await options.nth(30).click();
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await input.click();
    await expect(options.first()).toHaveText(picked);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(options.first()).toBeInViewport();
  },
);

test.describe('i et vindu der det er trangt under feltet', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('lista åpner over feltet', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await page.goto('/');
    const { input, list } = organisations(page);
    await input.click();

    await expect(list).toHaveAttribute('data-floating', /^top/u);
    const field = await input.boundingBox();
    const box = await list.boundingBox();
    expect(box && field && box.y + box.height <= field.y).toBe(true);
  });
});

test.describe('i et høyt vindu, der lista åpner under feltet', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test(
    'lista holder seg inne i vinduet når valgene flytter feltet',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'filtre kan velges og gir chips');
      await page.goto('/');
      const { input, list } = organisations(page);
      await input.click();
      const inside = async () => {
        const box = await list.boundingBox();
        return box !== null && box.y >= 0 && box.y + box.height <= 1100;
      };
      await expect.poll(inside).toBe(true);

      // Each choice adds a chip, and a new row of them moves the field down.
      for (let count = 1; count <= 4; count++) {
        await list.getByRole('option', { selected: false }).first().click();
        await expect(list.getByRole('option', { selected: true })).toHaveCount(count);
        await expect.poll(inside, { message: `etter valg ${count}` }).toBe(true);
      }
    },
  );
});
