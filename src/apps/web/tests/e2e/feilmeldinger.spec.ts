import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, setColorScheme } from './a11y';
import { composer, MOCK } from './helpers';

/**
 * The failure the reader meets, one case at a time.
 *
 * «Noe gikk galt» covered a language model that was down, a corpus that was
 * down, a request that timed out and a search that found nothing — four
 * situations that need four different things from the reader
 * (design/brukerreiser-2026-09-15.md, punkt 12). These questions are the only
 * way into those states from a built app; see `MOCK_ERROR_QUERIES` in
 * src/api/mock/MockChatClient.ts for why they exist at all.
 *
 * The heading is what is asserted rather than the whole sentence: it is the
 * part that says which case this is, and a wording review can change the
 * sentences under it without taking the suite red.
 */
const ERROR_CASES = [
  { query: 'simuler feil modell', heading: 'Assistenten svarte ikke', retry: true },
  { query: 'simuler feil korpus', heading: 'Søket i dokumentene svarte ikke', retry: true },
  { query: 'simuler tidsavbrudd', heading: 'Svaret tok for lang tid', retry: true },
  { query: 'simuler avvist nøkkel', heading: 'Ingen tilgang', retry: false },
] as const;

/** Types a question into the compose field and sends it. */
async function askFor(page: import('@playwright/test').Page, query: string): Promise<void> {
  await page.goto('/');
  await composer(page).click();
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');
}

test.describe('feilmeldinger skiller tilfellene', () => {
  for (const { query, heading, retry } of ERROR_CASES) {
    test(`«${query}» sier hva som skjedde`, MOCK, async ({ page }) => {
      await askFor(page, query);

      // Scoped to the main column: every view that can fail renders its own
      // alert region, and the chat's is the one under test.
      const alert = page.getByRole('main').getByRole('alert');
      await expect(alert).toContainText(heading);

      const retryButton = alert.getByRole('button', { name: 'Prøv igjen' });
      if (retry) {
        await expect(retryButton).toBeVisible();
      } else {
        // The same question with the same key fails the same way; a button
        // that cannot work sends the reader round the loop.
        await expect(retryButton).toHaveCount(0);
      }

      // Once, and it is the button (brukerblikk 2026-09-15, funn 9).
      const occurrences = await page.evaluate(
        () => (document.querySelector('main')?.innerText.match(/Prøv igjen/g) ?? []).length,
      );
      expect(occurrences, '«Prøv igjen» står der knappen står, og ingen andre steder').toBe(
        retry ? 1 : 0,
      );
    });
  }

  test('to feil leser forskjellig, ikke bare «noe gikk galt»', MOCK, async ({ page }) => {
    const headings: string[] = [];
    for (const { query } of ERROR_CASES) {
      await askFor(page, query);
      const alert = page.getByRole('main').getByRole('alert');
      await expect(alert).not.toHaveText('');
      headings.push((await alert.innerText()).split('\n')[0]);
    }

    expect(new Set(headings).size, 'hver feil har sin egen overskrift').toBe(ERROR_CASES.length);
  });

  test('«Prøv igjen» tar fokus med seg videre', MOCK, async ({ page }) => {
    await askFor(page, 'simuler feil modell');

    const retry = page.getByRole('main').getByRole('alert').getByRole('button', {
      name: 'Prøv igjen',
    });
    await expect(retry).toBeVisible();
    await retry.focus();
    await retry.press('Enter');

    // The button removed itself by doing its job. Focus must land somewhere a
    // keyboard user can carry on from, never on `body`.
    const landed = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(landed, 'fokus skal ikke falle til body etter «Prøv igjen»').not.toBe('body');
  });

  test('feilen tar over fokus fra knappen som forsvant', MOCK, async ({ page }) => {
    await page.goto('/');

    /*
     * Sendt med museklikk: fokus står på «Send spørsmålet», som blir «Avbryt
     * genereringen» og så «Send spørsmålet» igjen — slått av, fordi feltet er
     * tomt. Da faller fokus til body ett bilde etter at feilen kom (#4, funn
     * B). «Prøv igjen» er det ene å gjøre videre, så det er dit det skal.
     */
    await composer(page).fill('simuler feil');
    await page.getByRole('button', { name: 'Send spørsmålet' }).click();

    const retry = page.getByRole('main').getByRole('alert').getByRole('button', {
      name: 'Prøv igjen',
    });
    await expect(retry).toBeFocused();
  });

  test('uten «Prøv igjen» går fokus til skrivefeltet', MOCK, async ({ page }) => {
    await page.goto('/');

    await composer(page).fill('simuler avvist nøkkel');
    await page.getByRole('button', { name: 'Send spørsmålet' }).click();

    // En avvist nøkkel har ingen knapp å trykke på igjen, og veien videre er
    // å skrive til noen.
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Ingen tilgang');
    await expect(composer(page)).toBeFocused();
  });

  test('med Enter blir skrivemerket stående i feltet', MOCK, async ({ page }) => {
    await askFor(page, 'simuler feil');

    await expect(page.getByRole('main').getByRole('alert')).toContainText('Svaret kom ikke fram');
    // Enter etterlater skrivemerket i feltet, og en leser som skriver skal
    // ikke få det revet vekk.
    await expect(composer(page)).toBeFocused();
  });

  test('ingen treff er et svar, ikke en feil', MOCK, async ({ page }) => {
    await askFor(page, 'simuler ingen treff');

    // In the thread, where answers are — not in the alert region.
    const answer = page.locator('.ka-message--assistant');
    await expect(answer).toContainText('Fant ingen utdrag om dette i dokumentene');
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('');
    await expect(page.getByRole('button', { name: 'Prøv igjen' })).toHaveCount(0);

    // Og ingen oppfølgingsforslag: «Kan du utdype?» ber assistenten si mer om
    // ingenting, og de to andre leder tilbake til det samme tomme søket.
    await expect(page.getByRole('button', { name: 'Kan du utdype?' })).toHaveCount(0);

    // And the sources panel says the same thing rather than waiting for
    // excerpts that are not coming.
    await page.getByRole('button', { name: 'Vis kilder' }).click();
    const panel = page.getByRole('complementary');
    await expect(panel.getByText('Henter kilder …')).toHaveCount(0);
    await expect(panel.getByText('Ingen kilder til dette svaret')).toBeVisible();
  });

  test('0 axe i lys og mørk, både på feil og på ingen treff', MOCK, async ({ page }) => {
    for (const query of ['simuler feil korpus', 'simuler ingen treff'] as const) {
      await askFor(page, query);
      // Wait for the turn to settle before measuring: a skeleton mid-fade is
      // not the state under test.
      await expect(page.locator('.ka-answer-skeleton')).toHaveCount(0);

      for (const mode of ['light', 'dark'] as const) {
        await setColorScheme(page, mode);
        await expectNoAxeViolations(page, `${query} i ${mode}`);
      }
    }
  });
});
