import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';

/**
 * Every control on the panel's head row can be reached where it stands.
 *
 * The row holds three things after #119: the collapse button, the place a
 * view fills («Tråder»), and the two width buttons. `.panel` clips with
 * `overflow: hidden`, so a row that outgrows the panel does not scroll — it
 * puts its last children outside the visible area, and a pointer cannot get
 * to them at all. Measured on #119 before the icon button landed: the row
 * wanted 471 px in a 399 px panel, and both width buttons were unreachable on
 * 1280, 1440 and 1920.
 *
 * **Why the suite did not catch that, and why this test is written the way it
 * is.** `resize.spec.ts` clicks the width buttons, and Playwright's `click()`
 * scrolls the element into view first — the same thing keyboard focus does,
 * which is how the two controls were reachable by Tab and not by mouse. A
 * test that clicks therefore proves nothing about where a control sits. This
 * one reads geometry instead: `document.elementFromPoint` at each control's
 * own centre, with nothing scrolled.
 *
 * The second half is the scroll itself. A clipped row still scrolls
 * programmatically, so focusing a control that has fallen off the end slides
 * the whole panel sideways — measured at 72 px, with «Skjul» moving from 245
 * to 173. Nothing draws a scrollbar there and no wheel reaches it, so the
 * panel simply looks displaced. Tabbing through the head must leave
 * `scrollLeft` at 0.
 */

const WIDTHS = [1280, 1440, 1920];

type Reach = { navn: string; naabar: boolean; hoyre: number };

/**
 * Every control in the navigation panel's head row, with whether the point at
 * its own centre actually belongs to it.
 *
 * Read in one `evaluate` rather than through locators: what is asked is a
 * question about layout, and a locator would answer it about the DOM.
 */
async function headControls(page: Page): Promise<Reach[]> {
  return page.evaluate(() => {
    const head = document.querySelector('.primary-sidebar .sidebar-header');
    if (head === null) throw new Error('fant ikke panelraden');

    return [...head.querySelectorAll('button')].map((control) => {
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        navn: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '',
        naabar: hit === control || control.contains(hit),
        hoyre: Math.round(box.right),
      };
    });
  });
}

/**
 * A fresh panel at a given width.
 *
 * `localStorage` is cleared and the page reloaded, because the panel width is
 * remembered (`ka.layout.v1`) and a width left over from another test would
 * measure a panel nobody asked for. Measured the hard way: a run where two
 * earlier clicks on «bredere» had widened the panel showed the row fitting,
 * on a build where it did not.
 */
async function freshPanel(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      // Private mode. The default width is then what we get anyway.
    }
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toBeVisible();
}

test.describe('panelraden', () => {
  for (const width of WIDTHS) {
    test(`hver kontroll er nåbar med peker på ${width}`, async ({ page }, testInfo) => {
      covers(testInfo, 'panelraden: kontrollene er nåbare der de står (#119)');
      await freshPanel(page, width);

      const controls = await headControls(page);

      // Two: «Skjul tråder og filter» and «Tråder». The narrower and wider
      // arrows went with Simens issue 81 (#202). Without this the assertion
      // below would still stand, true of an empty list.
      expect(controls.map((control) => control.navn)).toHaveLength(2);

      const unreachable = controls.filter((control) => !control.naabar);
      expect(
        unreachable.map((control) => control.navn),
        `utenfor den synlige flata på ${width}: ${unreachable
          .map((control) => `${control.navn} (høyre kant ${control.hoyre})`)
          .join(', ')}`,
      ).toEqual([]);

      // Og raden renner ikke over i det hele tatt. Den ene følger av den
      // andre i dag, men de svarer på hver sin ting: den over på om en peker
      // når kontrollen, denne på om noe er utenfor boksen.
      const overflow = await page.evaluate(() => {
        const head = document.querySelector('.primary-sidebar .sidebar-header')!;
        return head.scrollWidth - head.clientWidth;
      });
      expect(overflow, `overflødig bredde i panelraden på ${width}`).toBe(0);
    });
  }

  test('å tabbe gjennom hodet flytter ikke panelet sideveis', async ({ page }, testInfo) => {
    covers(testInfo, 'panelraden: kontrollene er nåbare der de står (#119)');
    await freshPanel(page, 1440);

    // Gjennom hopp-lenkene og hele hoderaden. Et tall og ikke en løkke til
    // noe bestemt: det som måles er at ingen av stegene flytter panelet.
    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab');
    }

    const scrolled = await page.evaluate(() => {
      const panel = document.querySelector('.primary-sidebar .panel')!;
      return {
        left: Math.round(panel.scrollLeft),
        focus: document.activeElement?.getAttribute('aria-label') ?? '',
      };
    });

    expect(
      scrolled.left,
      `panelet er rullet ${scrolled.left} px sideveis, med fokus på «${scrolled.focus}»`,
    ).toBe(0);
  });
});
