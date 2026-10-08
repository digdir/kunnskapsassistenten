import { expect, test, type Locator, type Page } from '@playwright/test';
import { contrastAgainstBackdrop, covers, expectNoAxeViolations, setColorScheme } from './a11y';
import {
  ask,
  chooseFacetValue,
  citation,
  expectEveryStepReachable,
  facetField,
  showFilters,
  showThreads,
  walkWithTab,
  MOCK,
  REAL_ANSWER,
} from './helpers';

/**
 * The primary sidebar: the document filter and the thread list.
 *
 * Two views in one slot, and the panel switches between them. A first-time
 * user meets the filter (answer 1), so that is where every test starts.
 */
/**
 * «1 av N valgt», whatever N happens to be.
 *
 * It said «1 av 6 valgt» while the facets were six hand-written values. They
 * are now counted from the real Kudos corpus, where «Virksomheter» has 259 —
 * and it will be a different number the next time the corpus is fetched. What
 * this test is about is that picking one value shows one as picked, and that
 * does not depend on how large the corpus is.
 */
const SELECTED_ONE = /^1 av \d+ valgt$/;

/**
 * «Alle N valgt», whatever N happens to be — the sentence that must NOT be on
 * an untouched page. Same reason as above: it was written as «Alle 6 valgt»
 * against six hand-written values, and against the real corpus a literal 6
 * would pass without testing anything.
 *
 * Anchored at the start only. The sentence goes on — «Alle 457 valgt, altså
 * ingen avgrensning» since #183 — and anchored at both ends the pattern
 * matched nothing, which made the «must not be there» below true no matter
 * what the page said.
 */
const ALL_SELECTED = /^Alle \d+ valgt/;

