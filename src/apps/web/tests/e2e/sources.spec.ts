import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import {
  ANSWER_TIMEOUT,
  ask,
  citation,
  composer,
  expectEveryStepReachable,
  openSources,
  walkWithTab,
  MOCK,
  REAL_ANSWER,
} from './helpers';

/**
 * The sources panel: the excerpts the answer rests on, and the link from a
 * `[n]` marker to the excerpt it points at.
 *
 * The panel starts collapsed, and it has nothing to show before the first
 * answer, so every test here asks a question first. That is also the only
 * honest way to test the coupling: the markers are built by one view and the
 * excerpts by another, and neither imports the other.
 */
test.describe('kildepanelet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
  });

  test('panelet sier fra mens kildene er på vei', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'lastetilstand i kildepanelet');

    // Back to a page nobody has asked anything on: the loading state is what
    // the panel shows while the FIRST answer is on its way, and the empty
    // state is what it shows before that. Both are lost once an answer has
    // landed, which is the state `beforeEach` leaves behind.
    await page.goto('/');
    await page.getByRole('button', { name: 'Vis kilder' }).click();

    const empty = page.getByRole('complementary', { name: 'Kilder' });
    // Before the first question nothing is loading, and saying «henter» would
    // be a lie. Answer 36.
    await expect(empty.getByText('Ingen kilder ennå')).toBeVisible();

    // A question the corpus can answer. On a fresh page «Hva mer sier
    // rapporten?» got a question back from a real model — «hvilken rapport
    // mener du?» — and an answer like that has no sources to wait for.
    await composer(page).click();
    await page.keyboard.type('Hva skriver DFØ om måloppnåelse i årsrapporten for 2024?');
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Kilder' });

    // Skeleton is aria-hidden, so a sentence has to carry the state, and
    // `aria-busy` has to say the region is not finished.
    await expect(panel.locator('[aria-busy="true"]')).toBeVisible();
    await expect(panel.getByText('Henter kilder …')).toBeAttached();

    // And it resolves into real sources rather than staying busy.
    await expect(panel.locator('.source-document').first()).toBeVisible({
      timeout: ANSWER_TIMEOUT,
    });
    await expect(panel.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('panelet er lukket til noe peker inn i det', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'kildepanelet åpnes av en markør');

    // Answer 36: the panel opens once the conversation has produced sources
    // worth citing, not before.
    await expect(page.getByRole('button', { name: 'Vis kilder' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Kilder' })).toHaveAttribute(
      'data-collapsed',
      'true',
    );
  });

  test(
    'en markør åpner panelet, åpner utdraget og flytter fokus dit',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'klikk på [n] ruller og fokuserer riktig utdrag');

      await citation(page, 2).click();

      // The panel opens itself: a marker pointing into a collapsed panel that
      // did nothing was the first-run case, not an edge case.
      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

      const excerpt = page.locator('#excerpt-2');
      await expect(excerpt).toBeVisible();
      await expect(excerpt).toBeFocused();
      // The excerpt is opened, not just scrolled to.
      await expect(excerpt.getByRole('group')).toHaveAttribute('open', '');

      // Answer 19 again: a second click on the same marker has to count as a
      // new request, which is what the nonce is for.
      await page.keyboard.press('Tab');
      await citation(page, 2).click();
      await expect(excerpt).toBeFocused();
    },
  );

  /**
   * Punkt 4 i brukerblikket: å komme TIL et utdrag er ett klikk, å komme
   * tilbake var åtte Shift+Tab som endte på oppfølgingschipene, og Escape
   * gjorde ingenting.
   *
   * To veier, fordi de leses av to slags lesere: Escape for den som kan den,
   * og en synlig kontroll sist i sitatet for alle andre. Begge måles på hvor
   * fokus havner — ikke på at knappen finnes, for en knapp som ikke flytter
   * fokus er ingen vei tilbake.
   */
  test(
    'utdraget markøren sendte deg til har to veier tilbake til svaret',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'vei tilbake fra utdrag til svar');

      await openSources(page, 2);
      const excerpt = page.locator('#excerpt-2');
      await expect(excerpt).toBeFocused();

      // Escape, fra inne i utdraget.
      await page.keyboard.press('Escape');
      await expect(citation(page, 2), 'Escape setter fokus på markøren').toBeFocused();

      // Og knappen, som er der for den som ikke vet om Escape.
      await citation(page, 2).click();
      await expect(excerpt).toBeFocused();
      const back = excerpt.getByRole('button', { name: 'Tilbake til svaret' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(
        citation(page, 2),
        '«Tilbake til svaret» setter fokus på markøren',
      ).toBeFocused();

      // Et utdrag ingen ble sendt til, har ingen vei tilbake: en kontroll som
      // fører til et sted du aldri kom fra gjør ingenting.
      const other = page.locator('#excerpt-1');
      await other.locator('summary').click();
      await expect(other.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);

      await expectNoAxeViolations(page, 'et åpnet utdrag med vei tilbake');
    },
  );

  /**
   * Punkt 5: hvert svar nummererer utdragene sine fra 1, så `[2]` i første
   * svar og `[2]` i andre peker på hver sin ting. Ett flatt kildesett gjorde
   * at markøren i det eldste svaret åpnet det nyeste svarets utdrag to — det
   * så riktig ut og var det ikke.
   *
   * Kjeden er tre PR-er lang og testes her fra enden: #36 bygde panelet, #39
   * la røret gjennom skallet, #42 kalte det fra chat-viewet og #44 sørget for
   * at båndet blir igjen i svaret det hører til. Det er den siste biten som
   * er lettest å miste igjen, så den måles eksplisitt.
   */
  test(
    'to svar har hvert sitt kildesett, og markøren blir i sitt',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'kilder per svar');

      // `beforeEach` har stilt ett spørsmål; dette er det andre, i samme samtale.
      await ask(page, 'Hva mer sier rapporten?');
      await expect(page.locator('.ka-message--assistant')).toHaveCount(2);

      // Markøren i det FØRSTE svaret, ikke det nyeste.
      await page
        .locator('.ka-message--assistant')
        .first()
        .locator('a[href="#excerpt-1"]')
        .first()
        .click();
      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

      const teller = page.locator('.sources-answer-switcher__count');
      await expect(teller, 'panelet sier hvilket svar kildene hører til').toHaveText(
        'Kilder til svar 1 av 2',
      );
      await expect(page.locator('#excerpt-1')).toBeFocused();
      await expect(page.locator('.source-excerpt[data-active="true"]')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(1);

      // Steg til det andre svaret: båndet og veien tilbake hører til svaret
      // leseren ble sendt til, og blir igjen der.
      await page.getByRole('button', { name: 'Neste svar' }).click();
      await expect(teller).toHaveText('Kilder til svar 2 av 2');
      await expect(
        page.locator('.source-excerpt[data-active="true"]'),
        'ingen ble sendt til dette settet',
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);

      // Og tilbake igjen: leseren BLE sendt dit, så begge deler kommer tilbake.
      await page.getByRole('button', { name: 'Forrige svar' }).click();
      await expect(teller).toHaveText('Kilder til svar 1 av 2');
      await expect(page.locator('.source-excerpt[data-active="true"]')).toHaveCount(1);

      await expectNoAxeViolations(page, 'kildepanelet med to svar');
    },
  );

  test(
    'utdragene er gruppert per dokument og nummerert mot markørene',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'utdrag gruppert per dokument');
      await openSources(page, 1);

      const panel = page.getByRole('complementary', { name: 'Kilder' });

      // Answer 57: one card per document, the excerpts under it.
      const cards = panel.locator('.source-document');
      expect(await cards.count()).toBeGreaterThan(1);

      // The excerpts carry the `[n]` numbers. The documents are numbered in
      // «Kilder brukt i svaret» under the answer now, not in the panel (#113).
      await expect(panel.getByRole('heading', { name: 'Utdrag 1' })).toBeVisible();

      // Every marker in the answer has an excerpt to point at.
      const markers = await page
        .locator('main a[href^="#excerpt-"]')
        .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
      for (const href of markers) {
        await expect(panel.locator(href as string)).toHaveCount(1);
      }

      await expectNoAxeViolations(page, 'kildepanelet');
    },
  );

  /**
   * Simens issue 113: «Kilder brukt i svaret» under the answer is the way into
   * the panel, and «Snarveier til dokumentene» is gone from it. A title takes
   * the route a `[n]` marker takes: the panel opens on the document's first
   * excerpt with the focus in it, and Escape comes back to the title.
   *
   * In a browser and not only in jsdom, which does not navigate: the title is
   * a link to the excerpt's fragment, and without `preventDefault` following
   * it would be a route change that remounts the chat (KA CC on #246).
   */
  test(
    'en tittel under svaret åpner utdraget i kildepanelet, og Escape går tilbake',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'kilder brukt i svaret');
      const address = page.url();

      const summary = page.getByRole('main').locator('details', {
        hasText: 'Kilder brukt i svaret',
      });
      const title = summary.getByRole('link').first();
      await expect(title).toBeVisible();
      await title.click();

      const panel = page.getByRole('complementary', { name: 'Kilder' });
      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
      const excerpt = panel.locator('.source-excerpt', {
        has: page.getByRole('heading', { name: 'Utdrag 1' }),
      });
      // The box itself takes the focus, so «inside» includes the box.
      await expect
        .poll(() => excerpt.evaluate((box) => box.contains(document.activeElement)), {
          message: 'fokus skal stå i utdrag 1',
        })
        .toBe(true);
      await expect(excerpt.locator('details')).toHaveAttribute('open', '');
      expect(page.url(), 'adressen skal ikke få et fragment').toBe(address);

      await page.keyboard.press('Escape');
      await expect(title).toBeFocused();

      await expectNoAxeViolations(page, 'svaret med kildene under');
    },
  );

  test(
    'søk i utdragene gir en treffteller og lar tastaturet bli i feltet',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'søk i utdrag gir treffteller');
      await openSources(page, 1);

      const panel = page.getByRole('complementary', { name: 'Kilder' });
      const search = panel.getByRole('searchbox', { name: 'Søk i kildene' });

      await search.click();
      await page.keyboard.type('rapport');
      // The field must survive being typed in: the counter updating used to
      // pull focus out after the second character.
      await expect(search).toHaveValue('rapport');
      await expect(search).toBeFocused();

      const counter = panel.locator('.sources-search__count');
      await expect(counter).toHaveText(/^1 av \d+ treff$/);

      // Stepping keeps the keyboard on the button so it can be pressed again.
      const next = panel.getByRole('button', { name: 'Neste treff' });
      await next.focus();
      await next.press('Enter');
      await expect(counter).toHaveText(/^2 av \d+ treff$/);
      await expect(next).toBeFocused();

      await search.fill('finnesikkeher');
      await expect(counter).toHaveText('Ingen treff');
    },
  );

  test('ingen to lenker i panelet heter det samme', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'lenkenavn i kildepanelet er unike');
    await openSources(page, 1);

    // Utdragene må åpnes først: en lenke inne i et lukket `details` er ikke i
    // tilgjengelighetstreet, og da ramser ingen skjermleser den opp. Det er
    // den åpne tilstanden påstanden gjelder. Bare de lukkede klikkes — markøren
    // over åpnet allerede sitt eget, og et klikk til ville lukket det igjen.
    for (const details of await page.locator('.source-excerpt details').all()) {
      if (await details.evaluate((element: HTMLDetailsElement) => element.open)) continue;
      await details.locator('summary').click();
    }

    // Alle lenkene ut til Kudos viser de samme fire ordene, så en skjermleser
    // som ramser opp lenkene leste samme rad én gang per utdrag og én gang per
    // dokument (WCAG 2.4.9, KA CC på #70). Navnet, ikke den synlige teksten,
    // er det som må skille dem.
    const links = page.locator('[aria-label="Kilder"] a:visible');
    const names = await links.evaluateAll((all) =>
      all.map((link) => (link.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );

    // At least one, so the test is not about an empty panel. It was «more
    // than one» while the shortcut list stood here with a link per document.
    // Without it, the mock thread has one link left — one of its three
    // documents has an address — and the duplicates this test is for show up
    // against a real backend, where every document with an address has one.
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  test('Tab gjennom kildepanelet i lys og mørk', REAL_ANSWER, async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');
    await openSources(page, 1);

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);
      expectEveryStepReachable(await walkWithTab(page), `kildepanelet i ${mode}`);
      await expectNoAxeViolations(page, `kildepanelet i ${mode}`);
    }
  });

  /*
   * The toggle in an excerpt stays where the pointer left it. On #199 it sat
   * on the number's line while closed and went a row down when opened, 48 px
   * at 768 and 440, so a second click on the same spot missed (KA CC). The
   * five surfaces of the brief, because whether the toggle fits on the
   * number's line depends on the width.
   */
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 440, height: 956 },
  ]) {
    test.describe(`på ${viewport.width} × ${viewport.height}`, () => {
      test.use({ viewport });

      test(
        'knappen i et utdrag står på samme sted lukket og åpnet',
        REAL_ANSWER,
        async ({ page }, testInfo) => {
          covers(testInfo, 'knappen i et utdrag står stille');
          await citation(page, 1).click();

          // The excerpt the marker opened, closed again: closed is how a
          // reader meets every other excerpt, and where the measuring starts.
          const excerpt = page.locator('#excerpt-1');
          const details = excerpt.locator('details');
          const summary = excerpt.locator('summary');
          /*
           * Where the toggle comes to rest. `Details` animates its height for
           * 0.4 s, and right after closing, the row layout of bf847a7 drew
           * the summary 918 px wide at 1440, so a box read at once can say
           * where it passes through rather than where it stays.
           */
          const resting = async () => {
            let last = await summary.boundingBox();
            let since = Date.now();
            await expect
              .poll(
                async () => {
                  const now = await summary.boundingBox();
                  if (JSON.stringify(now) !== JSON.stringify(last)) {
                    last = now;
                    since = Date.now();
                  }
                  return Date.now() - since;
                },
                { intervals: [100] },
              )
              .toBeGreaterThanOrEqual(500);
            expect(last).not.toBeNull();
            return last!;
          };

          await expect(details).toHaveAttribute('open', '');
          await summary.click();
          await expect(details).not.toHaveAttribute('open');
          await summary.scrollIntoViewIfNeeded();

          const closed = await resting();
          // On the word, which the summary draws at its end edge.
          const x = closed.x + closed.width - 16;
          const y = closed.y + closed.height / 2;

          await page.mouse.click(x, y);
          await expect(details).toHaveAttribute('open', '');

          const open = await resting();
          expect(Math.abs(open.y - closed.y), 'samme høyde').toBeLessThanOrEqual(1);
          expect(
            Math.abs(open.x + open.width - (closed.x + closed.width)),
            'samme kant',
          ).toBeLessThanOrEqual(1);

          // And the same spot closes it again, which is what a reader does.
          await page.mouse.click(x, y);
          await expect(details).not.toHaveAttribute('open');
        },
      );
    });
  }
});
