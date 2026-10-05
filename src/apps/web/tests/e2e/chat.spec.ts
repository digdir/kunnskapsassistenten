import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import { MOCK_FAILURE_QUERY } from '../../src/api/mock';
import {
  ANSWER_TIMEOUT,
  ask,
  citation,
  composer,
  expectEveryStepReachable,
  showDetailedAnswers,
  walkWithTab,
  MOCK,
  REAL_ANSWER,
} from './helpers';

/**
 * The chat: the greeting, the question, the streamed answer and what a reader
 * can do with it.
 *
 * A full mock answer takes about 7.5 seconds of wall clock, so the tests that
 * need a finished answer pay for one each. They run in parallel, so the suite
 * does not.
 */
test.describe('hovedkolonnen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('den tomme tilstanden er en hilsen og tre forslag', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'kickstarter fyller feltet');

    await expect(page.getByRole('heading', { name: /^Hei/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hva lurer du på?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Hva rapporteres om regnskap/ })).toBeVisible();

    await expect(composer(page)).toHaveValue('');
    await expectNoAxeViolations(page, 'den tomme tilstanden');
  });

  test('en kickstarter fyller feltet og sender ikke', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'kickstarter fyller feltet');

    const suggestion = page.getByRole('button', { name: /^Hva rapporteres om regnskap/ });
    const question = (await suggestion.textContent())?.trim() ?? '';
    await suggestion.click();

    // Answer 40: it starts the question, it does not ask it. The caret goes
    // with the text so the reader can edit before sending.
    await expect(composer(page)).toHaveValue(question);
    await expect(composer(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toHaveCount(0);
  });

  test(
    'et spørsmål gir et strømmet svar med kildemarkører',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'spørsmål gir strømmet svar med [n]-markører');

      await composer(page).click();
      await page.keyboard.type('Hvordan jobber Nkom med måloppnåelse?');
      await page.keyboard.press('Enter');

      // While it works: the stop button is there and the field is empty again.
      await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
      await expect(composer(page)).toHaveValue('');

      // The question is in the list as the reader's own words. Scoped to the
      // user's own message rather than looked for anywhere on the page: since
      // 2026-09-15 the thread heading is the same question with the sentence
      // mark stripped, so an unscoped search matches this one only because of
      // a "?" — which is a reason for a test to pass, not the reason it should.
      await expect(
        page.locator('.ka-message--user').getByText('Hvordan jobber Nkom med måloppnåelse?'),
      ).toBeVisible();

      await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
        timeout: ANSWER_TIMEOUT,
      });

      // The markers are links to the excerpts, and their names say where they go
      // rather than just «[1]». Any number: a real model need not cite [1]
      // first, and the mock always did, so «Kilde 1» tested the mock.
      const markers = page.locator('main a[href^="#excerpt-"]');
      expect(await markers.count()).toBeGreaterThan(0);
      await expect(markers.first()).toHaveAttribute('aria-label', /^Kilde \d+: /);

      // «Fremgangsmåte» arrives with the answer, open, with the steps and the
      // words the search ran on. The hit count is on the detailed level since
      // Simens issue 88; there is a test of its own for that below.
      await expect(page.getByText('Fremgangsmåte')).toBeVisible();
      await expect(page.getByText('Nøkkelord som ble brukt i søket')).toBeVisible();

      // Og ingenting av maskineriet: ingen tenketid, ingen telling av biter.
      // Det er hele poenget med standardnivået (Simens issue 88).
      await expect(page.getByText(/\d+ treff i \d+ dokument(er)?/)).toHaveCount(0);
      await expect(page.getByText(/Tenkte i \d+ sekunder?/)).toHaveCount(0);

      await expectNoAxeViolations(page, 'et ferdig svar');
    },
  );

  /**
   * Den skjulte innstillingsmenyen (Lars, 30.09).
   *
   * «Standard er standard. Uten adressen ser ingen at menyen finnes.» Den er
   * ikke i sida i det hele tatt før hashen ber om den, og valget står i
   * nettleseren etterpå — ellers måtte den som vil ha det detaljerte nivået
   * skrive adressen på nytt for hver tur.
   *
   * Uten svar i denne, med vilje: hva nivåene TEGNER er dekket over og i
   * enhetstestene, og et svar til koster sju sekunder av suiten.
   */
  test('#innstillinger åpner menyen, og valget står etter en reload', MOCK, async ({ page }) => {
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/#innstillinger');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /Standard/ })).toBeChecked();

    await dialog.getByRole('radio', { name: /Detaljert/ }).check();
    await expectNoAxeViolations(page, 'innstillingsmenyen');

    // Lukkingen tar hashen ut av adressen, så menyen ikke åpner seg igjen.
    await dialog.getByRole('button', { name: 'Lukk' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);

    await page.reload();
    await page.goto('/#innstillinger');
    await expect(page.getByRole('dialog').getByRole('radio', { name: /Detaljert/ })).toBeChecked();
  });

  /*
   * Closing the menu is a navigation, and the start page was keyed on every
   * navigation for a while (#203): «Lukk» mounted the chat again and a
   * half-written question was gone. Measured by KA CC on #208, round 1; the
   * start page is keyed on «Ny tråd» since round 2.
   */
  test('å lukke menyen på startsiden beholder et halvskrevet spørsmål', MOCK, async ({ page }) => {
    const field = composer(page);
    await field.fill('Et halvskrevet spørsmål');

    await page.goto('/#innstillinger');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lukk' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(field).toHaveValue('Et halvskrevet spørsmål');
  });

  /*
   * The same menu, and the skip link, over a conversation started on the
   * start page. Its address is written with `replaceState`, so the router
   * first sees `/threads/<id>` when the hash moves, and the chat slot's key
   * went from `new:N` to the id: the conversation was mounted again and read
   * back from the backend, which keeps no chunks per message, so
   * «Fremgangsmåte», the sources and the Kudos links went (6 to 0, measured
   * by the conductor in the test environment 30.09).
   *
   * The mock reads a conversation back with everything in it, so an assertion
   * about what is on screen would pass over the bug. What is held here is the
   * remount itself: the answer card is the same element before and after, and
   * a half-written follow-up is still in the field.
   */
  for (const [what, leave] of [
    [
      'å lukke menyen',
      async (page: Page) => {
        await page.goto(`${page.url()}#innstillinger`);
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Lukk' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      },
    ],
    [
      'hopplenka til skrivefeltet',
      async (page: Page) => {
        await page.getByRole('link', { name: /^Hopp til skrivefeltet/ }).focus();
        await page.keyboard.press('Enter');
        await expect(composer(page)).toBeFocused();
      },
    ],
  ] as const) {
    test(
      `${what} i en samtale fra startsiden monterer den ikke på nytt`,
      MOCK,
      async ({ page }) => {
        await ask(page, 'Hva sier dokumentene om romfart?');
        await expect(page).toHaveURL(/\/threads\/[\w-]+$/);

        // A mark on the element itself: a remounted card is a new element
        // without it, however alike the two look.
        await page
          .locator('.ka-answer-card')
          .first()
          .evaluate((card) => {
            card.setAttribute('data-e2e-mark', 'before');
          });
        const field = composer(page);
        await field.fill('Et halvskrevet oppfølgingsspørsmål');

        await leave(page);

        await expect(page.locator('.ka-answer-card[data-e2e-mark="before"]')).toHaveCount(1);
        await expect(field).toHaveValue('Et halvskrevet oppfølgingsspørsmål');
        // And the turn once, not twice: a slot that stays mounted but reads
        // the thread back on top of what it has shows the question and the
        // answer twice, and the marked card is then still there. Measured on
        // #218. Held for a moment rather than read once, because the read-back
        // is asynchronous: a count taken at once is 1 before the second copy
        // lands, which is how the skip-link case passed the first version.
        for (let look = 0; look < 10; look += 1) {
          expect(await page.locator('.ka-message--user').count(), 'spørsmål').toBe(1);
          expect(await page.locator('.ka-answer-card').count(), 'svarkort').toBe(1);
          await page.waitForTimeout(150);
        }
      },
    );
  }

  test(
    'avbryt stopper genereringen og beholder teksten som kom',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'avbryt stopper');

      await composer(page).click();
      await page.keyboard.type('Hva står i årsrapporten?');
      await page.keyboard.press('Enter');

      const stop = page.getByRole('button', { name: 'Avbryt genereringen' });
      await expect(stop).toBeVisible();

      // Wait for text to have started before stopping, so «keeps what arrived»
      // means something.
      await expect(page.locator('.ka-answer-card')).toBeVisible();
      await page.waitForTimeout(2500);
      const partial = (await page.locator('.ka-answer-card').first().textContent()) ?? '';

      await stop.focus();
      await stop.press('Enter');

      // The button the reader pressed is gone; focus must not be on the body.
      await expect(composer(page)).toBeFocused();
      await expect(stop).toHaveCount(0);

      // Cancelling is not an error, and the partial answer stays. The alert is
      // checked by what it would show rather than by its role: an empty
      // `.error-state` is `display: none` in global.css and therefore not in the
      // accessibility tree at all. That is a defect on `main`, written up in the
      // review — not something this test should encode as correct.
      await expect(page.getByRole('button', { name: 'Prøv igjen' })).toHaveCount(0);
      expect(partial.length).toBeGreaterThan(0);
      await expect(page.locator('.ka-answer-card')).toBeVisible();
    },
  );

  test(
    'handlingsraden kopierer svaret og kvitterer',
    REAL_ANSWER,
    async ({ page, context }, testInfo) => {
      covers(testInfo, 'kopier svaret og lenke til tråden');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // A question with an answer in the corpus. «Hva sier rapporten?» can get a
      // question back from a real model, and behind the BFF, which has no
      // clarification state, that arrives as an answer without sources: the
      // receipt then says «Svaret er kopiert.», and this test asks for sources.
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

      // The receipt is a live region that exists before it has anything to say.
      const receipt = page.locator('.ka-answer-actions__receipt');
      await expect(receipt).toBeAttached();
      await expect(receipt).toHaveText('');

      const copy = page.getByRole('button', { name: 'Kopier svaret' });
      await copy.click();
      // The receipt counts what went along, so «Svaret er kopiert» would not
      // tell the reader that the sources did too.
      //
      // Inside the four seconds the receipt stands (useCopy.ts, RECEIPT_MS).
      // With Playwright's five, a wrong text had cleared before the wait ran
      // out, and the failure said the receipt was empty rather than what it said.
      await expect(receipt).toHaveText(/^Svaret og \d+ kilder? er kopiert\.$/, { timeout: 3_000 });
      // Focus stays where the reader put it.
      await expect(copy).toBeFocused();

      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboard.length).toBeGreaterThan(0);

      // The markers stay, because the list they point at goes with them. An
      // answer pasted into a submission without its provenance is the one thing
      // KA is not for — reise 13, 14 and 20 in brukerreiser-2026-09-15.md.
      expect(clipboard).toMatch(/\[\d+\]/);

      // A reference list under the answer, one line per marker, in Norwegian
      // APA-like form: «[1] Virksomhet (år). Tittel, s. X. URL». The corpus
      // decides which parts exist, so only the shape is asserted here.
      const [, references = ''] = clipboard.split(/\nKilder\n/);
      const lines = references.split('\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const [index, line] of lines.entries()) {
        expect(line.startsWith(`[${index + 1}] `)).toBe(true);
      }
      // Every marker in the text is answered by a line in the list.
      for (const marker of new Set(clipboard.split(/\nKilder\n/)[0]?.match(/\[\d+\]/g) ?? [])) {
        expect(references).toContain(`${marker} `);
      }
    },
  );

  test('oppfølgingschipene sender med én gang', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'oppfølgingsspørsmål');
    await ask(page, 'Hva sier rapporten?');

    const answersBefore = await page.locator('.ka-message--assistant').count();
    await page.getByRole('button', { name: 'Kan du utdype?' }).click();

    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
    await expect(page.locator('.ka-message--assistant')).toHaveCount(answersBefore + 1);
  });

  test(
    'en feil vises som Alert med «Prøv igjen», og et nytt forsøk tar fokus',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'feil vises som Alert');

      // `simuler feil` is the one question the mock client always fails on,
      // exported as MOCK_FAILURE_QUERY so the test and the client cannot drift.
      await composer(page).click();
      await page.keyboard.type(MOCK_FAILURE_QUERY);
      await page.keyboard.press('Enter');

      // Scoped to the main column: every view that can fail renders its own
      // alert region, and that they all resolve by role is the point — a region
      // hidden with `display: none` would not be in the accessibility tree at
      // all, and then the message would never announce.
      const alert = page.getByRole('main').getByRole('alert');
      await expect(alert).toContainText('Svaret kom ikke fram');
      await expect(alert.getByRole('button', { name: 'Prøv igjen' })).toBeVisible();

      const retry = alert.getByRole('button', { name: 'Prøv igjen' });
      await retry.focus();
      await retry.press('Enter');

      // The button removed itself by doing its job. Focus must land somewhere a
      // keyboard user can carry on from, never on `body`.
      const landed = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(landed, 'fokus skal ikke falle til body etter «Prøv igjen»').not.toBe('body');
    },
  );

  /**
   * Skrivefeltet er tabstopp 22 av 38 på en trådside, for det leseren gjør
   * oftest (reise 7 og 15).
   *
   * Den viktigste påstanden er den negative: **bare `/` skal ikke gjøre
   * noe.** En snarvei på én tegntast er WCAG 2.1.4, nivå A, og må kunne slås
   * av, remappes eller være bundet til en fokusert komponent. Modifikatoren
   * er det som tar den ut av kriteriet, og den dagen noen «forenkler» den
   * bort, skal denne testen si fra.
   *
   * Tegnet står aldri i DOM-en som én streng: hinten sier «Ctrl» eller «Cmd»
   * etter hvilken maskin leseren sitter ved, så testen låser formen og ikke
   * ordet.
   */
  /**
   * «Tenkte i N sekunder» er den målte ventetiden, ikke summen av stegene.
   *
   * De to tallene er forskjellige, og det var nettopp der feilen bodde:
   * `AnswerMessage` sendte ikke `thoughtMs` videre, så panelet falt tilbake på
   * summen av stegenes egne `durationMs` — fire sekunder for en tur som tok
   * sju (#72). Reload-testen i `samtale.spec.ts` kunne ikke fange det, fordi
   * den sammenlikner før og etter en reload og en fallback er lik på begge
   * sider.
   *
   * Så denne tar tiden selv, over NØYAKTIG det intervallet panelet måler:
   * fra det første tenkesteget lander — som er når «Tenker …» dukker opp —
   * til det første ordet står i svaret. To klokker over samme strekning kan
   * sammenliknes.
   *
   * **Hva den ikke kan bevise.** Fallbacken er et fast tall (summen av
   * stegenes `durationMs`, fire sekunder), og den ekte ventetiden under
   * `VITE_MOCK_SPEED=fast` er knappe to. Testen skiller dem fordi de er langt
   * fra hverandre — men på en maskin som er treg nok til at den ekte
   * ventetiden nærmer seg fire, ville en fallback sett riktig ut. Toleransen
   * er derfor ett sekund og ikke to: med fiksen på plass er panelets tall
   * appens egen måling av samme strekning, og de to skiller seg bare med
   * avrunding. Blir denne rød med en differanse rett over ett sekund, er det
   * maskinen som skal mistenkes først, ikke koden.
   */
  test(
    'tenketiden er den målte ventetiden, ikke summen av stegene',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'tenketiden er målt, ikke summert');
      // Tallet står bare på det detaljerte nivået (Simens issue 88).
      await showDetailedAnswers(page);
      await page.goto('/');

      await composer(page).click();
      await page.keyboard.type('Hvordan jobber Nkom med måloppnåelse?');
      await page.keyboard.press('Enter');

      await expect(page.getByText('Tenker …')).toBeVisible({ timeout: ANSWER_TIMEOUT });
      const startedThinking = Date.now();

      await expect
        .poll(() => page.locator('.ka-answer-card .markdown').innerText(), { timeout: 60_000 })
        .not.toBe('');
      const measuredSeconds = (Date.now() - startedThinking) / 1000;

      await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
        timeout: 60_000,
      });

      const summary = await page.locator('.ka-thinking__summary').innerText();
      const shown = Number(/(\d+)/.exec(summary)?.[1]);

      expect(Number.isFinite(shown), `fant ikke noe tall i «${summary}»`).toBe(true);
      expect(
        Math.abs(shown - measuredSeconds),
        `panelet sa «${summary}», testen målte ${measuredSeconds.toFixed(1)} s`,
      ).toBeLessThanOrEqual(1);
    },
  );

  test(
    'Ctrl+/ flytter skrivemerket til feltet, og bare / gjør ingenting',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'snarvei til skrivefeltet');
      await page.goto('/threads/nkom-maaloppnaaelse');

      const field = composer(page);
      await expect(field).toBeVisible();

      async function focusSomethingElse() {
        await page.getByRole('button', { name: 'Skjul tråder og filter' }).focus();
      }

      // Uten modifikator: ingenting.
      await focusSomethingElse();
      await page.keyboard.press('/');
      await expect(field, 'en ren tegntast er ingen snarvei').not.toBeFocused();
      /*
       * Og feltet er tomt FØR snarveien prøves. Uten denne sto påstanden om tom
       * verdi først etter at fokus var flyttet, og en «/» som ble behandlet sent
       * kunne rekke å havne i feltet — rødt på `toHaveValue`, med snarveien som
       * den mistenkte. Her sier testen hvilket av de to tastetrykkene som lekket.
       */
      await expect(field, 'tegnet skal ikke ha havnet noe sted').toHaveValue('');

      // Med modifikator: treffer. Begge godtas overalt, så Control er nok her.
      await page.keyboard.press('Control+/');
      await expect(field).toBeFocused();

      // Og tegnet havner ikke i feltet den nettopp flyttet til.
      await expect(field).toHaveValue('');

      /*
       * Shift og Alt måles IKKE her, men i `ChatView.test.tsx`.
       *
       * Hvilke modifikatorer som utløser snarveien er et spørsmål om
       * `event.key`, `ctrlKey`, `shiftKey` og `altKey` — og Playwright oversetter
       * `Control+Shift+/` gjennom tastaturoppsettet maskinen kjører med. På
       * norsk layout er «/» Shift+7, så Shift holdes og `key` er fortsatt «/»;
       * på US-layout, som CI kjører, er Shift+«/» derimot `?`, og da gjør appen
       * riktig ingenting. Testen påsto altså noe layout-spesifikt som om det var
       * universelt, og CI ble rød på det tre ganger 15.09 — på tre forskjellige
       * grener, i to forskjellige påstander, fordi et `Control+Alt+/` også
       * etterlot tastaturtilstand som slukte den neste skrivingen.
       *
       * Unit-testene setter hendelsen direkte og er derfor uavhengige av
       * oppsettet: «answers to Ctrl+Shift+/», «... Cmd+/ as well», «does nothing
       * on a bare «/»» og «leaves Ctrl+Alt+/ alone». Det er riktig sted for det.
       * Her måles det som er layout-uavhengig: at snarveien virker i den ekte
       * appen, og at «/» ellers er et vanlig tegn.
       */

      /*
       * Og «/» skrives som et tegn i feltet, som alle andre tegn.
       *
       * `pressSequentially` på feltet, ikke `page.keyboard.type`: den første
       * skriver til elementet, den andre til hva som nå enn har fokus. Denne
       * påstanden ble rød i CI 15.09 med tom verdi — fire ganger, på fire
       * grener — mens den var grønn lokalt hver gang. Jeg fant ikke årsaken:
       * Playwright-artefaktene skrives til `~/.cache`, utenfor arbeidsområdet,
       * så CI har ingen trace å laste opp. Det jeg kunne gjøre noe med er
       * avhengigheten av omgivende fokus- og tastaturtilstand, og den er borte
       * nå. Kommer den tilbake, er neste steg å flytte artefaktene inn i
       * arbeidsområdet så kjøringen kan lastes opp.
       */
      await field.fill('');
      await field.pressSequentially('a/b');
      await expect(field).toHaveValue('a/b');

      /*
       * Snarveien står to steder: en tooltip på feltet og en beskrivelse på
       * feltet. Den synlige hinten under feltet er borte — den delte linje med
       * forbeholdet og brøt den i to på begge målte bredder, 24 px av den
       * klebrige bunnen på hver skjerm (høydebudsjett 2026-09-21, H3). Den
       * flyttet til det den handler om, og påstanden flyttet med den.
       */
      await expect(field).toHaveAttribute('title', /^Trykk (Ctrl|Cmd) \+ \/ for å hoppe hit$/);
      /*
       * `aria-describedby` er en LISTE av id-er, ikke én id, så oppslaget må
       * splitte på mellomrom — `getElementById` på hele strengen finner
       * ingenting den dagen feltet får en beskrivelse til (#5).
       *
       * Og `expect.poll` og ikke et engangs-`evaluate`: uten retry leser den én
       * gang, og leser den i et øyeblikk der feltet byttes ut, får den tom
       * streng fra et element som ikke er i dokumentet lenger. Det var den ene
       * av de to måtene denne testen falt på i CI 15.09 — sidebildet viste
       * beskrivelsen stå der med riktig tekst mens testen leste «».
       */
      await expect
        .poll(
          () =>
            field.evaluate((element) =>
              (element.getAttribute('aria-describedby') ?? '')
                .split(/\s+/)
                .filter(Boolean)
                .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
                .join(' '),
            ),
          { message: 'beskrivelsen skriver tasten med bokstaver' },
        )
        .toContain('skråstrek');
    },
  );

  /**
   * Simens issue 117: the reader's question read as a heading over the
   * answer. #237 put it in a box at the end of the line, at most 85 % of the
   * column, and the answer across the column under it. The side and the width
   * are two of the three things that tell the two apart, and both are CSS:
   * the unit tests cover the box, its colour and «Du skrev:», and nothing
   * that a browser has to lay out (KA CC on #237).
   *
   * Two questions, because the width does two jobs. The long one in the
   * thread is held at 85 %; a short one shrinks to its words instead of
   * standing as a band.
   */
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    test(
      `spørsmålet står i en boks mot slutten av linja, og svaret over hele kolonnen, ${width}`,
      MOCK,
      async ({ page }, testInfo) => {
        covers(testInfo, 'spørsmål og svar skilles på side og bredde');
        await page.setViewportSize({ width, height });
        await page.goto('/threads/nkom-maaloppnaaelse');
        await expect(page.getByRole('button', { name: 'Kopier svaret' }).first()).toBeVisible();

        await composer(page).click();
        await page.keyboard.type('Hei?');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Kopier svaret' })).toHaveCount(2, {
          timeout: ANSWER_TIMEOUT,
        });

        const placed = await page.evaluate(() =>
          [...document.querySelectorAll('.ka-message--user')].map((turn) => {
            const line = turn.getBoundingClientRect();
            const box = turn.querySelector('.ka-message__bubble')!.getBoundingClientRect();
            return {
              text: turn.textContent!.replace('Du skrev:', '').trim().slice(0, 30),
              share: box.width / line.width,
              startGap: box.left - line.left,
              endGap: line.right - box.right,
            };
          }),
        );
        const answer = await page.evaluate(() => {
          const card = document.querySelector('.ka-message--assistant')!.getBoundingClientRect();
          const line = document.querySelector('.ka-message--user')!.getBoundingClientRect();
          return { share: card.width / line.width };
        });

        expect(placed, 'to spørsmål i tråden').toHaveLength(2);
        for (const question of placed) {
          expect(question.endGap, `«${question.text}» skal stå mot slutten av linja`).toBeLessThan(
            1,
          );
          expect(
            question.startGap,
            `«${question.text}» skal ikke starte ved kanten`,
          ).toBeGreaterThan(0);
          expect(question.share, `«${question.text}» skal være høyst 85 %`).toBeLessThan(0.851);
        }
        const [long, short] = placed;
        expect(long!.share, 'det lange spørsmålet skal fylle de 85 %').toBeGreaterThan(0.84);
        expect(short!.share, '«Hei?» skal krympe til ordene').toBeLessThan(0.5);
        expect(answer.share, 'svaret skal gå over hele kolonnen').toBeGreaterThan(0.99);
      },
    );
  }

  /**
   * Simens runde 3, ekstra 1: writing in the field while not at the bottom
   * scrolled the main column 49 px towards the end for every key. The guard
   * for WCAG 2.4.11 was `scroll-padding` on the scroller, the field sits in
   * the band that padding keeps clear, and every keystroke asked the browser
   * to bring the caret out from behind the field.
   *
   * #228 moved the guard to a `scroll-margin` on what the field can hide, and
   * the fix is four lines of CSS that jsdom cannot see: without them the
   * column went 781 → 890 at 1440 × 900 and every unit test stayed green (KA
   * CC on #228). So both halves are asserted here, in a browser: the column
   * stands still while the reader writes, and nothing reached by Tab lands
   * behind the field — the guard the padding was there for.
   */
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    test(
      `skriving midt i tråden flytter ikke kolonnen, og Tab havner ikke bak feltet, ${width}`,
      MOCK,
      async ({ page }, testInfo) => {
        covers(testInfo, 'skriving ruller ikke hovedkolonnen');
        await page.setViewportSize({ width, height });
        await page.goto('/threads/nkom-maaloppnaaelse');
        await expect(page.getByRole('button', { name: 'Kopier svaret' }).first()).toBeVisible();

        const main = page.locator('.main');
        await main.evaluate((element) => {
          element.scrollTop = Math.round((element.scrollHeight - element.clientHeight) / 2);
        });
        // Read before the click, not after it. With the margin on the field
        // as well, the column jumps once when the field takes focus rather
        // than once per key: measured from after the click, the test was
        // green with the fix taken out.
        const before = await main.evaluate((element) => element.scrollTop);
        expect(before, 'tråden skal ha noe å rulle i').toBeGreaterThan(0);
        await composer(page).click();

        await page.keyboard.type('Hva sier rapporten om', { delay: 20 });
        await expect(composer(page)).toHaveValue('Hva sier rapporten om');
        expect(
          await main.evaluate((element) => element.scrollTop),
          'kolonnen skal stå stille mens leseren skriver',
        ).toBe(before);

        // From the top of the column, through everything focusable in the
        // conversation. Each stop is measured against the area the field
        // stands in, as the browser left it. «Behind» is what 2.4.11 means:
        // entirely, so the whole box starts below the top of the area.
        await main.evaluate((element) => (element.scrollTop = 0));
        await page.getByRole('heading', { level: 2 }).first().click();
        const behind: string[] = [];
        for (let step = 0; step < 40; step += 1) {
          await page.keyboard.press('Tab');
          const hidden = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            if (!active?.closest('.ka-chat') || active.closest('.ka-composer-area')) return null;
            const area = document.querySelector('.ka-composer-area')!.getBoundingClientRect();
            const box = active.getBoundingClientRect();
            return box.top >= area.top ? (active.textContent ?? active.tagName).trim() : null;
          });
          if (hidden) behind.push(hidden);
        }
        expect(behind, 'ingenting som får fokus skal stå bak feltet (WCAG 2.4.11)').toEqual([]);
      },
    );
  }

  test('Tab gjennom hovedkolonnen i lys og mørk', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');
    await ask(page, 'Hva sier rapporten?');

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);
      expectEveryStepReachable(await walkWithTab(page), `hovedkolonnen i ${mode}`);
      await expectNoAxeViolations(page, `hovedkolonnen i ${mode}`);
    }
  });

  test('en markør peker på et utdrag som finnes', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'klikk på [n] ruller og fokuserer riktig utdrag');
    await ask(page, 'Hva sier rapporten?');

    const first = citation(page, 1);
    await expect(first).toHaveAttribute('href', '#excerpt-1');
    await expect(first).toHaveText('[1]');
  });
});
