import { expect, test } from '@playwright/test';
import { covers } from './a11y';

/**
 * The year filter as periods, behind the `year-ranges` flag (#115), in a
 * real browser: what the list offers from the first digit, and that a click
 * in it chooses.
 *
 * With «2» typed the list used to hold only the hint, «Ikke et år eller en
 * periode …», and the hint is an option with an empty value: a click on it
 * emptied the field and chose nothing (measured on main 879f0de). The forms
 * the field reads are unit tests (yearRanges.test.ts); this is the part only
 * a browser has, u-datalist taking the click.
 *
 * No `@mock` tag: it asks only for some year from 2000 on with documents,
 * which any corpus has, and reads the year it clicked.
 */
test('årsfilteret med perioder foreslår år fra første siffer, og et klikk gir merkelappen', async ({
  page,
}, testInfo) => {
  covers(testInfo, 'filtre kan velges og gir chips');

  await page.addInitScript(() => {
    localStorage.setItem('ka.flags.v1', JSON.stringify(['year-ranges']));
  });
  await page.goto('/');

  const field = page.locator('.year-range-field');
  const input = field.locator('input.ds-input');
  await input.click();
  await input.pressSequentially('2');

  const options = field.getByRole('listbox').getByRole('option');
  await expect(options.first()).toBeVisible();
  // Years, with their documents where the corpus counts them; not the hint.
  for (const text of await options.allTextContents()) {
    expect(text).toMatch(/^2\d{3}( \(\d+\))?$/u);
  }

  const option = options.first();
  const year = ((await option.textContent()) ?? '').slice(0, 4);
  await option.click();

  await expect(field.locator('ds-suggestion > data')).toHaveText([year]);
  await expect(input).toHaveValue('');
  await expect(field.locator('[data-field="description"]')).toHaveText('1 år valgt');
});
