import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations, saveScreenshot, setColorScheme } from './a11y';
import {
  ask,
  chooseFacetValue,
  composer,
  expectEveryStepReachable,
  walkWithTab,
  MOCK,
  REAL_ANSWER,
} from './helpers';

/**
 * The shell: the three slots, the routes, the skip link and dark mode.
 *
 * This is the first spec, and it covers what is actually merged. The four
 * views are still `ViewPlaceholder` on `main` — nothing mounts them — so
 * there is no filter, no thread list, no chat and no sources panel to test
 * yet. `docs/review/funksjonssjekk.md` keeps the score.
 *
 * Every test asserts what a user does, not how it is built: a landmark by
 * its accessible name rather than a class, a button by its Norwegian label
 * rather than a test id.
 */

/**
 * The level 1 heading names the application on every route, and the thread
 * title is the level 2 under it. A page named after the thread would rename
 * itself mid-session, the first time a title is generated from a question.
 */
const ROUTES = {
  newConversation: {
    path: '/',
    heading: 'Kunnskapsassistenten',
    title: 'Ny tråd – Kunnskapsassistenten',
    name: 'ny-samtale',
  },
  thread: {
    path: '/threads/nkom-maaloppnaaelse',
    heading: 'Kunnskapsassistenten',
    title: 'NKOM måloppnåelse – Kunnskapsassistenten',
    subheading: 'NKOM måloppnåelse',
    name: 'traad',
  },
} as const;

/** The pages linked from the foot of the navigation panel, in its order. */
const INFO_PAGES = [
  { path: '/onboarding', title: 'Onboarding' },
  { path: '/endringslogg', title: 'Endringslogg' },
  { path: '/om-prosjektet', title: 'Om prosjektet' },
] as const;

/**
 * The page is the one asked for, and not the catch-all. Both are checked:
 * the catch-all has a level 1 of its own, so a heading alone would only say
 * which page it is not. And the browser's title says the same (WCAG 2.4.2):
 * every address was «Kunnskapsassistenten» until #242.
 */
async function expectInfoPage(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.getByText('Siden finnes ikke')).toHaveCount(0);
  await expect(page).toHaveTitle(`${title} – Kunnskapsassistenten`);
}

