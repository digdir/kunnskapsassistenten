import { expect, test, type Locator, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations, saveScreenshot, setColorScheme } from './a11y';
import { walkWithTab, MOCK } from './helpers';

/**
 * The sidebars below 1139, where an open one no longer fits beside the answer.
 *
 * Everything the unit tests cannot reach lives here, and it is most of what
 * makes a drawer a drawer: the focus trap, the inert background, Escape, and
 * the absence of a horizontal scrollbar. jsdom has no top layer and does no
 * layout, so src/layout/DrawerShell.test.tsx measures the state and the markup
 * and stops there.
 *
 * Two widths, and both are requirements rather than devices. 1024 × 768 is the
 * small laptop punkt 17 measured rolling 51 px sideways. 720 is 1440 at 200 %
 * zoom, which is WCAG 1.4.4 Resize text (AA) — and it is under 774, so it is
 * also where the answer column's 640 px floor has to give way.
 *
 * The numbers are written out rather than imported, for the reason
 * layout.spec.ts gives: a test that imports the number it checks agrees with
 * the code even when the code and the decision do not.
 */
const DRAWER_BREAKPOINT = 1139;
const NARROW = { width: 1024, height: 768 };
/** 1440 at 200 %. The answer column cannot have its floor here: 67+640+67 = 774. */
const ZOOMED = { width: 720, height: 900 };
const WIDE = { width: 1440, height: 900 };

const NAV_DRAWER = 400;
const SOURCES_DRAWER = 432;
const RAIL = 67;
const MAIN_MAX = 800;

type Panel = 'tråder og filter' | 'kilder';

const show = (page: Page, panel: Panel) =>
  page.getByRole('button', { name: new RegExp(`^Vis ${panel}`) });
const drawer = (page: Page, panel: Panel) =>
  page.getByRole('dialog', { name: new RegExp(`^${panel}$`, 'i') });

/**
 * Wait for the slide-in to finish before measuring where anything is.
 *
 * `toBeVisible` does not wait for an animation, and Designsystemet slides the
 * drawer in from `translate: -3rem`. Measured mid-flight, a drawer flush
 * against the window edge reports x = −46. `allSettled` and not `all`: a
 * cancelled animation rejects, and three of the five here are cancelled in the
 * ordinary course of opening.
 */
async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
}

async function openDrawer(page: Page, panel: Panel): Promise<Locator> {
  await show(page, panel).click();
  const dialog = drawer(page, panel);
  await expect(dialog).toBeVisible();
  await settled(page);
  return dialog;
}

/**
 * The page's own width against the window's. Equal means nothing scrolls
 * sideways — which is the whole of WCAG 1.4.10 for this change.
 *
 * Polled and not read once, for the reason resize.spec.ts gives: a resize
 * reaches the page as an event React answers on its next render, and a single
 * read is the flaky kind that passes on a fast machine.
 */
async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const width = window.innerWidth;
          return document.documentElement.scrollWidth - width;
        }),
      { message: `overflødig bredde ${where}` },
    )
    .toBe(0);
}

const box = (page: Page, selector: string) =>
  page.evaluate((css) => {
    const rect = document.querySelector(css)!.getBoundingClientRect();
    return { x: Math.round(rect.x), right: Math.round(rect.right), width: Math.round(rect.width) };
  }, selector);

/**
 * A width, polled.
 *
 * Polled and not read once for the reason resize.spec.ts gives: resizing the
 * window reaches the page as an event React answers on its next render, so a
 * single read straight after `setViewportSize` is a race — and the flaky kind,
 * because it passes on a fast machine. It caught this suite out: the answer
 * column was read at its old 640 a tick before the 586 landed.
 */
async function expectWidth(page: Page, selector: string, expected: number, where: string) {
  await expect
    .poll(async () => (await box(page, selector)).width, { message: `bredden på ${where}` })
    .toBe(expected);
}

