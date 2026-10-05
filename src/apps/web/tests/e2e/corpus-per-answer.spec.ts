import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';
import { ask, openSources, showThreads, MOCK } from './helpers';

/**
 * Fraskrivelsen over kildene navngir korpuset **svaret** kom fra.
 *
 * Setningen er en påstand om hvor hvert ord i panelet stammer fra, og den var
 * «fra Kudos» uansett korpus til #129. Den ble bygget av `corpusDisplayName`
 * der, men av det korpuset som står VALGT — og et valg er noe leseren kan
 * endre etter at svaret kom. #135 la korpuset på svaret; denne vakta er det
 * som holder de to fra å gli fra hverandre igjen.
 *
 * **Hvorfor det trengs to spørsmål og et trådbytte.** En test som spør én
 * gang per korpus er grønn i begge verdener: der setningen følger svaret, og
 * der den følger valget, fordi de to er like så lenge ingen har byttet siden
 * svaret kom. Det som skiller dem er å se på et svar mens et ANNET korpus
 * står valgt, og etter #133 er det bare én vei dit: åpne en eldre tråd.
 * Derfor ser testen slik ut.
 *
 * Mocken har to korpus fra #131 — uten det kunne dette bare vært en
 * enhetstest (KA CC på #129).
 */

const KUDOS = 'Kudos';
const WIKIPEDIA = 'Wikipedia (mock)';

/** Fraskrivelsen i kildepanelet, som er der påstanden står. */
function disclaimer(page: Page) {
  return page.locator('aside .sources-search__description');
}

/**
 * Bytter korpus i filterpanelet.
 *
 * Etter #133 tømmer et bytte skjermen og starter en ny tråd, så dette er også
 * måten å komme til en tom skjerm på uten å laste om.
 */
async function chooseCorpus(page: Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Korpus' }).selectOption({ label });
  await expect(page.locator('.filters-view__corpus-source')).toContainText(label);
}

test.describe('korpuset følger svaret', () => {
  test('et ferskt svar navngir korpuset det ble hentet fra', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'korpus per svar: fraskrivelsen navngir svarets korpus (#135)');
    await page.goto('/');

    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
    await openSources(page, 1);
    await expect(disclaimer(page)).toContainText(`fra ${KUDOS}`);

    await chooseCorpus(page, WIKIPEDIA);
    await ask(page, 'Hva handler dokumentene i dette korpuset om?');
    await openSources(page, 1);
    await expect(disclaimer(page)).toContainText(`fra ${WIKIPEDIA}`);
  });

  /*
   * Dette er halvdelen som ikke fantes da vakta ble skrevet.
   *
   * Målt rød på `main 3bbaf51`, som var #135 og ikke mer: åpner man
   * Kudos-tråden mens «Wikipedia (mock)» står valgt, sto det «All tekst er
   * sitater fra dokumentene fra Wikipedia (mock)» over kildekortet
   * «Årsrapport Nasjonal kommunikasjonsmyndighet 2025» — `SourcesView` leste
   * korpuset fra butikken og ikke fra svaret. #138 skriver nøkkelen på svaret
   * og #139 leser den, og da ble den grønn uten at noe annet i fila ble rørt.
   */
  test(
    'en eldre tråd navngir sitt eget korpus, ikke det som står valgt',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'korpus per svar: fraskrivelsen navngir svarets korpus (#135)');
      await page.goto('/');

      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      const kudosThread = page.url();

      await chooseCorpus(page, WIKIPEDIA);
      await ask(page, 'Hva handler dokumentene i dette korpuset om?');

      // Tilbake til Kudos-tråden, med Wikipedia fortsatt valgt.
      await showThreads(page);
      await page.goto(kudosThread);
      await expect(page.getByRole('combobox', { name: 'Korpus' })).toHaveValue(/norquad-mock/);

      await openSources(page, 1);
      await expect(
        disclaimer(page),
        'fraskrivelsen skal navngi korpuset svaret kom fra, ikke det som står valgt',
      ).toContainText(`fra ${KUDOS}`);
    },
  );
});