test.describe('navigasjonspanelet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('en førstegangsbruker møter filtreringen, med de tre dimensjonene', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    await expect(panel.getByRole('heading', { name: 'Filtrering' })).toBeVisible();

    for (const dimension of ['Dokumenttyper', 'Virksomheter', 'År']) {
      await expect(facetField(page, dimension)).toBeVisible();
    }

    // Nothing selected is «no restriction», and the description says that and
    // not «Alle valgt» — an untouched field and one where every value has been
    // picked used to read word for word the same (brukerblikk, funn 3).
    await expect(panel.getByText('Ingen avgrensning').first()).toBeVisible();
    await expect(panel.getByText(ALL_SELECTED)).toHaveCount(0);

    await expectNoAxeViolations(page, 'filtreringen');
  });

  test(
    'et valg blir en chip i feltet, og tellingen følger med',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'filtre kan velges og gir chips');

      // The whole name, not a prefix. `ArrowDown` + `Enter` takes the first
      // match, and «Nasjonal» matched six organisations in the real corpus —
      // the first of them «Nasjonalarkivet», which is not the one this test
      // then looks for. Typed in full there is one match and it is that one.
      const field = facetField(page, 'Virksomheter');
      await field.click();
      await page.keyboard.type('Nasjonal kommunikasjonsmyndighet');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // The chip lives in the Suggestion's shadow root, so it is read through
      // the accessible name rather than a CSS selector.
      await expect(
        page.getByRole('navigation', { name: 'Tråder og filter' }).getByText(SELECTED_ONE),
      ).toBeVisible();

      const chips = await page.evaluate(() => {
        const suggestions = [...document.querySelectorAll('ds-suggestion')];
        return suggestions.flatMap((suggestion) =>
          [...suggestion.querySelectorAll('data')].map((chip) => chip.textContent?.trim() ?? ''),
        );
      });
      expect(chips).toContain('Nasjonal kommunikasjonsmyndighet');

      // The search text is spent once the value is a chip.
      await expect(field).toHaveValue('');

      await expectNoAxeViolations(page, 'filtreringen med et valg');
    },
  );

  /*
   * Enter straight after the text, with no arrow first. ds-suggestion labels
   * «Ingen treff» with the text typed and gives it no value, and Enter
   * chooses the first option whose label is the text. With «Ingen treff»
   * first in the list that was it, even on «2024»: a chip with no value and
   * no text, and «1 av N valgt» (review of #287). `chooseFacetValue` and the
   * test above went through ArrowDown only, so no test pressed Enter alone.
   * The helper now can (`{ via: 'enter' }`); this test also reads the chip's
   * value, which the helper does not.
   *
   * `@mock` because the year has to be in the corpus.
   */
  test('Enter rett etter «2024» velger året, uten pil først', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');

    const input = facetField(page, 'År');
    await input.click();
    await page.keyboard.type('2024');
    await page.keyboard.press('Enter');

    const field = input.locator('xpath=ancestor::ds-field');
    const chips = field.locator('ds-suggestion > data');
    await expect(chips).toHaveText(['2024']);
    await expect(chips).toHaveAttribute('value', '2024');
    await expect(field.getByText(SELECTED_ONE)).toBeVisible();
    await expect(input).toHaveValue('');
  });

  /*
   * The filters first, and the corpus's documents under the line (issue 76b,
   * round 2). This test used to hold the opposite: that the list
   * of documents from Kudos stood above the fold in a 900 px window
   * (brukerblikk runde 2, funn 4). The design moved the corpus line and the
   * list under the line before «Dine dokumenter», so the fields the reader
   * narrows with are what the panel opens on, and the list is what the answer
   * found. No new line of its own: the one line in the panel is the one that
   * was there.
   */
  test(
    'filtrene står over skillelinja, og dokumentene fra Kudos under den',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'issue 76b: filtrene øverst, dokumentene under skillelinja');
      await page.goto('/');
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
      const documents = panel.locator('.filters-view__documents');
      await expect(documents.locator('.documents-list__list li').first()).toBeVisible();

      const box = async (locator: Locator) => (await locator.boundingBox())!;
      const lastField = await box(facetField(page, 'År'));
      const line = await box(panel.locator('.filters-view__divider'));
      const block = await box(documents);
      const own = await box(panel.getByRole('heading', { name: 'Dine dokumenter' }));

      // Top to bottom: the fields, the line, the corpus's documents, and the
      // reader's own.
      expect(lastField.y + lastField.height, 'feltene står over linja').toBeLessThanOrEqual(line.y);
      expect(line.y, 'dokumentene står under linja').toBeLessThan(block.y);
      expect(block.y + block.height, 'og over «Dine dokumenter»').toBeLessThanOrEqual(own.y);

      // The corpus line went down with the list.
      await expect(documents.getByText(/^Dokumenter fra /)).toBeVisible();

      await expect(panel.locator('.filters-view hr')).toHaveCount(1);
    },
  );

  test('«Velg alle» og «Tøm» lar tastaturet bli i feltet', async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: kontroller som forsvinner må si hvor fokus skal');

    const selectAll = page.getByRole('button', { name: 'Velg alle dokumenttyper' });
    await selectAll.focus();
    await selectAll.press('Enter');
    // The button removed itself by doing its job; focus must not be on body.
    await expect(facetField(page, 'Dokumenttyper')).toBeFocused();

    const clear = page.getByRole('button', { name: 'Tøm dokumenttyper' });
    await clear.focus();
    await clear.press('Enter');
    await expect(facetField(page, 'Dokumenttyper')).toBeFocused();
  });

  test('vekslingen mellom filter og tråder gir fokus til knappen i det nye viewet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelet veksler mellom filter og tråder');

    const toThreads = page.getByRole('button', { name: 'Tråder', exact: true });
    await toThreads.focus();
    await toThreads.press('Enter');
    await expect(page.getByRole('button', { name: 'Filtrer dokumenter' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Tråder', exact: true })).toBeFocused();
  });

  /**
   * N6 in `design/funksjonssjekk-v1.md`, which stood unverified: #2 saw it
   * work in a browser on 2026-09-11 and the conductor's script could not
   * settle it.
   *
   * What is at stake is an architecture claim, not a feature. The two views
   * are modes of one slot, so switching UNMOUNTS the filter view completely —
   * chips, counts and all. The selection survives only because it lives in
   * `LayoutProvider` and not in the view, which is the same reason the chat
   * view can read it (see filterContext.ts). A regression here would look
   * like an ordinary refactor: move the state into `FiltersView` where it
   * seems to belong, and nothing fails except this.
   *
   * Every read of the chips goes through `expect.poll`. Suggestion renders a
   * chosen value a tick after Enter, so a plain read right after the keypress
   * returns an empty list — which is how both of these first failed, against
   * a product that was doing the right thing.
   */
  const chipTexts = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('ds-suggestion')].flatMap((suggestion) =>
        [...suggestion.querySelectorAll('data')].map((chip) => chip.textContent?.trim() ?? ''),
      ),
    );

  test(
    'filtervalget overlever veksling til trådene og tilbake',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'filtervalget overlever veksling (N6)');

      // Two dimensions, not one: a selection kept per field and a selection
      // kept for the panel as a whole fail differently, and one field cannot
      // tell them apart.
      await chooseFacetValue(page, 'Virksomheter', 'Nasjonal kommunikasjonsmyndighet');
      await chooseFacetValue(page, 'Dokumenttyper', 'Årsrapport');

      const before = (await chipTexts(page)).sort();

      await showThreads(page);
      // Gone from the DOM, not merely hidden. If the panel only hid the view,
      // this test would pass while proving nothing.
      await expect(facetField(page, 'Virksomheter')).toHaveCount(0);

      await showFilters(page);

      await expect
        .poll(async () => (await chipTexts(page)).sort(), {
          message: 'chipsene er de samme etter veksling',
        })
        .toEqual(before);

      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
      await expect(panel.getByText(SELECTED_ONE).first()).toBeVisible();
      // And the field is back to a resting state rather than holding the search
      // text that produced the chip.
      await expect(facetField(page, 'Virksomheter')).toHaveValue('');
    },
  );

  test(
    'filtervalget overlever at brukeren åpner en tråd og går tilbake',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'filtervalget overlever ruteskifte');

      await chooseFacetValue(page, 'Virksomheter', 'Nasjonal kommunikasjonsmyndighet');

      // A route change is the harder case and the one a user actually does:
      // open a thread from the list, then go back to the filter. The provider
      // sits above `Routes` in App.tsx, so the selection is expected to hold —
      // this is the test that says so out loud.
      await showThreads(page);
      await page.getByRole('link', { name: 'NKOM måloppnåelse' }).click();
      await expect(page).toHaveURL(/\/threads\/nkom-maaloppnaaelse$/);

      await showFilters(page);
      await expect
        .poll(() => chipTexts(page), { message: 'valget overlevde ruta' })
        .toContain('Nasjonal kommunikasjonsmyndighet');

      await expectNoAxeViolations(page, 'filtreringen på en trådrute');
    },
  );

  test('trådene er gruppert på tidsrom, nyeste først', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'tråder er gruppert');
    await showThreads(page);

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    const groups = panel.locator('.threads-view__group h3');

    // Answer 6: today, then two relative periods, then month names, then
    // years. The first three are fixed; what follows depends on today's date,
    // so only the order is asserted, not the names.
    await expect(groups.nth(0)).toHaveText('I dag');
    await expect(groups.nth(1)).toHaveText('Siste 7 dager');
    await expect(groups.nth(2)).toHaveText('Siste 30 dager');
    expect(await groups.count()).toBeGreaterThan(3);

    await expectNoAxeViolations(page, 'trådlista');
  });

  /**
   * Punkt 3 i brukerblikket: «den jeg kjørte før møtet på tirsdag» var
   * ubesvarlig i en liste der det eneste på skjermen var en tittel.
   *
   * Den viktigste påstanden her er ikke at klokka vises, men at den står
   * UTENFOR lenka. Inni ville tida blitt en del av lenkens tilgjengelige
   * navn, og hver rad ville hett «NKOM måloppnåelse 14:32» — et navn som
   * endrer seg mens du ser på det, og som ingen kan be om med stemmen.
   */
  test(
    'hver trådrad sier når den sist ble rørt, uten å bli hetende det',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'tidsstempel på trådradene');
      await showThreads(page);

      const rows = page.locator('.threads-view__item');
      await expect(rows.first()).toBeVisible();
      const count = await rows.count();
      expect(count, 'lista har rader å se på').toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        const time = row.locator('time');
        await expect(time, `rad ${index} har et tidsstempel`).toHaveCount(1);

        const { dateTime, title, text, insideLink } = await time.evaluate((element) => ({
          dateTime: element.getAttribute('datetime') ?? '',
          title: element.getAttribute('title') ?? '',
          text: element.textContent?.trim() ?? '',
          insideLink: element.closest('a') !== null,
        }));

        // Unntak fra dirigenten for denne påstanden (23.09): hele raden
        // er lenka nå, tidsstempelet med, så den som trykker under tittelen
        // åpner tråden i stedet for ingenting. Navnet er fortsatt tittelen
        // alene — se påstanden nederst i testen.
        expect(insideLink, `rad ${index}: tida står inne i lenka`).toBe(true);
        expect(Number.isNaN(Date.parse(dateTime)), `rad ${index}: datetime er lesbar`).toBe(false);
        expect(title.length, `rad ${index}: title har hele datoen`).toBeGreaterThan(text.length);
        // Kort, fordi den leses ved siden av en gruppeoverskrift som alt sier
        // omtrent når. «onsdag» er det lengste formatet.
        expect(text.length, `rad ${index}: teksten er kort`).toBeLessThanOrEqual(12);
      }

      // Og navnet på lenka er tittelen, ikke tittelen pluss et klokkeslett.
      // Teksten i raden bærer begge deler; navnet kommer fra `aria-labelledby`,
      // som peker på tittel-spannet alene.
      const firstLink = page.locator('.threads-view__item a').first();
      const name = await firstLink.evaluate((element) => {
        const id = element.getAttribute('aria-labelledby');
        const labelled = id ? document.getElementById(id) : null;
        return (labelled?.textContent ?? element.textContent ?? '').trim();
      });
      const firstTime = (await rows.first().locator('time').textContent())?.trim() ?? '';
      expect(name, 'lenkens navn bærer ikke tidsstempelet').not.toContain(firstTime);
    },
  );

  /**
   * Punkt 11: ordet «Kudos» sto ingen steder en førstegangsbruker kunne se
   * det, og ingenting sa hvor mye det er eller hvilke år det dekker.
   *
   * Den andre halvdelen av testen er regelen som er lett å miste: linja
   * beskriver KORPUSET, ikke utsnittet. Huker leseren av en verdi, skal den
   * stå helt stille — ellers påstår den at arkivet krympet fordi noen trykket
   * på en boks.
   */
  test(
    'filterpanelet sier hvor svarene kommer fra, og linja står stille',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'korpuslinja under «Filtrering»');

      const corpus = page.locator('.filters-view__corpus');
      const detail = corpus.locator('.filters-view__corpus-detail');
      await expect(corpus).toBeVisible();
      /*
       * Until the facets are in. The fields load above the line and push it
       * 239 px down at 1440 × 900 (y 580 to 819), so a click while the panel
       * is busy can land where the button was: CI on 652cc8c clicked at
       * y 592 as the facets arrived, and the detail stayed hidden.
       */
      await expect(page.locator('.filters-view')).not.toHaveAttribute('aria-busy', 'true');

      /*
       * Navnet står på linja, resten ligger bak «Vis mer» (#114, N2 i
       * høydebudsjettet): hele setningen brøt til to linjer i et 327 px panel.
       * Det korpuset heter er det som endrer seg ved bytte, så det er halvdelen
       * som blir stående.
       */
      await expect(corpus.locator('.filters-view__corpus-source')).toHaveText(
        'Dokumenter fra Kudos',
      );
      await expect(detail).toBeHidden();

      await corpus.getByRole('button', { name: 'Vis mer' }).click();
      await expect(detail).toBeVisible();
      // Tall og årsspenn, hentet fra fasettene og ikke skrevet inn: at det står
      // et antall og et spenn er påstanden, ikke hvilke.
      await expect(detail).toHaveText(/\d[\d\s\u00a0]* dokumenter/);
      await expect(detail).toHaveText(/\d{4}(–\d{4})?$/);

      const before = await detail.textContent();
      await chooseFacetValue(page, 'Dokumenttyper', 'Årsrapport');
      await expect(detail, 'korpuslinja følger korpuset, ikke utvalget').toHaveText(before ?? '');
    },
  );

  /*
   * Nothing under the filter fields moves when the facets come. The skeleton
   * used to be 200 px where the three fields are 439, so the corpus line and
   * «Vis mer» jumped 239 px down at 1440 and 235 at 390, and a click aimed at
   * «Vis mer» while the panel loaded could land on what came there instead.
   *
   * The clock is paused before the page loads, so the mock's facets wait until
   * it is let go: the position is read while the panel is busy, every time,
   * and not when the race happens to allow it. Measured from the top of the
   * view, so the drawer sliding in at 390 does not count as a jump.
   */
  test(
    '«Vis mer» står stille når fasettene kommer, på 1440 og 390',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'filterpanelet hopper ikke når fasettene kommer');
      await page.clock.install({ time: new Date('2026-10-07T08:00:00') });

      const sizes = [
        { width: 1440, height: 900, pause: '2026-10-07T08:00:01' },
        { width: 390, height: 844, pause: '2026-10-07T09:00:00' },
      ];
      for (const size of sizes) {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.clock.pauseAt(new Date(size.pause));
        await page.goto('/');
        if (size.width < 1000) {
          await page.getByRole('button', { name: 'Vis tråder og filter' }).click();
        }

        const view = page.locator('.filters-view:has(.filters-view__corpus)');
        const more = view.locator('.filters-view__corpus').getByRole('button', { name: 'Vis mer' });
        const top = () =>
          more.evaluate(
            (button) =>
              button.getBoundingClientRect().top -
              (button.closest('.filters-view')?.getBoundingClientRect().top ?? 0),
          );

        await expect(more).toBeVisible();
        await expect(view, `fasettene er holdt igjen på ${size.width}`).toHaveAttribute(
          'aria-busy',
          'true',
        );
        const loading = await top();

        // The placeholders are there for their size only: a screen reader
        // reads no «Velg alle», and the keyboard cannot reach them. Soft, as
        // the jump below is, so every failure at both widths is reported.
        await expect.soft(view.getByRole('button', { name: 'Velg alle' })).toHaveCount(0);
        await expect
          .soft(view.locator('.field-placeholder').first())
          .toHaveJSProperty('inert', true);

        await page.clock.resume();
        await expect(view).not.toHaveAttribute('aria-busy', 'true');
        await expect(facetField(page, 'Dokumenttyper')).toBeVisible();
        const loaded = await top();

        expect
          .soft(
            Math.abs(loaded - loading),
            `«Vis mer» flyttet seg fra ${loading} til ${loaded} på ${size.width}`,
          )
          .toBeLessThanOrEqual(1);
      }
    },
  );

  test(
    'søk i tråder filtrerer lista og sier hvor mange treff',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'søk i tråder gir treffteller');
      await showThreads(page);

      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
      const search = panel.getByRole('searchbox', { name: 'Søk i tråder' });

      // The counter is a live region and must exist before it has anything to
      // say: a region that appears together with its text announces nothing.
      const counter = panel.locator('output.threads-view__search-status');
      await expect(counter).toBeAttached();
      await expect(counter).toHaveText('');

      // «stimulab» fram til 15.09, da trådlista ble de scriptede samtalene og
      // de to Stimulab-titlene forsvant med resten av titlene uten samtale
      // under. «årsrapport» treffer to av de nye og ingen andre.
      await search.fill('årsrapport');
      await expect(counter).toHaveText('2 tråder');
      await expect(panel.locator('.threads-view__thread')).toHaveCount(2);

      await search.fill('finnesikke');
      await expect(counter).toHaveText('0 tråder');
      await expect(panel.getByText('Ingen treff')).toBeVisible();

      await search.fill('');
      await expect(counter).toHaveText('');
    },
  );

  test(
    'en trådrad er en lenke, og den valgte er merket for skjermleser',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'tråder er gruppert');
      await showThreads(page);

      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
      const first = panel.getByRole('link', { name: 'NKOM måloppnåelse' });
      await first.click();

      await expect(page).toHaveURL(/\/threads\/nkom-maaloppnaaelse$/);
      // aria-current, not colour, is what carries «you are here».
      await expect(panel.locator('[aria-current="page"]')).toHaveCount(1);
      // Navnet, ikke teksten: hele raden er lenka siden 23.09, så tid og korpus
      // står inni den — men `aria-labelledby` holder navnet på tittelen alene.
      // Unntak fra dirigenten for denne påstanden, som de to andre i runden.
      await expect(panel.locator('[aria-current="page"]')).toHaveAccessibleName(
        'NKOM måloppnåelse',
      );
    },
  );

  test(
    'en tråd fra lista åpner en hel samtale, med kildene bak svaret',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'tråder er gruppert');
      // Punkt 16 på brukerreise-lista, målt av #4: radene var titler uten noe
      // under seg, så elleve av tolv tråder åpnet en tom samtale. Nå er lista
      // de scriptede samtalene, og dette er påstanden — en rad du klikker på er
      // et spørsmål, et svar og kildene bak det.
      await showThreads(page);

      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
      await panel
        .getByRole('link', { name: 'Regnskap og bevilgning i DSS sine årsrapporter' })
        .click();
      await expect(page).toHaveURL(/\/threads\/dss-regnskap$/);

      const main = page.getByRole('main');
      await expect(main.getByText('Hva rapporteres om regnskap', { exact: false })).toBeVisible();
      await expect(
        main.getByRole('heading', { name: 'Regnskap og bevilgning hos DSS' }),
      ).toBeVisible();

      // Kildene er det som skilte en scriptet samtale fra en tom tråd. Markøren
      // åpner panelet og peker på et utdrag som faktisk er der.
      await citation(page, 1).click();
      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
      await expect(
        page
          .getByRole('complementary', { name: 'Kilder' })
          .getByRole('heading', { level: 3 })
          .first(),
      ).toBeVisible();
    },
  );

  /**
   * Den samme påstanden om en tråd leseren nettopp lagde.
   *
   * Tilstanden ingen hadde målt: testen over åpner en tråd som alt lå i lista,
   * og reload-testen i `samtale.spec.ts` sjekker `aria-current` **etter** en
   * reload. Mellom de to ligger den vanligste veien inn — du stiller et
   * spørsmål, tråden blir din, og du åpner lista for å se hvor du er.
   *
   * Var rød fra 15.09 til #63: raden lå der, først, med riktig `href` og uten
   * `aria-current`, fordi tråd-URL-en settes med `replaceState`, som `NavLink`
   * aldri ser. #63 flyttet spørsmålet dit svaret finnes — skallet vet hvilken
   * samtale som er på skjermen uansett hvordan adressen kom dit — og testen
   * ble grønn av den endringen og ikke av noe annet: målt rød på `main`
   * `6272d14` og grønn på `e9dff1a`.
   *
   * For en skjermleser er en åpen tråd uten `aria-current` det samme som en
   * tråd som ikke er åpen.
   *
   * Den dekker rekkefølgen «spør, så åpne lista». Den andre rekkefølgen —
   * lista alt åpen når du spør — mangler fortsatt, men av en eldre grunn:
   * `ThreadsView` henter trådene én gang ved montering, så den nye tråden er
   * ikke i lista i det hele tatt (11 rader, målt på både `main` og #63). Den
   * testen hører hjemme sammen med oppfriskningen.
   */
  test(
    'tråden du nettopp lagde er merket som den åpne, uten reload',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'egen tråd merket som åpen uten reload');
      await page.goto('/');
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      await expect(page).toHaveURL(/\/threads\/[\w-]+$/);
      const id = page.url().split('/').pop();

      await showThreads(page);
      const panel = page.getByRole('navigation', { name: 'Tråder og filter' });

      // Raden finnes og ligger først — det er ikke det som mangler.
      const row = panel.locator(`a[href="/threads/${id}"]`);
      await expect(row).toHaveCount(1);
      await expect(panel.locator('a[href^="/threads/"]').first()).toHaveAttribute(
        'href',
        `/threads/${id}`,
      );

      // Dette er påstanden: den er merket som den åpne, nå, ikke etter en reload.
      await expect(row).toHaveAttribute('aria-current', 'page');
      await expect(panel.locator('[aria-current="page"]')).toHaveCount(1);
    },
  );

  /**
   * Den ene tilstanden ingen hadde målt — og som axe heller ikke måler.
   *
   * En påstand om 4,05:1 på option-teksten sto åpen i to dager. Både #2 og jeg
   * målte den uavhengig og fant 14,11:1 i lys og 12,6:1 i mørk over 275
   * options, men begge målingene leste `getComputedStyle`. Testen her ble
   * skrevet for å legge axe oppå, med den begrunnelsen at axe ser det
   * `getComputedStyle` ikke ser.
   *
   * **Det gjør den ikke.** Målt 2026-09-17, i begge moduser: i denne tilstanden
   * gir axe elleve `incomplete` på `color-contrast`, fire av dem options, den
   * framhevede raden blant dem, og null options i `passes`. Meldingen er
   * «Element's background color could not be determined because it is
   * overlapped by another element» — nedtrekket ligger over resten av panelet,
   * og da avstår axe. `expectNoAxeViolations` leser `violations`, så den kan
   * ikke bli rød av en rad axe aldri dømte.
   *
   * Derfor måles tallene her i tillegg. `expectNoAxeViolations` blir stående,
   * for den fanger alt det andre i tilstanden.
   *
   * Og framhevingen er ikke en flatefarge: målt er den Designsystemets ring,
   * `outline: solid 3px` med en innfelt `box-shadow` i motsatt tone, satt på
   * raden gjennom `data-activedescendant`. Teksten på en framhevet rad har
   * altså samme farge som på en rad ved siden av, og det som er nytt å måle er
   * ringen — et ikke-tekstlig element med 3:1 som krav, ikke 4,5:1.
   */
  for (const mode of ['light', 'dark'] as const) {
    test(`en åpen fasettliste med framhevet rad er kontrastsjekket i ${mode}`, async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'kontrast i åpen fasettliste');
      await setColorScheme(page, mode);

      const field = facetField(page, 'Virksomheter');
      await field.click();
      // ArrowDown åpner lista og framhever første rad. Designsystemets
      // Suggestion holder fokus på inputen og peker på raden med
      // `aria-activedescendant`.
      await page.keyboard.press('ArrowDown');
      // `:visible`, fordi alle tre listene har options i DOM-en hele tiden og
      // bare den åpne er synlig.
      await expect(page.locator('[role="option"]:visible').first()).toBeVisible();

      // Raden som faktisk er framhevet, hentet gjennom `aria-activedescendant`
      // og ikke som `.first()`: 275 options ligger i DOM-en samtidig, og en
      // måling på feil rad er verre enn ingen måling.
      const highlighted = await field.getAttribute('aria-activedescendant');
      expect(highlighted, 'ArrowDown skal ha framhevet en rad').toBeTruthy();

      // `keepFocus`, ellers måler axe en lukket liste: standarden i `settle`
      // blurrer, og nedtrekket lever på fokus. Se `a11y.ts`.
      // `keepFocus`, ellers måler axe en lukket liste: standarden i `settle`
      // blurrer, og nedtrekket lever på fokus. Se `a11y.ts`.
      await expectNoAxeViolations(page, `åpen fasettliste med framhevet rad i ${mode}`, {
        keepFocus: true,
      });

      // Og lista sto faktisk åpen mens axe så på den. Uten denne påstanden er
      // det ingenting som sier at kjøringen over målte tilstanden testen
      // heter etter — som er nøyaktig slik den kunne stå grønn i to dager.
      await expect(
        page.locator('[role="option"]:visible'),
        'lista skal fortsatt være åpen etter axe-kjøringen',
      ).not.toHaveCount(0);
      await expect(field, 'raden skal fortsatt være framhevet etter axe-kjøringen').toHaveAttribute(
        'aria-activedescendant',
        highlighted ?? '',
      );

      // Som attributt og ikke som `#id`: Suggestion sine id-er begynner med
      // kolon (`:u-option8`), som ikke er en gyldig id-selektor, og `CSS.escape`
      // finnes ikke her — testen kjører i Node, ikke i sida.
      const row = page.locator(`[id="${highlighted}"]`);
      await expect(row).toBeVisible();

      const contrast = await contrastAgainstBackdrop(row);
      expect(
        contrast.text,
        `teksten i den framhevede raden mot ${contrast.background} i ${mode}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast.ring,
        `framhevingsringen mot ${contrast.background} i ${mode}`,
      ).toBeGreaterThanOrEqual(3);

      // Og en liste som er filtrert av det leseren har skrevet, i et annet
      // felt: rekkefølgen er skriv først, framhev etterpå, fordi ArrowDown
      // skriver den framhevede verdien inn i feltet og et tastetrykk etter
      // den ville lagt seg bakerst.
      const typed = facetField(page, 'Dokumenttyper');
      await typed.click();
      await page.keyboard.type('Årsrapport');
      await expect(
        page.locator('[role="option"]').filter({ hasText: 'Årsrapport' }).first(),
      ).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await expectNoAxeViolations(page, `filtrert fasettliste med framhevet rad i ${mode}`, {
        keepFocus: true,
      });
      await expect(
        page.locator('[role="option"]:visible'),
        'den filtrerte lista skal også stå åpen etter axe-kjøringen',
      ).not.toHaveCount(0);
    });
  }

  test('Tab gjennom begge visningene: navn og synlig fokusring hele veien', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);

      expectEveryStepReachable(await walkWithTab(page), `filtreringen i ${mode}`);

      await showThreads(page);
      expectEveryStepReachable(await walkWithTab(page), `trådlista i ${mode}`);

      await showFilters(page);
    }
  });
});