test.describe('skuffer under 1139', () => {
  test('over brytepunktet står panelet ved siden av svaret, som før', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: bare under brytepunktet');
    await page.setViewportSize(WIDE);
    await page.goto('/');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toBeVisible();

    // Og på brytepunktet selv: 1139 er «trenger 1139», altså fortsatt ved
    // siden av. Det er under det skuffene begynner.
    await page.setViewportSize({ width: DRAWER_BREAKPOINT, height: 900 });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.setViewportSize({ width: DRAWER_BREAKPOINT - 1, height: 900 });
    await expect(show(page, 'tråder og filter')).toBeVisible();
  });

  test('railknappen åpner en skuff over svaret, fra sin egen kant', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: åpne og lukke');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');

    const nav = await openDrawer(page, 'tråder og filter');
    expect(await box(page, 'dialog[open]')).toEqual({
      x: 0,
      right: NAV_DRAWER,
      width: NAV_DRAWER,
    });
    // Ekte `showModal()`, ikke et lag vi har tegnet selv. Det er den som tar
    // med seg fokusfelle, inert bakgrunn og Escape.
    expect(await nav.evaluate((element) => element.matches(':modal'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();

    // Kildepanelet kommer fra den andre kanten, flust mot vindusranda.
    await openDrawer(page, 'kilder');
    expect(await box(page, 'dialog[open]')).toEqual({
      x: NARROW.width - SOURCES_DRAWER,
      right: NARROW.width,
      width: SOURCES_DRAWER,
    });
  });

  test('Escape lukker og gir fokus tilbake til knappen som åpnet', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: Escape og fokus tilbake');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');

    const button = show(page, 'tråder og filter');
    await button.click();
    await expect(drawer(page, 'tråder og filter')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer(page, 'tråder og filter')).toBeHidden();

    // WCAG 2.4.3: fokus skal ikke falle til body når det leseren sto i
    // forsvinner. `<dialog>` gir det tilbake til det som åpnet den.
    await expect(show(page, 'tråder og filter')).toBeFocused();
  });

  test('fokus er fanget i skuffa, og bakgrunnen kan ikke nås', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: fokusfelle (WCAG 2.4.3)');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');
    const nav = await openDrawer(page, 'tråder og filter');

    // Hele Tab-vandringen skal ligge inne i skuffa. Ingen av stoppene får
    // være i svarkolonnen eller på railen bak.
    const steps = await walkWithTab(page);
    expect(steps.length, 'skuffa skal ha noe å tabbe til').toBeGreaterThan(0);

    const outside = await nav.evaluate((dialog) =>
      [...document.querySelectorAll('[data-e2e-seen]')]
        .filter((element) => !dialog.contains(element))
        .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '?'),
    );
    expect(outside, 'ingen tabbstopp utenfor skuffa').toEqual([]);

    // Og skrivefeltet i svaret er ikke bare utenfor tab-rekkefølgen, det er
    // utilgjengelig: en modal `<dialog>` gjør resten av siden inert.
    const reachable = await page.evaluate(() => {
      const composer = document.querySelector('.main textarea, .main input');
      if (!composer) return 'fant ikke skrivefeltet';
      (composer as HTMLElement).focus();
      return document.activeElement === composer ? 'tok fokus' : 'inert';
    });
    expect(reachable, 'bakgrunnen skal være inert').toBe('inert');
  });

  test('bare én skuff om gangen', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: én om gangen');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');

    await openDrawer(page, 'tråder og filter');
    await page.keyboard.press('Escape');
    await openDrawer(page, 'kilder');

    // Ikke en egen regel: regel B gjelder alt under 1440, og 1139 er under
    // 1440, så to skuffer kan ikke være åpne fordi to sidekolonner ikke kan.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(drawer(page, 'kilder')).toBeVisible();
  });

  test('ingen vannrett rulling ved 1024 eller ved 200 % zoom', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: ingen vannrett rulling (WCAG 1.4.10)');

    for (const size of [NARROW, ZOOMED]) {
      await page.setViewportSize(size);
      await page.goto('/threads/nkom-maaloppnaaelse');
      await expectNoSidewaysScroll(page, `${size.width} med begge foldet bort`);

      for (const panel of ['tråder og filter', 'kilder'] as const) {
        await openDrawer(page, panel);
        await expectNoSidewaysScroll(page, `${size.width} med ${panel} åpen`);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
      }
    }
  });

  test('hovedkolonnen får plassen, og gulvet viker når vinduet er for smalt', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: hovedkolonnens bredde');

    // 1024 − 67 − 67 = 890: det er plassen mellom railene, og den fyller
    // rulleregionen. Lesebredden stopper på taket sitt på 800 og sentreres i
    // den. To tall siden rulleregionen og lesebredden ble skilt — `.main`
    // fyller feltet så hjulet virker i margen òg, `.main-column` holder
    // teksten. Railene blir stående i vindusranda.
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');
    await expectWidth(page, '.main', NARROW.width - 2 * RAIL, 'rulleregionen ved 1024');
    await expectWidth(page, '.main-column', MAIN_MAX, 'lesebredden ved 1024');

    // 720: 67 + 640 + 67 = 774, altså 54 px for mye. Gulvet finnes for at
    // kildene skal kunne leses VED SIDEN AV svaret, og her er ingenting ved
    // siden av svaret — så det viker, teksten brytes, og ingenting klippes.
    // Her er de to like: plassen er 586, og lesebredden tar det som er igjen
    // fordi taket på 800 er romsligere enn feltet. `.main` er fortsatt det
    // rette å måle, for påstanden er at GULVET vek.
    await page.setViewportSize(ZOOMED);
    await expectWidth(page, '.main', ZOOMED.width - 2 * RAIL, 'hovedkolonnen ved 720');
    await expectNoSidewaysScroll(page, '720 etter at gulvet vek');
  });

  test('en bredde dratt i et vidt vindu følger ikke med inn i skuffa', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: lagret bredde ignoreres');
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto('/threads/nkom-maaloppnaaelse');

    // Up to the widest the window allows, which is remembered in ka.layout.v1:
    // 1920 − 67 (the sources rail) − 32 − 640 (the answer column's floor).
    // There is no ceiling of the panel's own since issue 80, round 2.
    const handle = page.getByRole('separator', { name: 'Endre bredde på tråder og filter' });
    await handle.focus();
    await page.keyboard.press('End');
    await expect(handle).toHaveAttribute('aria-valuenow', '1181');

    await page.setViewportSize(NARROW);
    await openDrawer(page, 'tråder og filter');

    // En bredde valgt for en kolonne som står ved siden av svaret sier
    // ingenting om en som ligger over det.
    expect((await box(page, 'dialog[open]')).width).toBe(NAV_DRAWER);
  });

  test(
    'hodet i skuffa står på skuffas egen flate, i begge moduser',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'skuffer: hodet deler flate med skuffa');

      // `--ka-region-surface` skal deklareres der flata deklareres, så det
      // klebrige hodet ikke driver fra grunnen det er malt på. En skuff var en
      // region variabelen ikke visste om: panelet inne i den er barn av
      // `<dialog>`, ikke av landemerket, så det arvet sidas tone fra `:root` og
      // malte et grått bånd tvers over en hvit skuff.
      //
      // Målt før fiksen, brukerblikk 4 funn 1: hode #f3f4f4 på en #ffffff skuff
      // i lys, #192029 på rgb(32 40 52) i mørk, på både 1024 og 720.
      for (const size of [NARROW, ZOOMED]) {
        await page.setViewportSize(size);
        await page.goto('/threads/nkom-maaloppnaaelse');

        for (const scheme of ['light', 'dark'] as const) {
          await setColorScheme(page, scheme);

          for (const panel of ['tråder og filter', 'kilder'] as const) {
            await openDrawer(page, panel);

            const ground = await page.evaluate(() => {
              const dialog = document.querySelector('dialog[open]')!;
              const head = dialog.querySelector('.view-head');
              return {
                // Et tomt hode tegner ingen linje og ingen flate, så det ville
                // bestått denne uansett. `fylt` er vakta på at målingen faktisk
                // hadde noe å måle.
                fylt: (head?.children.length ?? 0) > 0,
                skuff: getComputedStyle(dialog).backgroundColor,
                hode: head ? getComputedStyle(head).backgroundColor : 'fant ikke hodet',
              };
            });

            expect(ground.fylt, `${panel} ved ${size.width} i ${scheme} skal ha et hode`).toBe(
              true,
            );
            expect(ground.hode, `hodet i ${panel} ved ${size.width} i ${scheme}`).toBe(
              ground.skuff,
            );

            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toBeHidden();
          }
        }
      }
    },
  );

  test('null axe-brudd i lys og mørk, på begge bredder', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: tilgjengelig i begge moduser');

    for (const size of [NARROW, ZOOMED]) {
      await page.setViewportSize(size);
      await page.goto('/threads/nkom-maaloppnaaelse');

      for (const scheme of ['light', 'dark'] as const) {
        await setColorScheme(page, scheme);
        await openDrawer(page, 'tråder og filter');
        await expectNoAxeViolations(page, `skuff ved ${size.width} i ${scheme}`);
        await saveScreenshot(page, `skuff-${size.width}-${scheme}`);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
      }
    }
  });
});
