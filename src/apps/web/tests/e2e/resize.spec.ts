import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  covers,
  expectAllContentInLandmarks,
  expectNoAxeViolations,
  saveScreenshot,
  setColorScheme,
} from './a11y';
import { walkWithTab } from './helpers';

/**
 * The edges between the panels, which the reader can move.
 *
 * Lars's vision asks for columns that can be resized in the GUI, and punkt 24
 * of the brukerreise list calls it essential: the answer and the source it
 * rests on have to be readable side by side, and 640 px of answer beside
 * 336 px of excerpt is not always the split a reader wants.
 *
 * What is measured here is the product's promise rather than the
 * implementation: the panel is DRAWN at the width the separator reports, the
 * keyboard reaches everywhere the pointer does (WCAG 2.5.7), the choice
 * survives a reload, and nothing the reader can drag produces a horizontal
 * scrollbar at the three widths the product is used at.
 *
 * The numbers are the decision's, written out rather than imported, for the
 * same reason as in layout.spec.ts: a test that imports the number it checks
 * agrees with the code even when the code and the decision do not.
 */
const NAV_DEFAULT = 400;
const SOURCES_DEFAULT = 432;
const SOURCES_FLOOR = 336;
const RAIL = 67;

/**
 * The widest a panel can be. Since Simens issue 80, round 2, a panel has no
 * ceiling of its own — the 480 and the 560 are gone — and takes what the
 * window leaves when the answer column stands on its floor, 640. The other
 * sidebar takes 67 as a rail, flush against the column, or its own width and
 * a 32 px gap when it is open. #5's numbers, 30.09.
 */
const NAV_WIDEST_1920 = 1181; // 1920 − 67 − 640 − 32
const NAV_WIDEST_1680_BESIDE_SOURCES = 544; // 1680 − 432 − 32 − 640 − 32

/**
 * Where a drag folds the navigation panel away, and where it opens it again
 * (Simens issue 80, round 2). It folds when the width the drag asks for is
 * under half its floor, 200, and opens again at half the floor and 16 more,
 * so a hand hovering at the line does not make it flicker.
 */
const NAV_FOLDS_BELOW = 200;
const NAV_OPENS_AT = 216;

/**
 * The navigation panel drawn narrower than it is stored, which is what «the
 * ceiling is the window's» needs to be able to fail. With 1181 stored (End at
 * 1920, the sources panel a rail) and the sources panel then opened, a panel
 * first gives up what it was made wider by, and a widening takes room from the
 * answer column, never from the other panel. So the sources panel keeps its
 * 432, and the navigation panel takes what is left beside the answer column's
 * floor. Measured on #224 (6bb2e24).
 */
const NAV_AT_1920_BESIDE_SOURCES = 784; // 1920 − 432 − 32 − 640 − 32
const NAV_AT_1600 = 464; // 1600 − 432 − 32 − 640 − 32
const NAV_AT_1680 = 544; // 1680 − 432 − 32 − 640 − 32

/** Arrow keys move the edge this far; Shift makes it a stride. */
const STEP = 16;
const STRIDE = 64;

/** 1536 has room to move an edge; 1440 and 1280 are the other two states. */
const ROOMY = 1536;
const HEIGHT = 900;

const WIDTHS = [1280, 1440, 1536];

type Panel = 'tråder og filter' | 'kilder';

function separator(page: Page, panel: Panel): Locator {
  return page.getByRole('separator', { name: `Endre bredde på ${panel}` });
}

function panelWidth(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (css) => Math.round(document.querySelector(css)!.getBoundingClientRect().width),
    selector,
  );
}

/**
 * The drawn width, polled.
 *
 * Polled and not read once, because two of the things that change it —
 * resizing the window, and the layout rule that collapses a sidebar — reach
 * the page as an event React answers on its next render. A single read is a
 * race, and it is the flaky kind: it passes on a fast machine.
 */
async function expectPanelWidth(page: Page, selector: string, expected: number, where: string) {
  await expect
    .poll(() => panelWidth(page, selector), { message: `bredden på ${where}` })
    .toBe(expected);
}

/**
 * Tab until the separator has focus.
 *
 * `focus()` would be quicker and would prove less: Chromium only paints
 * `:focus-visible` when the focus came from the keyboard, so a programmatic
 * focus shows no ring — and the ring is what this is about. It also measures
 * the thing WCAG 2.1.1 actually asks: that the edge can be REACHED from the
 * keyboard, not only used once it has focus.
 */
async function tabTo(page: Page, handle: Locator, limit = 60): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await handle.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('skillet ble aldri nådd med Tab');
}