test.describe('skallet', () => {
  for (const route of Object.values(ROUTES)) {
    test(
      `${route.path} laster med landemerker og én h1`,
      route === ROUTES.thread ? MOCK : {},
      async ({ page }, testInfo) => {
        covers(testInfo, 'rutene lastes · landemerkene finnes');
        await page.goto(route.path);

        // The page title first: a route that renders an error boundary would
        // still have landmarks.
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        // The level 1 names the app on every route; the browser's title names
        // the page (WCAG 2.4.2, #242).
        await expect(page).toHaveTitle(route.title);
        if ('subheading' in route) {
          await expect(
            page.getByRole('heading', { level: 2, name: route.subheading }),
          ).toBeVisible();
        }

        // The thread title is a section of the page, not the page itself.
        if ('subheading' in route) {
          await expect(
            page.getByRole('heading', { level: 2, name: route.subheading }),
          ).toBeVisible();
        }

        // The slots are named after the views in them, never after the side
        // they sit on. That is the rule the names have to prove.
        await expect(page.getByRole('navigation', { name: 'Tråder og filter' })).toBeVisible();
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Kilder' })).toBeAttached();

        await expect(page.locator('html')).toHaveAttribute('lang', 'nb');

        await expectNoAxeViolations(page, `${route.path} i lys modus`);
      },
    );
  }

  test('hopp-lenka er første Tab-stopp og hopper forbi navigasjonspanelet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'hopp-lenke fungerer med Tab');

    // The thread route, not the front page: the promise a skip link makes is
    // «you land in the content», and only a route with something focusable in
    // it can keep that promise. The front page is checked separately below,
    // for the weaker promise it can keep.
    await page.goto(ROUTES.thread.path);

    // Vent på lenka før tastetrykket. Et Tab som lander før den er tegnet går
    // til noe annet, og testen blir rød uten at noe er galt — målt under
    // anmeldelsen av #59, sammen med søsteren på linje 126.
    const skipLink = page.getByRole('link', { name: 'Hopp til hovedinnhold' });
    await expect(skipLink).toBeAttached();

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    // Designsystemet's SkipLink is only visible while it has focus, which is
    // the whole point of it.
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);

    await page.keyboard.press('Tab');
    const landing = await page.evaluate(() => ({
      inMain: Boolean(document.getElementById('main-content')?.contains(document.activeElement)),
      inNav: Boolean(document.querySelector('nav')?.contains(document.activeElement)),
    }));
    expect(landing.inMain, 'neste Tab etter hoppet skal stå inne i hovedinnholdet').toBe(true);
    expect(landing.inNav, 'hoppet skal ikke lande i navigasjonspanelet').toBe(false);
  });

  test('hopp-lenka forbigår navigasjonspanelet også når hovedinnholdet er tomt', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'hopp-lenke fungerer med Tab');

    // On the front page `main` holds no focusable element, so the browser
    // leaves `document.activeElement` on `<body>` and continues the walk from
    // the fragment target. Focus therefore lands AFTER main, not inside it.
    // That is the browser doing the right thing with an empty region, not a
    // defect: what matters is that the walk does not start over in the
    // sidebar. Measured before it was asserted.
    await page.goto(ROUTES.newConversation.path);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');

    const inNav = await page.evaluate(() =>
      Boolean(document.querySelector('nav')?.contains(document.activeElement)),
    );
    expect(inNav, 'hoppet skal ikke lande i navigasjonspanelet').toBe(false);
  });

  /**
   * Hopp-lenke nummer to. «Hopp til hovedinnhold» lander øverst i svaret;
   * skrivefeltet står nederst i det og var tabbstopp 22 — for den handlingen
   * en leser gjør oftest (reise 7 og 15, punkt 8 på lista).
   *
   * Rekkefølgen er låst i Tab-gjennomgangen under. Dette er den andre
   * halvdelen: at lenka faktisk gjør det den heter.
   */
  test('hopp-lenke nummer to setter skrivemerket i feltet', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'hopp-lenke til skrivefeltet');
    await page.goto(ROUTES.thread.path);

    /*
     * Vent på lenka før tastetrykkene. Uten dette kan første Tab lande før
     * den andre hopp-lenka er tegnet, og testen blir rød uten at noe er galt:
     * én rød av 116 i anmeldelsen av #59, grønn alene tre ganger etterpå, ved
     * load average 9,4.
     */
    const second = page.getByRole('link', { name: /^Hopp til skrivefeltet/ });
    await expect(second).toBeAttached();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(second).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('.ka-composer__field textarea')).toBeFocused();
  });

  test('panelene kan skjules og vises igjen, og knappen sier hvilken tilstand den er i', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelene kan skjules/vises');
    await page.goto(ROUTES.newConversation.path);

    const hide = page.getByRole('button', { name: 'Skjul tråder og filter' });
    await expect(hide).toHaveAttribute('aria-expanded', 'true');

    await hide.click();

    const show = page.getByRole('button', { name: 'Vis tråder og filter' });
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    // The content stays in the DOM and is hidden with `hidden`, so
    // aria-controls keeps pointing at something that exists.
    await expect(page.getByRole('navigation', { name: 'Tråder og filter' })).toHaveAttribute(
      'data-collapsed',
      'true',
    );

    // The button the user pressed must still hold focus. A control that
    // unmounts itself drops the keyboard at the top of the document.
    await expect(show).toBeFocused();

    await show.click();
    await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await expectNoAxeViolations(page, 'skallet etter skjul og vis');
  });

  /**
   * Reise 14: `/tull` ga en HELT tom side — ingen `main`, ingen overskrift,
   * ingen hopp-lenke — fordi `Routes` tegner null når ingenting treffer.
   *
   * Sidekolonnene blir stående med vilje: trådlista og filteret er veien til
   * noe som finnes. Det som ikke skal stå der er en fungerende samtale under
   * ordene «siden finnes ikke».
   */
  test('en adresse som ikke finnes er en side, ikke et tomrom', async ({ page }, testInfo) => {
    covers(testInfo, 'oppsamlingsrute: /tull');
    await page.goto('/tull');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Siden finnes ikke' })).toBeVisible();
    await expect(page).toHaveTitle('Siden finnes ikke – Kunnskapsassistenten');
    await expect(page.getByRole('link', { name: 'Gå til forsiden' })).toBeVisible();

    // Ikke en samtale: skrivefeltet hører til forsida, ikke til denne.
    await expect(page.locator('.ka-composer__field textarea')).toHaveCount(0);
    // Men veien videre står der.
    await expect(page.getByRole('navigation', { name: 'Tråder og filter' })).toBeVisible();

    await expectNoAxeViolations(page, 'oppsamlingsruta');

    await page.getByRole('link', { name: 'Gå til forsiden' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.ka-composer__field textarea')).toBeVisible();
  });

  /**
   * Kan 2 from the review of #226: nothing tested that the addresses give the
   * pages. The unit tests render `InfoPage` directly, so with the three
   * `Route`s taken out of App.tsx every test was green, and every link in the
   * foot led to «Siden finnes ikke».
   *
   * The addresses are written out here rather than read from `infoPages`:
   * they are the ones the old Kunnskapsassistenten uses, and a link somebody
   * saved there has to land somewhere here. The reload is that saved link.
   *
   * Axe runs every rule it has, not just the WCAG set. These are pages of
   * written content, and the empty header cell in the table on /onboarding
   * was a best-practice rule that the WCAG set does not run.
   */
  test('lenkene i foten gir de tre sidene, også etter en reload', async ({ page }, testInfo) => {
    covers(testInfo, 'sidene i foten');
    await page.goto(ROUTES.newConversation.path);

    const foot = page
      .getByRole('navigation', { name: 'Tråder og filter' })
      .getByRole('list', { name: 'Om Kunnskapsassistenten' });
    await expect(foot.getByRole('link')).toHaveText(INFO_PAGES.map((info) => info.title));

    for (const info of INFO_PAGES) {
      const link = foot.getByRole('link', { name: info.title });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${info.path}$`));
      await expectInfoPage(page, info.title);
      await expect(link).toHaveAttribute('aria-current', 'page');

      await page.reload();
      await expectInfoPage(page, info.title);

      for (const [scheme, mode] of [
        ['light', 'lys'],
        ['dark', 'mørk'],
      ] as const) {
        await setColorScheme(page, scheme);
        await expectNoAxeViolations(page, `${info.path} i ${mode} modus`, { allRules: true });
      }
      await setColorScheme(page, 'light');
    }
  });

  /**
   * En delt lenke som er blitt gammel tegnet før en fersk, fungerende
   * forside under en adresse som navnga en samtale. Leseren fikk vite
   * ingenting.
   *
   * Ruta er en helt vanlig `/threads/:threadId` og tegner hovedkolonnen på
   * vanlig vis; det er viewet i kolonnen som svarer «Fant ikke tråden». Derfor
   * står hopp-lenka til skrivefeltet med i denne testen og ikke i sin egen:
   * den ble tegnet ut fra ruta, og pekte på et element som ikke var i
   * dokumentet, så Tab Tab + Enter lot fokus bli stående på en blindvei.
   */
  test('en tråd som ikke finnes sier det, i stedet for å se ut som en ny samtale', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'ukjent tråd-id');
    await page.goto('/threads/finnes-ikke-her');

    await expect(page.getByRole('heading', { level: 2, name: 'Fant ikke tråden' })).toBeVisible();
    await expect(page).toHaveTitle('Fant ikke tråden – Kunnskapsassistenten');
    await expect(composer(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Gå til forsiden' })).toBeVisible();

    // Ingen hopp-lenke til et felt som ikke er der, og steg to i
    // tabbrekkefølgen er en knapp som gjør noe. Hodet i navigasjonspanelet
    // har «Tråder» først og skjul-knappen sist, også i DOM-en (#262).
    await expect(page.getByRole('link', { name: /^Hopp til skrivefeltet/ })).toHaveCount(0);
    const steps = await walkWithTab(page);
    expect(steps[0]?.name).toBe('Hopp til hovedinnhold');
    expect(steps[1]?.name).toBe('Tråder');
    expect(steps[2]?.name).toBe('Skjul tråder og filter');
    expectEveryStepReachable(steps, 'en tråd som ikke finnes');

    await expectNoAxeViolations(page, 'ukjent tråd');
  });

  /**
   * Reise 16, punkt 9: å legge sammen et panel, hake av tre filtre og trykke
   * F5 satte alt tilbake til `defaultLayout`.
   *
   * To ting måles hver for seg, fordi de ligger i hver sin nøkkel og ryker av
   * hver sin grunn: `ka.layout.v1` er formet av plassene, `ka.filter.v1` av
   * korpuset.
   */
  test('panelet og filtervalget står slik leseren forlot dem etter en reload', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'husket tilstand over reload');
    await page.goto(ROUTES.newConversation.path);

    // Filteret først, mens panelet ennå er åpent.
    await chooseFacetValue(page, 'Dokumenttyper', 'Årsrapport');
    await page.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    await expect(page.getByRole('button', { name: 'Vis tråder og filter' })).toBeVisible();

    await page.reload();

    // Panelet er fortsatt sammenlagt …
    await expect(page.getByRole('button', { name: 'Vis tråder og filter' })).toBeVisible();

    // … og valget er der når leseren åpner det igjen.
    await page.getByRole('button', { name: 'Vis tråder og filter' }).click();
    await expect(page.getByText(/^1 av \d+ valgt$/).first()).toBeVisible();

    // Og ingenting av dette overlever at leseren tømmer lageret sitt: det er
    // en bekvemmelighet, ikke en tilstand appen er avhengig av.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toBeVisible();
    await expect(page.getByText(/^1 av \d+ valgt$/)).toHaveCount(0);
  });

  test('mørk modus byttes uten at sida lastes på nytt', async ({ page }, testInfo) => {
    covers(testInfo, "window.ka.colorScheme.set('dark') bytter tema uten reload");
    await page.goto(ROUTES.newConversation.path);

    // A sentinel on the window: it survives a re-render and not a reload, so
    // it is what proves the switch did not reload the page.
    await page.evaluate(() => {
      (window as unknown as { kaSentinel?: number }).kaSentinel = 1;
    });

    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).background);

    await setColorScheme(page, 'dark');

    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).background);
    expect(darkBackground, 'mørk modus skal male en annen flate enn lys').not.toBe(lightBackground);

    const survived = await page.evaluate(
      () => (window as unknown as { kaSentinel?: number }).kaSentinel,
    );
    expect(survived, 'sida skal ikke ha lastet på nytt').toBe(1);

    await expectNoAxeViolations(page, 'skallet i mørk modus');

    // The choice is stored per browser, so a reload keeps it.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');

    await setColorScheme(page, 'light');
  });

  test(
    'Tab gjennom hele skallet: hvert steg har et norsk navn og en synlig fokusring',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'tastatur: Tab gjennom viewet, synlig fokus og rekkefølge');
      await page.goto(ROUTES.thread.path);

      /*
       * Vent på den andre hopp-lenka før vandringen. Den tegnes bare når det
       * finnes et skrivefelt å hoppe til, så en vandring som starter før
       * skrivefeltet er der finner den første knappen i navigasjonspanelet som
       * steg 2 og blir rød på rekkefølgen — målt i full suite 15.09, grønn alene
       * rett etterpå.
       * Fjerde tilfelle av samme race i denne fila og i chat.spec.ts.
       */
      await expect(page.getByRole('link', { name: /^Hopp til skrivefeltet/ })).toBeAttached();

      const steps = await walkWithTab(page);

      expect(steps.length, 'Tab skal nå noe i det hele tatt').toBeGreaterThan(3);
      expectEveryStepReachable(steps, 'skallet');

      // Reading order: the skip links come first, then the slots in the order
      // the shell renders them, so the first stops after them are the primary
      // sidebar's head: «Tråder», then the button that hides the panel, which
      // ends the row on screen and in the DOM (#262).
      //
      // «Hopp til skrivefeltet» sits second on purpose. The compose field is at
      // the bottom of the answer and was tab stop 22 — for the thing a reader
      // does most often (reise 7 and 15, punkt 8 on the ranked list) — so it has
      // to be reachable before the navigation panel, not after it.
      expect(steps[0]?.name).toBe('Hopp til hovedinnhold');
      // Navnet i klartekst her, og ikke som prefiks slik de tre oppslagene over
      // er: denne testen handler nettopp om at hvert tabbsteg har et lesbart
      // norsk navn, så det er navnet selv som er påstanden. Hurtigtasten står i
      // lenketeksten fordi hintet ved feltet er på vei ut (H3 i
      // design/hoydebudsjett-forslag-2026-09-21.md).
      expect(steps[1]?.name).toBe('Hopp til skrivefeltet (Ctrl + /)');
      expect(steps[2]?.name).toBe('Tråder');
      expect(steps[3]?.name).toBe('Skjul tråder og filter');
    },
  );

  test(
    'dokumentet ruller aldri, uansett hvor mange svar tråden har',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'skallet: bare regionene ruller, aldri sida');

      /*
       * Det er `<main>` og de to panelene som ruller. Sida selv skal aldri gjøre
       * det: skallet fyller vinduet, og en rullelist på dokumentet betyr at noe
       * har lagt seg utenfor regionen sin.
       *
       * Målt 21.09, og det tok to svar å se det: `.ds-sr-only` er
       * `position: absolute`, og i en `overflow: auto`-region som selv er
       * `static` blir containing block hele dokumentet. Skjermlesertekst langt
       * nede i det andre svaret havnet da på y 1916 og 1983 i et vindu på 900,
       * og `scrollHeight` ble 1984. Hvitt felt under `html`, som ble sett på
       * skjermen.
       *
       * To svar og ikke ett, fordi ett svar ikke er høyt nok til å skyve teksten
       * forbi vindusbunnen. Testen måler nettopp det tilfellet som var rødt.
       */
      await page.goto('/');
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      await ask(page, 'Hva mer sier rapporten?');
      await expect(page.locator('.ka-message--assistant')).toHaveCount(2);

      const room = await page.evaluate(() => ({
        scrollHeight: document.scrollingElement!.scrollHeight,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
      }));

      expect(room.scrollHeight, 'dokumentet skal ikke være høyere enn vinduet').toBe(
        room.innerHeight,
      );
      expect(room.scrollY, 'og det skal ikke stå rullet').toBe(0);

      // Og svaret er fortsatt der å rulle i — det er regionen som ruller, ikke
      // sida. Uten dette ville et `overflow: hidden` bestått testen over.
      const main = await page.evaluate(() => {
        const element = document.querySelector('.main')!;
        return { kanRulle: element.scrollHeight > element.clientHeight };
      });
      expect(main.kanRulle, 'hovedkolonnen skal ha noe å rulle i').toBe(true);
    },
  );

  test(
    'rullehjulet virker i hele midtfeltet, ikke bare over kolonnen',
    REAL_ANSWER,
    async ({ page }, testInfo) => {
      covers(testInfo, 'skallet: hele midtfeltet ruller');

      /*
       * Hjulet gjør ingenting uten at pekeren står over en ruller. Da kolonnen
       * og rulleregionen var samme boks, var det grå på hver side av de 800 px
       * dødt: meldt 21.09 på 5182, hjulet skulle virke med pekeren der også,
       * for området var ingenmannsland.
       *
       * Pekeren settes midt mellom kolonnens ytterkant og kildepanelet, altså i
       * det som var ingenmannsland. Målt her framfor regnet ut: hvor bred margen
       * er, avhenger av vindusbredden og av hvilke paneler som er åpne.
       */
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      // To svar, fordi ett ikke fyller 1080 px og et hjul over en region uten
      // noe å rulle i står stille av helt andre grunner enn den som måles her.
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      await ask(page, 'Hva mer sier rapporten?');
      await expect
        .poll(() =>
          page.evaluate(() => {
            const main = document.querySelector('.main')!;
            return main.scrollHeight > main.clientHeight;
          }),
        )
        .toBe(true);

      /*
       * Punktet måles fra kolonnen til kildepanelet, ikke inne i `.main`, og det
       * er med vilje: det er den samme skjermkoordinaten før og etter denne
       * endringa. Før lå den UTENFOR rulleregionen, som var 800 px bred og
       * sentrert; nå ligger den inni, fordi regionen fyller feltet. Måler man i
       * stedet margen inne i `.main`, er den null før endringa, og da er det
       * målingen som feiler og ikke hjulet.
       */
      const column = (await page.locator('.main-column').boundingBox())!;
      const sidebar = (await page.locator('.secondary-sidebar').boundingBox())!;

      const margin = sidebar.x - (column.x + column.width);
      expect(margin, 'det skal finnes grått mellom kolonnen og panelet').toBeGreaterThan(40);

      /*
       * Tilbake til toppen først, og det er ikke pynt: samtalen holder seg selv
       * ved bunnen mens svaret strømmer, så `scrollTop` er alt større enn null
       * når spørsmålet er besvart. Uten denne nullstillingen består testen av
       * chat-visningens egen rulling og måler ingenting om hjulet — den var
       * grønn med kolonnen tilbake på rulleregionen, som er nettopp tilstanden
       * den skal fange.
       */
      await page.evaluate(() => (document.querySelector('.main')!.scrollTop = 0));
      await expect
        .poll(() => page.evaluate(() => document.querySelector('.main')!.scrollTop))
        .toBe(0);

      await page.mouse.move(
        Math.round(column.x + column.width + margin / 2),
        await page.$eval('.main', (m) => m.getBoundingClientRect().y + m.clientHeight / 2),
      );
      await page.mouse.wheel(0, 400);

      await expect
        .poll(() => page.evaluate(() => document.querySelector('.main')!.scrollTop), {
          message: 'hovedkolonnen skal ha rullet av hjulet i margen',
        })
        .toBeGreaterThan(0);
    },
  );

  test('skjermbilder av rutene i lys og mørk modus', async ({ page }, testInfo) => {
    covers(testInfo, 'visuell gjennomgang per merge');
    for (const route of Object.values(ROUTES)) {
      await page.goto(route.path);
      await setColorScheme(page, 'light');
      await saveScreenshot(page, `${route.name}-lys`);
      await setColorScheme(page, 'dark');
      await saveScreenshot(page, `${route.name}-mork`);
      await expectNoAxeViolations(page, `${route.path} i mørk modus`);
      await setColorScheme(page, 'light');
    }
  });
});
