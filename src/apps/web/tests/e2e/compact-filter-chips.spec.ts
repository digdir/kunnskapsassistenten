import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';
import { MOCK } from './helpers';

/* One chip for many values hides a chip per value, which u-combobox ticks, counts and walks by.
   jsdom has no CSS, so the hiding, where the keyboard lands past the hidden chips, and the
   panel's live region are checked in a browser (drawnChips.tsx, FacetField.tsx). */

function organisations(page: Page) {
  const field = page
    .getByRole('navigation', { name: 'Tråder og filter' })
    .locator('ds-field')
    .filter({ has: page.getByPlaceholder('Søk i virksomheter') });
  return {
    field,
    input: field.getByPlaceholder('Søk i virksomheter'),
    list: field.getByRole('listbox', { name: 'Virksomheter' }),
    chips: field.locator('ds-suggestion > data:visible'),
  };
}

/** Six of them, the first that are not ticked, so the chips become one. */
async function chooseSix(page: Page) {
  await page.goto('/');
  const { input, list, chips } = organisations(page);
  await input.click();
  for (let count = 1; count <= 6; count++) {
    await list.getByRole('option', { selected: false }).first().click();
    await expect(list.getByRole('option', { selected: true })).toHaveCount(count);
  }
  await expect(chips).toHaveText(['6 virksomheter']);
}

test(
  'many chosen values show as one chip without any flag, and the list ticks them',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await chooseSix(page);
    const { input, list } = organisations(page);

    await page.keyboard.press('Escape');
    await input.click();

    await expect(list.getByRole('option', { selected: true })).toHaveCount(6);
  },
);

test(
  'ArrowLeft from the empty field reaches the one chip, not the hidden ones',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await chooseSix(page);
    const { field, input } = organisations(page);
    const summary = field.getByRole('option', {
      name: /^6 virksomheter, Trykk for å fjerne alle/u,
    });

    await page.keyboard.press('Escape');
    await expect(input).toHaveAttribute(
      'aria-description',
      '6 valgt, naviger bakover for å fjerne alle',
    );
    await input.press('ArrowLeft');
    await expect(summary).toBeFocused();

    // The chips before it are hidden, so it keeps the focus.
    await page.keyboard.press('ArrowLeft');
    await expect(summary).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(input).toBeFocused();
  },
);

test(
  '«Velg alle» leaves one «Alle virksomheter» chip, which the keyboard reaches and removes',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await page.goto('/');
    const { field, input, list, chips } = organisations(page);

    await field.getByRole('button', { name: 'Velg alle virksomheter' }).click();
    await expect(chips).toHaveText(['Alle virksomheter']);

    await input.click();
    const options = await list.getByRole('option').count();
    expect(options).toBeGreaterThan(1);
    await expect(list.getByRole('option', { selected: true })).toHaveCount(options);

    await page.keyboard.press('Escape');
    await input.press('ArrowLeft');
    const summary = field.getByRole('option', {
      name: /^Alle virksomheter, Trykk for å fjerne alle/u,
    });
    await expect(summary).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(chips).toHaveCount(0);
    await expect(input).toBeFocused();
  },
);

test(
  '«Velg alle» and «Tøm» are read out in the status region of the panel',
  MOCK,
  async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');
    await page.goto('/');
    const { field } = organisations(page);
    // The view's own region, not the one «Dine dokumenter» has.
    const region = page.locator('.filters-view > output');

    await field.getByRole('button', { name: 'Velg alle virksomheter' }).click();
    await expect(region).toHaveText(/^Alle \d+ virksomheter er valgt\.$/u);

    await field.getByRole('button', { name: 'Tøm virksomheter' }).click();
    await expect(region).toHaveText('Ingen virksomheter er valgt.');
  },
);