/** Opens the sources panel the way a user does, with its own button. */
async function showSources(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Vis kilder' }).click();
  await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
}

/** Drags an edge by `by` CSS pixels along the row. */
async function drag(page: Page, handle: Locator, by: number): Promise<void> {
  const box = (await handle.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // Two moves, not one: a single jump from press to release is a gesture no
  // hand makes, and it would pass over an implementation that only listens
  // while the pointer is already moving.
  await page.mouse.move(box.x + box.width / 2 + by / 2, y);
  await page.mouse.move(box.x + box.width / 2 + by, y);
  await page.mouse.up();
}

test.describe('panelbredder', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: ROOMY, height: HEIGHT });
  });

  test('musa drar navigasjonspanelet bredere, og panelet tegnes der', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: dra med mus');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);

    await drag(page, handle, 60);

    // The drawn width is the assertion, not the stored one: a model that
    // moved while the panel stood still is the bug this is here to catch.
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_DEFAULT + 60,
      'navigasjonspanelet etter dragingen',
    );
    await expect(handle).toHaveAttribute('aria-valuenow', String(NAV_DEFAULT + 60));
  });

  test('musa drar kildepanelet, som ligger på den andre sida av hovedkolonnen', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: dra med mus');
    await page.goto('/');
    await showSources(page);

    const handle = separator(page, 'kilder');
    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_DEFAULT);

    // Toward the inline end, which for this panel means narrower: the edge
    // follows the hand, and the panel is on the other side of the edge.
    await drag(page, handle, 40);

    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_DEFAULT - 40);
  });

  /*
   * A panel dragged past half its floor folds away, and the drag goes on:
   * dragged back, it opens again before the pointer is let go (Simens issue
   * 80, round 2). The press is at x 400, the panel's edge, so the width the
   * drag asks for is the pointer's x.
   */
  test('dratt forbi halve gulvet lukkes panelet, og tilbake åpnes det igjen før slipp', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: lukkes og åpnes under dragingen');
    await page.goto('/');
    const handle = separator(page, 'tråder og filter');
    const box = (await handle.boundingBox())!;
    expect(box.x <= NAV_DEFAULT && NAV_DEFAULT <= box.x + box.width, 'trykket er på kanten').toBe(
      true,
    );
    const y = box.y + box.height / 2;

    await page.mouse.move(NAV_DEFAULT, y);
    await page.mouse.down();
    await page.mouse.move(300, y);
    await page.mouse.move(NAV_FOLDS_BELOW - 11, y);
    await expectPanelWidth(page, '.primary-sidebar', RAIL, `dratt til x ${NAV_FOLDS_BELOW - 11}`);

    // Under the line where it opens again, it stays folded.
    await page.mouse.move(NAV_OPENS_AT - 1, y);
    await expectPanelWidth(page, '.primary-sidebar', RAIL, `tilbake til x ${NAV_OPENS_AT - 1}`);

    // At it, the panel is back at the width the drag began from, before the
    // pointer is let go.
    await page.mouse.move(NAV_OPENS_AT, y);
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, `tilbake til x ${NAV_OPENS_AT}`);

    await page.mouse.up();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'etter slipp');
  });

  test('slippes pekeren mens panelet er lukket, går fokuset til Vis-knappen', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: lukkes og åpnes under dragingen');
    await page.goto('/');
    const handle = separator(page, 'tråder og filter');
    const y = (await handle.boundingBox())!.y + 100;

    await page.mouse.move(NAV_DEFAULT, y);
    await page.mouse.down();
    await page.mouse.move(300, y);
    await page.mouse.move(NAV_FOLDS_BELOW - 11, y);
    await page.mouse.up();

    // Folded, and the focus on the control that brings the panel back.
    const show = page.getByRole('button', { name: 'Vis tråder og filter' });
    await expect(show).toBeFocused();
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    await expectPanelWidth(page, '.primary-sidebar', RAIL, 'lukket etter slipp');

    // Opened again, it has the width the drag began from.
    await show.click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'åpnet igjen');
  });

  /*
   * The pointer path without a drag (WCAG 2.5.7). It was two arrow buttons in
   * the panel head until Simens issue 81 took them away; now a click on the
   * edge itself does it. One click takes the panel as wide as it can be, the
   * next one back to the default. #202.
   */
  test('ett klikk på kanten gjør panelet så bredt det kan bli, og ett til setter det tilbake', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: pekervei uten draging (WCAG 2.5.7)');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');
    const handle = separator(page, 'tråder og filter');

    // `click()` is press and release on the same spot, with no movement in
    // between, which is exactly what 2.5.7 asks to be enough. No
    // mouse.down/move here, on purpose.
    await handle.click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_WIDEST_1920, 'etter ett klikk');
    // And the separator reports the same number the panel is drawn at.
    await expect(handle).toHaveAttribute('aria-valuenow', String(NAV_WIDEST_1920));

    await handle.click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'etter ett klikk til');
    await expect(handle).toHaveAttribute('aria-valuenow', String(NAV_DEFAULT));
  });

  test('en skjelvende hånd klikker, en draging drar', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: pekervei uten draging (WCAG 2.5.7)');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');
    const handle = separator(page, 'tråder og filter');

    // Three pixels between press and release is a hand that did not keep
    // quite still, and it is still a click. `CLICK_SLOP` is 4, where Windows
    // starts a drag.
    await drag(page, handle, 3);
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_WIDEST_1920,
      'etter et klikk med skjelving',
    );

    await handle.focus();
    await page.keyboard.press('Enter');
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'etter Enter');

    // Forty is a drag. The browser sends `click` after it too, and that must
    // not take the panel to its ceiling on top of the drag.
    await drag(page, handle, 40);
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT + 40, 'etter en draging på 40');
  });

  test('en kollapset sidekolonne har ingen kant å dra i', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ett skille per åpen sidekolonne');
    await page.goto('/');

    await expect(separator(page, 'kilder')).toHaveCount(0);
    await expect(separator(page, 'tråder og filter')).toHaveCount(1);

    await page.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);
  });

  test('på 1440 finnes ingen breddekontroller i det hele tatt', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    // 400 + 32 + 640 + 32 + 336 er vinduet nøyaktig: gulv, tak og bredden på
    // skjermen er ett og samme tall for begge sidekolonnene, og ingen av de
    // seks kontrollene kan gjøre noe uansett hva leseren trykker på.
    //
    // Brukerblikk 3, funn 2: fire varig avslåtte knapper på den bredden alle
    // Figma-rammene er tegnet i. Avslått er noe som går over — dette gjør det
    // ikke, og da er det ingen kontroll, bare noe som ser ødelagt ut. Lars
    // 17.09, beslutning 9 alternativ (c).
    for (const panel of ['tråder og filter', 'kilder'] as const) {
      await expect(separator(page, panel)).toHaveCount(0);
    }

    // Og ingen av dem dukker opp i en Tab-vandring, som er den andre måten å
    // møte dem på.
    const steps = await walkWithTab(page);
    expect(
      steps.filter((step) => /^(Endre bredde på|Gjør )/.test(step.name)),
      'breddekontrollene skal ikke finnes når de ikke kan gjøre noe',
    ).toEqual([]);

    // Panelkanten står der fortsatt. Det er gripeflata som er borte, ikke
    // grensa mellom panelet og svarkolonnen: den tegnes av panelets egen
    // ramme.
    const border = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.primary-sidebar .panel')!).borderInlineEndWidth,
    );
    expect(border, 'panelets egen ramme tegner kanten').not.toBe('0px');
  });

  test('på 1680 er begge skillene tilbake', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    // 1680: 400 + 32 + 640 + 32 + 432 = 1536, så det er 144 px å fordele og
    // begge kantene kan flyttes. Skillene kommer tilbake av seg selv når
    // vinduet vokser — det er den samme `fixed` som tok dem bort.
    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    for (const panel of ['tråder og filter', 'kilder'] as const) {
      await expect(separator(page, panel)).toHaveCount(1);
      await expect(separator(page, panel)).toHaveAttribute('tabindex', '0');
    }

    // And they work: an edge that is drawn has to be able to do something,
    // with a click too.
    await separator(page, 'tråder og filter').click();
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_WIDEST_1680_BESIDE_SOURCES,
      'etter ett klikk ved 1680',
    );
  });

  test('skillene forsvinner og kommer tilbake med vinduet', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await page.goto('/');
    await showSources(page);
    await expect(separator(page, 'kilder')).toHaveCount(1);

    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await expect(separator(page, 'kilder')).toHaveCount(0);

    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await expect(separator(page, 'kilder')).toHaveCount(1);
  });

  test('piltastene gjør det samme som musa, 16 px og 64 med Shift', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tastatur er likeverdig');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await expect(handle).toBeFocused();

    await page.keyboard.press('ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STEP);

    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STEP + STRIDE);

    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('Home og End går til det smaleste og det bredeste panelet kan være', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: tastatur er likeverdig');
    await page.goto('/');
    await showSources(page);

    const handle = separator(page, 'kilder');
    await handle.focus();

    await page.keyboard.press('Home');
    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_FLOOR);

    await page.keyboard.press('End');
    // 1536 − 400 (the navigation panel) − 64 (two gaps) − 640 (the answer
    // column's floor) = 432. The window is the only ceiling there is since
    // Simens issue 80, round 2.
    await expectPanelWidth(page, '.secondary-sidebar', SOURCES_DEFAULT, 'kildepanelet på End');
    await expect(handle).toHaveAttribute('aria-valuenow', String(SOURCES_DEFAULT));
  });

  /*
   * The double-click that reset the width went with #202: two clicks are
   * there and back now, so a double-click from the default ends at the
   * default. Enter is the reset, as before.
   */
  test('Enter setter bredden tilbake til standard', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tilbakestilling');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    await page.keyboard.press('Enter');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);

    await drag(page, handle, 50);
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + 50);

    await handle.focus();
    await page.keyboard.press('Enter');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('bredden overlever at sida lastes på nytt, og tilbakestilling glemmer den', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: huskes i ka.layout.v1');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    await page.reload();
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    // Tilbakestilling fjerner den lagrede bredden, den skriver ikke standarden
    // ned en gang til.
    await separator(page, 'tråder og filter').focus();
    await page.keyboard.press('Enter');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ka.layout.v1') ?? '{}'),
    );
    expect(stored.widths).toEqual({});

    await page.reload();
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('taket er vinduets, ikke bare modellens', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: grensene holder');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('End');

    // The sources panel is a rail, so the widest is what the window leaves
    // beside it and the answer column's floor.
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_WIDEST_1920,
      'navigasjonspanelet ved 1920',
    );

    // Opening the sources panel takes room the stored width counted on. The
    // sources panel keeps its width, the navigation panel is drawn narrower
    // than it is stored, and aria-valuenow says the drawn width: it is the
    // only thing that tells a reader who cannot see the edge where it is, and
    // the stored 1181 over a panel drawn at 784 would be a lie told to exactly
    // that reader.
    await showSources(page);
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_AT_1920_BESIDE_SOURCES,
      'navigasjonspanelet ved 1920 med kildene åpne',
    );
    await expect(handle).toHaveAttribute('aria-valuenow', String(NAV_AT_1920_BESIDE_SOURCES));

    // At 1440 with both sidebars open everything stands on its floor, and there
    // is nothing to drag: the edge is gone, and the stored width is neither
    // drawn nor reported.
    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'navigasjonspanelet ved 1440');
    await expectPanelWidth(page, '.secondary-sidebar', SOURCES_FLOOR, 'kildepanelet ved 1440');
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);

    // At 1480 the navigation panel stands at 400, which is its floor and,
    // beside the sources panel, all the room there is, so it has no edge to
    // move.
    await page.setViewportSize({ width: 1480, height: HEIGHT });
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'navigasjonspanelet ved 1480');
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);

    // And as the window grows, the edge comes back and the drawn width follows
    // the window, with the stored one never gone. Measured by KA CC on #93 by
    // setting aria-valuenow to the stored width: red wherever the two differ.
    for (const [width, drawn] of [
      [1600, NAV_AT_1600],
      [1680, NAV_AT_1680],
    ] as const) {
      await page.setViewportSize({ width, height: HEIGHT });
      await expectPanelWidth(page, '.primary-sidebar', drawn, `navigasjonspanelet ved ${width}`);
      await expect(separator(page, 'tråder og filter')).toHaveAttribute(
        'aria-valuenow',
        String(drawn),
      );
    }
  });

  test('en kollapset sidekolonne har ingen skille å dra i', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ett skille per åpen sidekolonne');
    await page.goto('/');

    // Kildepanelet er kollapset som standard: en rail er én knapp bred og har
    // ingen bredde å endre, så et tab-stopp der er et tab-stopp i veien.
    await expect(separator(page, 'kilder')).toHaveCount(0);
    await expect(separator(page, 'tråder og filter')).toHaveCount(1);

    await page.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);
  });

  for (const width of WIDTHS) {
    test(`ingen vannrett rulling ved ${width} uansett hva brukeren har dratt`, async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'panelbredde: ingen vannrett rulling');
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');

      // Begge ytterpunkter, og med kildepanelet både åpent og kollapset: det
      // er kombinasjonen av en dratt kolonne og en kolonne som åpner seg som
      // er den trange.
      //
      // Hvilke skiller som finnes, avhenger av tilstanden — under 1440 er
      // bare én sidekolonne åpen om gangen, så navigasjonspanelets skille er
      // borte når kildepanelet åpnes. Derfor dras de som er der, ikke et
      // skille testen har bestemt seg for på forhånd.
      for (const sources of ['collapsed', 'open'] as const) {
        if (sources === 'open') await showSources(page);

        // Rekkefølgen er ikke fri: `Home` sist legger hvert panel tilbake på
        // gulvet sitt, og det er den tilstanden antallet skiller under her er
        // skrevet for. Snus den til ['Home', 'End'], går navigasjonspanelet
        // inn i `sources === 'open'` stående på 480, og da finnes det to
        // skiller ved 1536 i stedet for ett. Det ryker høylytt på tallet, ikke
        // stille — men det er en avhengighet og ikke en smakssak. KA CC på #93.
        for (const key of ['End', 'Home'] as const) {
          const handles = page.getByRole('separator');
          const count = await handles.count();
          // Skrevet ut per tilstand og ikke `> 0`, for antallet er ikke det
          // samme overalt lenger og et løkketrinn som drar ingenting skal
          // ikke kunne bli stille: ved 1440 med begge sidekolonner åpne står
          // alt på gulvet sitt og det finnes ingen kant å flytte, mens ved
          // 1536 er det bare kildepanelets kant som kan gi noe.
          expect(count, `skiller ved ${width}, ${sources}`).toBe(
            width === 1440 && sources === 'open' ? 0 : 1,
          );

          for (let index = 0; index < count; index += 1) {
            await handles.nth(index).focus();
            await page.keyboard.press(key);
          }

          await expect
            .poll(
              () =>
                page.evaluate(() => ({
                  document: document.documentElement.scrollWidth,
                  window: window.innerWidth,
                  client: document.documentElement.clientWidth,
                })),
              { message: `plassen ved ${width}, ${sources}, ${key}` },
            )
            .toEqual({ document: width, window: width, client: width });
        }
      }
    });
  }

  test('skillet ligger inne i landemerket det endrer bredden på', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tilgjengelig i begge moduser');
    await page.setViewportSize({ width: 1920, height: HEIGHT });

    // Regresjonen #50 slapp gjennom: skillet lå som et søsken av landemerkene
    // i stedet for inni ett, og `region` er en best-practice-regel som
    // `expectNoAxeViolations` ikke kjører. Målt av KA CC på fire ruter.
    for (const path of ['/', '/threads/nkom-maaloppnaaelse', '/tull']) {
      await page.goto(path);
      await expectAllContentInLandmarks(page, path);
    }

    // Og med begge panelene åpne, som er den eneste tilstanden der begge
    // skillene finnes samtidig.
    await page.goto('/threads/nkom-maaloppnaaelse');
    await showSources(page);
    await expectAllContentInLandmarks(page, 'begge sidekolonner åpne');

    const inside = await page.evaluate(() =>
      [...document.querySelectorAll('.panel-separator')].map((separator) =>
        separator.closest('nav, aside, main')?.tagName.toLowerCase(),
      ),
    );
    expect(inside, 'hvert skille ligger i landemerket det hører til').toEqual(['nav', 'aside']);
  });

  test('skillet har navn, fokusring og null axe-brudd i lys og mørk', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: tilgjengelig i begge moduser');
    // 1920 og ikke 1536: på 1536 med begge panelene åpne står navigasjons-
    // panelet på gulvet og taket sitt samtidig, og da er skillet ikke tegnet
    // i det hele tatt — det er ingen fokusring å måle. Valget er det samme
    // som før #93, begrunnelsen er ny.
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    for (const scheme of ['light', 'dark'] as const) {
      await setColorScheme(page, scheme);

      const handle = separator(page, 'tråder og filter');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await tabTo(page, handle);

      // Fokusringen er Designsystemets, gjennom `ds-focus`. Uten den er
      // skillet et tastaturstopp ingen ser hvor er (WCAG 2.4.7).
      const ring = await handle.evaluate((element) => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
      expect(ring.outline, `fokusring i ${scheme}`).not.toBe('none');
      expect(ring.shadow, `fokusring i ${scheme}`).not.toBe('none');

      // Gripeflata, pekeren og fingeren. `touch-action: none` er det ene som
      // kan ryke uten at noe annet merker det: uten den tar nettleseren
      // bevegelsen som en rulling, og kanten står stille på berøring mens
      // musa fortsatt virker.
      const grip = await handle.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: Math.round(element.getBoundingClientRect().width),
          cursor: style.cursor,
          touchAction: style.touchAction,
        };
      });
      expect(grip, `gripeflata i ${scheme}`).toEqual({
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
      });

      await expectNoAxeViolations(page, `skillene i ${scheme === 'light' ? 'lys' : 'mørk'} modus`);
    }

    await setColorScheme(page, 'light');
    await saveScreenshot(page, 'panelbredde-skille-lys');
  });
});
