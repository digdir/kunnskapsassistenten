import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { ANSWER_TIMEOUT, MOCK, composer } from './helpers';

/**
 * What the main column does when the reader sends a question
 * (digdir/kunnskapsassistenten#126, chosen 06.10).
 *
 * At the bottom, or so near it that it looks like the bottom, the column
 * follows the question and the answer down. Further up it stands where it is,
 * so a reader who sends and goes on reading an older answer is not taken away
 * from it, and «Bla til nederst» is there instead.
 *
 * «Near» is 80 px: a line of the answer (30.6 px) and half a wheel step
 * (100 px in Chromium). jsdom has no layout, so the unit tests set the
 * column's numbers by hand; this is the same rule in a browser.
 */

const THREAD = '/threads/nkom-maaloppnaaelse';

/** The answers that are done, by the button only a finished answer has. */
const finished = (page: Page) => page.getByRole('button', { name: 'Kopier svaret' });

function distanceToBottom(main: Locator): Promise<number> {
  return main.evaluate((element) =>
    Math.round(element.scrollHeight - element.scrollTop - element.clientHeight),
  );
}

/**
 * Until the thread has stopped growing. A thread read from its address goes
 * on laying itself out for a moment after its first answer shows, and a
 * column put 30 px from a bottom that then moves is no longer 30 px from it.
 * Measured: without this the column stood 4455 px short after sending at
 * 390, and 30 px further down in the middle at both widths, while the same
 * steps by hand held.
 */
async function settled(page: Page, main: Locator): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  let last = -1;
  await expect
    .poll(
      async () => {
        const height = await main.evaluate((element) => element.scrollHeight);
        const still = height === last;
        last = height;
        return still;
      },
      { intervals: [250], timeout: 10_000 },
    )
    .toBe(true);
}

/** Send a follow-up from where the column stands, and wait for its answer. */
async function send(page: Page): Promise<void> {
  const before = await finished(page).count();
  await composer(page).click();
  await page.keyboard.type('Kan du utdype?');
  await page.keyboard.press('Enter');
  await expect(finished(page)).toHaveCount(before + 1, { timeout: ANSWER_TIMEOUT });
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test.describe(`sending, ${width}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(THREAD);
      await expect(finished(page).first()).toBeVisible();
      await settled(page, page.locator('.main'));
    });

    test('midt i tråden står kolonnen, og «Bla til nederst» vises', MOCK, async ({ page }) => {
      const main = page.locator('.main');
      await main.evaluate((element) => {
        element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) / 2);
      });
      // Read before the click: the field taking focus must not move it either.
      const before = await main.evaluate((element) => element.scrollTop);
      expect(before, 'tråden skal ha noe å rulle i').toBeGreaterThan(0);

      await send(page);

      expect(
        await main.evaluate((element) => element.scrollTop),
        'kolonnen skal stå der leseren leste',
      ).toBe(before);
      await expect(page.getByRole('button', { name: 'Bla til nederst' })).toBeVisible();
      await expectNoAxeViolations(page, `«Bla til nederst» etter sending midt i tråden, ${width}`);
    });

    test('fra bunnen følger kolonnen spørsmålet og svaret ned', MOCK, async ({ page }) => {
      const main = page.locator('.main');
      await main.evaluate((element) => (element.scrollTop = element.scrollHeight));
      expect(await distanceToBottom(main)).toBe(0);

      await send(page);

      expect(await distanceToBottom(main), 'kolonnen skal stå nederst').toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Bla til nederst' })).toHaveCount(0);
    });

    test('30 px over bunnen, som ser ut som bunnen, følger den også', MOCK, async ({ page }) => {
      const main = page.locator('.main');
      await main.evaluate(
        (element) => (element.scrollTop = element.scrollHeight - element.clientHeight - 30),
      );
      expect(await distanceToBottom(main)).toBe(30);

      await send(page);

      expect(await distanceToBottom(main), 'kolonnen skal stå nederst').toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Bla til nederst' })).toHaveCount(0);
    });
  });
}
