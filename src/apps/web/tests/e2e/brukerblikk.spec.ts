import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ask, facetField, showThreads, MOCK, REAL_ANSWER } from './helpers';

/**
 * The findings from the brukerblikk pass on 2026-09-15, held in place.
 *
 * `docs/review/brukerblikk-2026-09-15.md` listed seventeen things that looked
 * wrong to someone opening the app for the first time. None of them was
 * caught by axe or by this suite, and that was the point of the pass: they
 * were not deviations from a specification, they were things that read badly.
 *
 * The ones that were fixed are here. Not because they are likely to come back
 * on their own, but because each of them was invisible to every check we had
 * — so if one does come back, nothing else would say so.
 *
 * The layout findings (2, 4, 7, 15) live in `layout.spec.ts` with the rest of
 * the shell measurements. Findings 14 and 17 were left alone on purpose.
 */
test.describe('brukerblikk-funnene holder', () => {
  test('funn 3: filteret skiller ingen avgrensning fra alt valgt', async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 3: filtertilstanden er lesbar');
    await page.goto('/');

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });

    // Untouched. The old wording said «Alle valgt» here too, so the two
    // states read word for word the same and the user could not tell whether
    // a filter was set.
    await expect(panel.getByText('Ingen avgrensning').first()).toBeVisible();
    await expect(panel.getByText(/Alle \d+ valgt/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Velg alle dokumenttyper' }).click();

    // And now the other state, in different words.
    await expect(panel.getByText(/Alle \d+ valgt/).first()).toBeVisible();
  });

  test('funn 8: en trådrad ser ut som en lenke', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 8: trådradene ser klikkbare ut');
    await page.goto('/');
    await showThreads(page);

    const row = page.locator('nav a[href^="/threads"]').first();
    await expect(row).toBeVisible();

    /*
     * Unntak fra dirigenten for denne påstanden (23.09): trådradene
     * skal ikke være understreket. Funnet står — en rad må se klikkbar ut —
     * men det som bærer det er nå pekerformen, hover-flata over HELE raden og
     * fokusringen, slik Designsystemets egen sidemeny gjør det. Målt, ikke
     * lest av et klassenavn: det er det en leser ser som er regelen.
     */
    const hvile = await row.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        decoration: style.textDecorationLine,
        cursor: style.cursor,
        background: style.backgroundColor,
      };
    });
    expect(hvile.decoration, 'trådraden er ikke understreket').toBe('none');
    expect(hvile.cursor, 'pekeren sier at raden kan trykkes').toBe('pointer');

    // Hover-flata dekker hele raden, tidsstempelet med: raden ER lenka.
    await row.hover();
    const hover = await row.evaluate((element) => {
      const style = getComputedStyle(element);
      const time = element.querySelector('time');
      return {
        background: style.backgroundColor,
        rowBottom: element.getBoundingClientRect().bottom,
        timeBottom: time?.getBoundingClientRect().bottom ?? 0,
        timeInside: time?.closest('a') === element,
      };
    });
    expect(hover.background, 'hover tegner en flate').not.toBe(hvile.background);
    expect(hover.timeInside, 'tidsstempelet ligger inne i lenka').toBe(true);
    expect(
      hover.rowBottom,
      'flata rekker under tidsstempelet, så hele raden er trykkflate',
    ).toBeGreaterThanOrEqual(hover.timeBottom);

    // Og fokusringen, for den som ikke har peker.
    await page.keyboard.press('Tab');
    await row.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const fokus = await row.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(fokus.style, 'fokusringen tegnes').not.toBe('none');
    expect(fokus.width, 'fokusringen har bredde').toBeGreaterThan(0);
  });

  test(
    'funn 12: overskriftene i panelet blir mindre nedover',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'brukerblikk 12: overskriftsstørrelsene følger nivåene');
      await page.goto('/');
      // The documents list is what the h3 and the h4s sit in, and it only has
      // headings once an answer has brought documents.
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

      const headings = await page.evaluate(() =>
        [...document.querySelectorAll('nav h2, nav h3, nav h4')].map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          size: parseFloat(getComputedStyle(heading).fontSize),
        })),
      );
      expect(headings.length).toBeGreaterThan(2);

      // Two h4s at different sizes, and an h4 as large as the h3 above it, is
      // what the panel used to draw. The rule is not «these exact pixels» but
      // «a deeper level is never larger than a shallower one».
      const largestPerLevel = new Map<number, number>();
      for (const { level, size } of headings) {
        largestPerLevel.set(level, Math.max(largestPerLevel.get(level) ?? 0, size));
      }
      const levels = [...largestPerLevel.keys()].sort((a, b) => a - b);
      for (let index = 1; index < levels.length; index += 1) {
        const shallower = largestPerLevel.get(levels[index - 1])!;
        const deeper = largestPerLevel.get(levels[index])!;
        expect(
          deeper,
          `h${levels[index]} skal ikke være større enn h${levels[index - 1]}`,
        ).toBeLessThan(shallower);
      }

      // And the two h4s agree with each other.
      const h4sizes = new Set(headings.filter((h) => h.level === 4).map((h) => h.size));
      expect([...h4sizes], 'alle h4 i panelet har samme størrelse').toHaveLength(1);
    },
  );

  test('funn 13: «Ny» står bare der funksjonen virker', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 13: ingen Ny-merke på ubygd funksjon');
    await page.goto('/');

    /*
     * Funnet var at merket ikke skal love noe som ikke er bygget: det sto
     * over en boks som sa at opplasting ikke var klar. Opplasting ER bygget
     * nå (#117, #124), så påstanden er snudd til det funnet egentlig sier —
     * merket og invitasjonen følger hverandre.
     *
     * Her måles mock-halvdelen, fordi suiten bygges med `VITE_API_MODE=mock`
     * og live ikke finnes i en nettleser på denne porten. Live-halvdelen —
     * ingen merkelapp, ingen filvelger, bare setningen om at opplasting ikke
     * er tilgjengelig — står i `OwnDocuments.test.tsx`, «live: sonen står,
     * men inviterer ikke til noe tjenesten ikke kan».
     *
     * Unntak fra dirigenten for denne ene påstanden, 21.09.
     */
    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    await expect(panel.getByText('Ny', { exact: true })).toHaveCount(1);
    await expect(panel.getByText('Velg filer')).toBeVisible();

    // Og setningen om at det ikke er klar er borte, fordi det er klart.
    await expect(panel.getByText('Opplasting er ikke klar ennå.', { exact: false })).toHaveCount(0);
  });

  test('funn 16: hvert søkefelt sier hva det søker i', async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 16: søkefeltene er skilt fra hverandre');
    await page.goto('/');
    // Wait for the fields to be there at all. Suggestion upgrades its custom
    // elements a tick after load, and reading straight after `goto` found
    // nothing — which would have passed the «all different» check on an empty
    // list.
    await expect(facetField(page, 'Dokumenttyper')).toBeVisible();

    const placeholders = await page.evaluate(() =>
      [...document.querySelectorAll('nav input')].map((input) => input.getAttribute('placeholder')),
    );
    const named = placeholders.filter((text): text is string => Boolean(text));
    expect(named.length).toBeGreaterThanOrEqual(3);
    // Three fields that all said «Søk» is the finding. Distinct text is the
    // fix, whatever the words end up being.
    expect(new Set(named).size, 'plassholderne er forskjellige').toBe(named.length);
  });

  test('funn 9: feilmeldingen ber ikke om det knappen gjør', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 9: «Prøv igjen» står ett sted');
    await page.goto('/');
    await page.locator('.ka-composer__field textarea').click();
    await page.keyboard.type('simuler feil');
    await page.keyboard.press('Enter');

    const alert = page.getByRole('alert');
    await expect(alert.getByRole('button', { name: 'Prøv igjen' })).toBeVisible();

    // Once in the box, and it is the button. The message used to end in
    // «Prøv igjen.» one line above a button of the same name.
    const occurrences = await page.evaluate(
      () => (document.querySelector('main')?.innerText.match(/Prøv igjen/g) ?? []).length,
    );
    expect(occurrences, '«Prøv igjen» står én gang i hovedkolonnen').toBe(1);

    await expectNoAxeViolations(page, 'feiltilstanden');
  });

  test('funn 10: avbryt-knappen sier «Avbryt»', async ({ page }, testInfo) => {
    covers(testInfo, 'brukerblikk 10: avbryt er merket');
    await page.goto('/');
    await page.locator('.ka-composer__field textarea').click();
    await page.keyboard.type('Hvordan jobber Nkom med måloppnåelse?');
    await page.keyboard.press('Enter');

    const stop = page.getByRole('button', { name: /Avbryt/ });
    await expect(stop).toBeVisible();

    // The word on screen, not only in the accessible name: a bare square is
    // not obviously «stop» however good the label is. And the name has to
    // start with the visible text — WCAG 2.5.3.
    await expect(stop).toContainText('Avbryt');
    const name = await stop.getAttribute('aria-label');
    expect(name?.startsWith('Avbryt'), 'navnet begynner med den synlige teksten').toBe(true);
  });
});
