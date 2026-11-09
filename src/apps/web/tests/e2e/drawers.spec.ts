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
 * Three widths, and they are requirements rather than devices. 1024 × 768 is
 * the small laptop punkt 17 measured rolling 51 px sideways. 720 is 1440 at
 * 200 % zoom, which is WCAG 1.4.4 Resize text (AA). 390 is a phone. The last
 * two are under 774, where the buttons that open the drawers stand in a row
 * at the top (digdir/kunnskapsassistenten#120).
 *
 * The numbers are written out rather than imported, for the reason
 * layout.spec.ts gives: a test that imports the number it checks agrees with
 * the code even when the code and the decision do not.
 */
const DRAWER_BREAKPOINT = 1139;
const NARROW = { width: 1024, height: 768 };
/** 1440 at 200 %. Under 67 + 640 + 67 = 774, so the buttons are in the row at the top. */
const ZOOMED = { width: 720, height: 900 };
/** A phone, with the row at the top. */
const PHONE = { width: 390, height: 844 };
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
      { message: `extra width ${where}` },
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
    .poll(async () => (await box(page, selector)).width, { message: `the width of ${where}` })
    .toBe(expected);
}

test.describe('drawers below 1139', () => {
  test('above the breakpoint the panel stands beside the answer, as before', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: bare under brytepunktet');
    await page.setViewportSize(WIDE);
    await page.goto('/');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toBeVisible();

    // And at the breakpoint itself: 1139 is «needs 1139», so still beside.
    // The drawers start below it.
    await page.setViewportSize({ width: DRAWER_BREAKPOINT, height: 900 });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.setViewportSize({ width: DRAWER_BREAKPOINT - 1, height: 900 });
    await expect(show(page, 'tråder og filter')).toBeVisible();
  });

  test('the rail button opens a drawer over the answer, from its own edge', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: åpne og lukke');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');

    const nav = await openDrawer(page, 'tråder og filter');
    expect(await box(page, 'dialog[open]')).toEqual({
      x: 0,
      right: NAV_DRAWER,
      width: NAV_DRAWER,
    });
    // A real `showModal()`, not a layer we drew ourselves. That is what brings
    // the focus trap, the inert background and Escape.
    expect(await nav.evaluate((element) => element.matches(':modal'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();

    // The sources panel comes from the other edge, flush with the window edge.
    await openDrawer(page, 'kilder');
    expect(await box(page, 'dialog[open]')).toEqual({
      x: NARROW.width - SOURCES_DRAWER,
      right: NARROW.width,
      width: SOURCES_DRAWER,
    });
  });

  for (const size of [NARROW, PHONE]) {
    const where = size === PHONE ? `${size.width}, from the row at the top` : `${size.width}`;

    test(`Escape closes and gives focus back to the button that opened it, ${where}`, async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'skuffer: Escape og fokus tilbake');
      await page.setViewportSize(size);
      await page.goto('/threads/nkom-maaloppnaaelse');

      const button = show(page, 'tråder og filter');
      await button.click();
      await expect(drawer(page, 'tråder og filter')).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(drawer(page, 'tråder og filter')).toBeHidden();

      // WCAG 2.4.3: focus must not fall to body when what the reader was on
      // goes away. `<dialog>` gives it back to what opened it.
      await expect(show(page, 'tråder og filter')).toBeFocused();
    });

    test(
      `focus is trapped in the drawer, and the background cannot be reached, ${where}`,
      MOCK,
      async ({ page }, testInfo) => {
        covers(testInfo, 'skuffer: fokusfelle (WCAG 2.4.3)');
        await page.setViewportSize(size);
        await page.goto('/threads/nkom-maaloppnaaelse');
        const nav = await openDrawer(page, 'tråder og filter');

        // The whole Tab walk stays inside the drawer. None of the stops may be
        // in the answer column or on the rail or row behind.
        const steps = await walkWithTab(page);
        expect(steps.length, 'the drawer has something to tab to').toBeGreaterThan(0);

        const outside = await nav.evaluate((dialog) =>
          [...document.querySelectorAll('[data-e2e-seen]')]
            .filter((element) => !dialog.contains(element))
            .map(
              (element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '?',
            ),
        );
        expect(outside, 'no tab stops outside the drawer').toEqual([]);

        // And the compose field in the answer is not just out of the tab
        // order, it cannot be reached: a modal `<dialog>` makes the rest of the
        // page inert.
        const reachable = await page.evaluate(() => {
          const composer = document.querySelector('.main textarea, .main input');
          if (!composer) return 'compose field not found';
          (composer as HTMLElement).focus();
          return document.activeElement === composer ? 'took focus' : 'inert';
        });
        expect(reachable, 'the background is inert').toBe('inert');
      },
    );
  }

  test('only one drawer at a time', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: én om gangen');
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');

    await openDrawer(page, 'tråder og filter');
    await page.keyboard.press('Escape');
    await openDrawer(page, 'kilder');

    // Not a rule of its own: rule B covers everything under 1440, and 1139 is
    // under 1440, so two drawers cannot be open because two sidebars cannot.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(drawer(page, 'kilder')).toBeVisible();
  });

  test('no horizontal scrolling at 1024, at 200 % zoom or on a phone', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: ingen vannrett rulling (WCAG 1.4.10)');

    for (const size of [NARROW, ZOOMED, PHONE]) {
      await page.setViewportSize(size);
      await page.goto('/threads/nkom-maaloppnaaelse');
      await expectNoSidewaysScroll(page, `${size.width} with both folded away`);

      for (const panel of ['tråder og filter', 'kilder'] as const) {
        await openDrawer(page, panel);
        await expectNoSidewaysScroll(page, `${size.width} with ${panel} open`);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
      }
    }
  });

  test('the answer column gets the room, and the whole window below 774', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skuffer: hovedkolonnens bredde');

    // 1024 − 67 − 67 = 890: the room between the rails, and it fills the
    // scrolling region. The reading width stops at its ceiling of 800 and is
    // centred in it. Two numbers since the scrolling region and the reading
    // width were split — `.main` fills the field so the wheel works in the
    // margin too, `.main-column` holds the text. The rails stay at the window
    // edges.
    await page.setViewportSize(NARROW);
    await page.goto('/threads/nkom-maaloppnaaelse');
    await expectWidth(page, '.main', NARROW.width - 2 * RAIL, 'the scrolling region at 1024');
    await expectWidth(page, '.main-column', MAIN_MAX, 'the reading width at 1024');

    // 720 and 390: under 67 + 640 + 67 = 774 the rails would leave the answer
    // column less than its floor, so their buttons stand in a row at the top
    // and the column takes the whole window.
    for (const size of [ZOOMED, PHONE]) {
      await page.setViewportSize(size);
      await expectWidth(page, '.main', size.width, `the answer column at ${size.width}`);
      await expectNoSidewaysScroll(page, `${size.width} with the row at the top`);
    }
  });

  test('a width dragged in a wide window does not follow into the drawer', async ({
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

    // A width chosen for a column beside the answer says nothing about one
    // that lies over it.
    expect((await box(page, 'dialog[open]')).width).toBe(NAV_DRAWER);
  });

  test(
    'the head in the drawer stands on the drawer’s own surface, in both modes',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'skuffer: hodet deler flate med skuffa');

      // `--ka-region-surface` has to be declared where the surface is
      // declared, so the sticky head does not drift from the ground it is
      // painted on. A drawer was a region the variable did not know about: the
      // panel inside it is a child of `<dialog>`, not of the landmark, so it
      // inherited the page's tone from `:root` and painted a grey band across
      // a white drawer.
      //
      // Measured before the fix, user review 4 finding 1: head #f3f4f4 on a
      // #ffffff drawer in light, #192029 on rgb(32 40 52) in dark, at both
      // 1024 and 720.
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
                // An empty head draws no line and no surface, so it would pass
                // this anyway. `filled` guards that the measurement actually
                // had something to measure.
                filled: (head?.children.length ?? 0) > 0,
                drawer: getComputedStyle(dialog).backgroundColor,
                head: head ? getComputedStyle(head).backgroundColor : 'head not found',
              };
            });

            expect(ground.filled, `${panel} at ${size.width} in ${scheme} has a head`).toBe(true);
            expect(ground.head, `the head in ${panel} at ${size.width} in ${scheme}`).toBe(
              ground.drawer,
            );

            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toBeHidden();
          }
        }
      }
    },
  );

  test('zero axe violations in light and dark, at every width', async ({ page }, testInfo) => {
    covers(testInfo, 'skuffer: tilgjengelig i begge moduser');

    for (const size of [NARROW, ZOOMED, PHONE]) {
      await page.setViewportSize(size);
      await page.goto('/threads/nkom-maaloppnaaelse');

      for (const scheme of ['light', 'dark'] as const) {
        await setColorScheme(page, scheme);
        await openDrawer(page, 'tråder og filter');
        await expectNoAxeViolations(page, `drawer at ${size.width} in ${scheme}`);
        await saveScreenshot(page, `skuff-${size.width}-${scheme}`);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
      }
    }
  });
});
