import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, setColorScheme } from './a11y';
import { ask, MOCK, REAL_ANSWER } from './helpers';

/**
 * Search inside one answer (design/brukerreiser-2026-09-15.md, punkt 13).
 *
 * The sources panel has had a search with a counter and previous/next since
 * PR #26; the answer beside it had nothing, so a reader looking for one number
 * in a long answer had the browser's own find or nothing at all.
 *
 * What is asserted here is the thing unit tests cannot see: that the counter
 * and the highlights are the same set. The marks are rendered by
 * react-markdown and counted in the DOM afterwards, so «7 treff» and seven
 * `<mark>` elements agreeing is the whole correctness claim.
 */
test.describe('søk i svaret', () => {
  /*
   * Uten dette ruller siden mykt til det gjeldende treffet, og Playwright
   * nekter å klikke på en knapp som beveger seg («element is not stable»).
   * Det er ikke en omgåelse: hooken spør `prefers-reduced-motion` selv, så
   * dette er den veien en leser med den innstillingen faktisk går.
   */
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
    await page.getByRole('button', { name: 'Søk i svaret' }).click();
  });

  const field = (page: import('@playwright/test').Page) =>
    page.getByRole('searchbox', { name: 'Søk i svaret' });
  const marks = (page: import('@playwright/test').Page) => page.locator('mark.ka-answer-mark');
  const current = (page: import('@playwright/test').Page) =>
    page.locator('mark.ka-answer-mark[data-current="true"]');
  // Telleren i svarets egen stripe. Kildepanelet har en med samme ordlyd, og
  // «Ingen treff» finnes dessuten som tekst i flere forfedre.
  const status = (page: import('@playwright/test').Page) =>
    page.locator('.ka-answer-search__count');

  test('telleren og markeringene er det samme settet', REAL_ANSWER, async ({ page }) => {
    await field(page).fill('mål');
    await expect(status(page)).toHaveText(/^1 av \d+ treff$/);

    const teller = await status(page).innerText();
    const antall = Number(/av (\d+) treff/.exec(teller)?.[1]);
    // Det er hele poenget: tallet beskriver markeringene på skjermen, og
    // markeringene tegnes av react-markdown — så de må telles der de er.
    await expect(marks(page)).toHaveCount(antall);
    await expect(current(page)).toHaveCount(1);
  });

  test('forrige og neste går gjennom treffene og stopper i endene', MOCK, async ({ page }) => {
    await field(page).fill('mål');
    await expect(status(page)).toHaveText('1 av 7 treff');

    const forrige = page.getByRole('button', { name: 'Forrige treff i svaret' });
    const neste = page.getByRole('button', { name: 'Neste treff i svaret' });

    /*
     * Fra tastaturet og ikke med musepekeren. Stripa står nederst i
     * svarkortet, så et treff øverst i et langt svar ruller den ut av syne —
     * og en knapp som beveger seg er en knapp Playwright ikke vil klikke på.
     * Tastaturet er dessuten veien som betyr mest her: leseren står i feltet
     * og skal kunne gå gjennom treffene uten å ta hånda fra tastene.
     */
    await expect(forrige).toHaveAttribute('aria-disabled', 'true');
    await forrige.focus();
    await page.keyboard.press('Enter');
    // Den første enden holder (brukerblikk 2026-09-15, funn 11).
    await expect(status(page)).toHaveText('1 av 7 treff');

    await neste.focus();
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('2 av 7 treff');
    // Og det gjeldende treffet er rullet fram til leseren.
    await expect(current(page)).toBeInViewport();

    // Tastaturet blir i knappen, så neste trykk lander samme sted.
    await expect(neste).toBeFocused();
  });

  test(
    'sier fra når det er skrevet for lite, og når ingenting ble funnet',
    REAL_ANSWER,
    async ({ page }) => {
      await field(page).fill('m');
      await expect(status(page)).toHaveText('Skriv minst 2 tegn');
      await expect(marks(page)).toHaveCount(0);

      await field(page).fill('romfart');
      await expect(status(page)).toHaveText('Ingen treff');
      await expect(marks(page)).toHaveCount(0);
    },
  );

  test('Escape lukker søket og gir fokus tilbake til knappen', MOCK, async ({ page }) => {
    await field(page).fill('mål');
    await expect(marks(page)).toHaveCount(7);

    await page.keyboard.press('Escape');

    const toggle = page.getByRole('button', { name: 'Søk i svaret' });
    await expect(field(page)).toHaveCount(0);
    await expect(marks(page)).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('0 axe i lys og mørk, med treff på skjermen', MOCK, async ({ page }) => {
    await field(page).fill('mål');
    await expect(status(page)).toHaveText('1 av 7 treff');

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);
      await expectNoAxeViolations(page, `søk i svaret i ${mode}`);
    }
  });
});
