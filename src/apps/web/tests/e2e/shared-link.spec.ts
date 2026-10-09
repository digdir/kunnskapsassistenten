import { expect, test } from '@playwright/test';
import { covers } from './a11y';
import { MOCK } from './helpers';

/** Hele kvitteringen, som den står når lenken er kopiert. */
const RECEIPT = 'Lenken til tråden er kopiert. Virker bare for deg, i denne nettleseren.';

/**
 * Kvitteringen etter «Kopier lenke til tråden» er to linjer på telefon, og
 * kolonnen vokser under en leser som står nederst. Den rulles derfor inn, men
 * aldri så langt at en tegnet fokusring havner ute av syne.
 */
for (const width of [320, 360, 390]) {
  test.describe(`kvitteringen for lenken til tråden, ${width}`, () => {
    test.use({ viewport: { width, height: 740 }, isMobile: true, hasTouch: true });

    test('står i lesevinduet etter et trykk', MOCK, async ({ page, context }, testInfo) => {
      covers(testInfo, 'kopier svaret og lenke til tråden');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const copyLink = await openAtEnd(page);
      await copyLink.tap();

      // Innenfor de fire sekundene kvitteringen står (useCopy.ts, RECEIPT_MS).
      await expect(page.locator('.ka-answer-actions__receipt').last()).toHaveText(RECEIPT, {
        timeout: 3_000,
      });

      const { receiptBehindEdge } = await measure(page);
      expect(
        receiptBehindEdge,
        'piksler av kvitteringen bak kanten av lesevinduet',
      ).toBeLessThanOrEqual(0);
    });

    test('lar et tegnet fokus bli stående', MOCK, async ({ page, context }, testInfo) => {
      covers(testInfo, 'kopier svaret og lenke til tråden');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const copyLink = await openAtEnd(page);
      // Fokus først, så Enter: tastetrykket er det som får Chromium til å
      // tegne fokusringen, og det er ringen påstanden handler om.
      await copyLink.focus();
      await page.keyboard.press('Enter');

      await expect(page.locator('.ka-answer-actions__receipt').last()).toHaveText(RECEIPT, {
        timeout: 3_000,
      });

      const { buttonTop, buttonBottom, drawnFocus, columnHeight } = await measure(page);
      expect(drawnFocus, 'knappen skal ha et tegnet fokus').toBe(true);
      expect(buttonTop, 'knappens overkant, målt fra toppen av kolonnen').toBeGreaterThanOrEqual(0);
      expect(buttonBottom, 'knappens underkant, målt fra toppen av kolonnen').toBeLessThanOrEqual(
        columnHeight,
      );
    });
  });
}

/** Tråden, rullet helt ned, og knappen som kopierer lenken. */
async function openAtEnd(page: import('@playwright/test').Page) {
  await page.goto('/threads/nkom-maaloppnaaelse');
  const copyLink = page.getByRole('button', { name: 'Kopier lenke til tråden' }).last();
  await expect(copyLink).toBeVisible();
  await page.evaluate(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = main.scrollHeight;
  });
  return copyLink;
}

/**
 * Kvitteringen og knappen, målt mot kolonnen de ruller i. Lesevinduet slutter
 * der toningen over skrivefeltet begynner: tekst under toningen er bleket.
 */
async function measure(page: import('@playwright/test').Page) {
  const measured = await page.evaluate(() => {
    const column = document.querySelector('main');
    const receipt = [...document.querySelectorAll('.ka-answer-actions__receipt')].at(-1);
    const composer = document.querySelector('.ka-composer-area');
    const button = [...document.querySelectorAll('button')]
      .filter((element) => element.textContent?.trim().startsWith('Kopier lenke til tråden'))
      .at(-1);
    if (!column || !receipt || !composer || !button) return null;

    // Toningen ligger over feltet som et ::before, utenfor boksen til feltet.
    const fade = Number.parseFloat(getComputedStyle(composer, '::before').blockSize) || 0;
    const edge = composer.getBoundingClientRect().top - fade;
    const top = column.getBoundingClientRect().top;
    const box = button.getBoundingClientRect();
    return {
      receiptBehindEdge: Math.round(receipt.getBoundingClientRect().bottom - edge),
      buttonTop: Math.round(box.top - top),
      buttonBottom: Math.round(box.bottom - top),
      columnHeight: Math.round(column.clientHeight),
      drawnFocus: button.matches(':focus-visible'),
    };
  });

  expect(measured, 'kvitteringen, knappen og skrivefeltet skal finnes').not.toBeNull();
  return measured!;
}
