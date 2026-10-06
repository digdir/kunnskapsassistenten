import { expect, test, type Locator, type Page } from '@playwright/test';
import { covers } from './a11y';
import { ANSWER_TIMEOUT, composer } from './helpers';

/**
 * Ingenting ruller sidelengs, på noen bredde fra 320 (WCAG 1.4.10 Reflow).
 *
 * Målt 06.10 på telefon: hovedkolonnen rullet sidelengs, 37 px på 375 og 19
 * på 393, med et rullefelt nederst på skjermen. Årsaken var lange ord som
 * ikke ble brutt, i et forslag og i en trådtittel, og chips som ikke kunne
 * brytes. Denne fila passer på at det ikke kommer tilbake, uansett hva som
 * stikker ut neste gang.
 *
 * Én test per bruddpunkt, som går gjennom tilstandene i samme side. Feiler
 * noe, sier meldingen hvilken tilstand, hvilket element og hvor langt.
 *
 * Påstandene regnes ut i siden:
 * - `<html>` har ikke overflyt, og `window.scrollTo` flytter ingenting.
 * - `main` ruller ikke sidelengs.
 * - Ingen synlige elementer går utenfor vinduet sidelengs. Bare det som ikke
 *   ligger inne i en boks med `overflow-x` som klipper eller ruller, sjekkes
 *   her: alt inne i `main` og panelene ligger i en slik boks, og dekkes av de
 *   to neste. Lukkede skuffer, `inert` og `hidden` regnes ikke.
 * - Ingen tekst kuttes av en boks med `overflow: hidden` eller `clip`.
 *   Svarkortet er en slik boks (`.ds-card`), så et ord som ikke brytes i et
 *   svar, får ikke `main` til å rulle. Det blir borte i stedet, og det er det
 *   denne fanger. Tekst med `text-overflow: ellipsis` er kuttet med vilje og
 *   regnes ikke, og heller ikke hopp-lenkene før de får fokus.
 * - Bare de avtalte boksene ruller (`SCROLLERS`).
 */

type Size = { name: string; width: number; height: number; dpr?: 2 | 3 };

/** Telefonene har `dpr`, og kjører med `isMobile` og `hasTouch`. */
const SIZES: Size[] = [
  { name: '320×568', width: 320, height: 568, dpr: 2 },
  { name: '360×740', width: 360, height: 740, dpr: 3 },
  { name: '375×667', width: 375, height: 667, dpr: 2 },
  { name: '393×852', width: 393, height: 852, dpr: 3 },
  { name: '430×932', width: 430, height: 932, dpr: 3 },
  { name: 'liggende 667×375', width: 667, height: 375, dpr: 2 },
  { name: 'liggende 852×393', width: 852, height: 393, dpr: 3 },
  { name: '768×1024', width: 768, height: 1024 },
  { name: '1024×768', width: 1024, height: 768 },
  { name: '1280×800', width: 1280, height: 800 },
  { name: '1440×900', width: 1440, height: 900 },
  { name: '1920×1080', width: 1920, height: 1080 },
];

/**
 * The boxes that are meant to scroll, and in which direction. Anything else
 * that scrolls is a finding.
 */
const SCROLLERS: { selector: string; x: boolean; y: boolean }[] = [
  { selector: 'main', x: false, y: true },
  { selector: '.sidebar-content', x: false, y: true },
  { selector: '.markdown__table', x: true, y: false },
  { selector: '.markdown__pre', x: true, y: false },
  { selector: '.ka-agent-picker', x: false, y: true },
  { selector: 'textarea', x: false, y: true },
];

/**
 * Panel widths stored by a desktop session, wider than a phone. The overflow
 * was first seen in a browser with stored widths, and a phone has to draw
 * from them too.
 */
const STORED_WIDE_LAYOUT = JSON.stringify({
  collapsed: { 'primary-sidebar': false, 'secondary-sidebar': false },
  widths: { 'primary-sidebar': 560, 'secondary-sidebar': 640 },
  sourcesDismissed: false,
});

/** A file name with no space in it, longer than a phone is wide. */
const LONG_FILE_NAME =
  'Arsrapport_2024_Kommunikasjonsmyndigheten_endelig_versjon_med_vedlegg_og_merknader_fra_styret_2025-03-14_v7_godkjent.pdf';

type Fit = {
  html: { x: number; y: number };
  moved: { x: number; y: number };
  main: number;
  outside: string[];
  cut: string[];
  scrolling: string[];
};

async function measure(page: Page): Promise<Fit> {
  return page.evaluate((allowed) => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const main = document.querySelector('main');
    if (!main) throw new Error('fant ikke main');

    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '');

    const shown = (el: Element) => {
      if (el.closest('[inert], [hidden], dialog:not([open]), .ds-sr-only')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };

    /*
     * Inside a box that clips or scrolls (`overflow-x` other than `visible`).
     * Such content can stick out of the window without the window showing
     * it, so the window check below skips it, and the box decides instead:
     * a box that scrolls must be one of `SCROLLERS`, and a box that clips must
     * not cut any text off (`cut`). `main` and the panels are boxes like
     * that, so this check sees only what is drawn outside them.
     */
    const clipped = (el: Element) => {
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        if (getComputedStyle(up).overflowX !== 'visible') return true;
      }
      return false;
    };

    const outside: string[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!shown(el) || clipped(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.right > width + 0.5) {
        outside.push(`${describe(el)} går ${Math.round(box.right - width)} px ut til høyre`);
      } else if (box.left < -0.5) {
        outside.push(`${describe(el)} går ${Math.round(-box.left)} px ut til venstre`);
      }
    }
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || !shown(parent) || clipped(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const right = Math.max(...[...range.getClientRects()].map((box) => box.right));
      if (right > width + 0.5) {
        outside.push(
          `teksten «${node.textContent.trim().slice(0, 40)}» i ${describe(parent)} går ${Math.round(right - width)} px ut`,
        );
      }
    }

    /*
     * Text cut off by a box that clips. The answer card (`.ds-card`) clips,
     * so a word too long for the line is hidden there, and `main` does not
     * scroll — measured on 06.10 at 393: the 175-character link ran 207 px
     * past the card with nothing else to show for it. Each text node is held
     * against its nearest clipping box. A box that scrolls stops the search:
     * what is in it can be scrolled to. So does the top layer and
     * `position: fixed`, which no box around them clips: a tooltip is drawn
     * in the top layer from inside a 67 px rail. Cut on purpose, and not
     * counted: `text-overflow: ellipsis`, and a box 1 px wide or tall, which
     * is text kept for a screen reader — a skip link before it has focus, and
     * what the tooltip leaves for one to read.
     */
    const cut: string[] = [];
    const cutting = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = cutting.nextNode(); node; node = cutting.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || !shown(parent)) continue;
      if (getComputedStyle(parent).textOverflow === 'ellipsis') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const right = Math.max(...[...range.getClientRects()].map((box) => box.right));
      for (let up: Element | null = parent; up && up !== document.body; up = up.parentElement) {
        const style = getComputedStyle(up);
        const overflow = style.overflowX;
        if (overflow === 'auto' || overflow === 'scroll') break;
        if (overflow === 'hidden' || overflow === 'clip') {
          const box = up.getBoundingClientRect();
          const edge = box.right;
          const forScreenReader = box.width <= 1 || box.height <= 1;
          if (!forScreenReader && right > edge + 0.5) {
            cut.push(
              `teksten «${node.textContent.trim().slice(0, 40)}» kuttes ${Math.round(right - edge)} px av ${describe(up)}`,
            );
          }
          break;
        }
        if (up.matches(':popover-open, dialog[open]') || style.position === 'fixed') break;
      }
    }

    const scrolling: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const style = getComputedStyle(el);
      const x = el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(style.overflowX);
      const y = el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(style.overflowY);
      if (!x && !y) continue;
      const rule = allowed.find((candidate) => el.matches(candidate.selector));
      if (x && !rule?.x) {
        scrolling.push(`${describe(el)} ruller ${el.scrollWidth - el.clientWidth} px sidelengs`);
      }
      if (y && !rule?.y) scrolling.push(`${describe(el)} ruller på langs`);
    }

    const start = { x: window.scrollX, y: window.scrollY };
    window.scrollTo(400, 400);
    const moved = { x: window.scrollX - start.x, y: window.scrollY - start.y };
    window.scrollTo(start.x, start.y);

    return {
      html: { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight },
      moved,
      main: main.scrollWidth - main.clientWidth,
      outside: outside.slice(0, 10),
      cut: cut.slice(0, 10),
      scrolling,
    };
  }, SCROLLERS);
}

function expectFits(fit: Fit, where: string): void {
  expect.soft(fit.html, `${where}: <html> har overflyt`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.moved, `${where}: window.scrollTo flyttet siden`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.main, `${where}: main ruller sidelengs`).toBe(0);
  expect.soft(fit.outside, `${where}: utenfor vinduet sidelengs`).toEqual([]);
  expect.soft(fit.cut, `${where}: tekst kuttes av en boks`).toEqual([]);
  expect.soft(fit.scrolling, `${where}: ruller uten å skulle`).toEqual([]);
}

/**
 * Until no finite animation is running, so a measurement never catches a
 * panel halfway open. Endless ones, such as a spinner, are left out: they
 * would never end.
 */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.playState === 'running' &&
                  animation.effect?.getComputedTiming().endTime !== Infinity,
              ).length,
        ),
      { message: 'animasjonene ble ikke ferdige' },
    )
    .toBe(0);
}

/**
 * Opens a sidebar by its rail or toggle, when it is not open already, and
 * waits until it says it is open. Open already, as the navigation panel is
 * on a desktop, it is measured as it is.
 */
async function openSidebar(page: Page, name: string): Promise<void> {
  const show = page.getByRole('button', { name, exact: true });
  if (!(await show.count())) return;
  const controls = await show.getAttribute('aria-controls');
  await show.click();
  if (controls) {
    await expect(
      page.locator(`[aria-controls="${controls}"][aria-expanded="true"]`).first(),
    ).toBeAttached();
  }
  await settled(page);
}

/** Closes the drawer or menu that is open, and waits until it is gone. */
async function closeOverlay(page: Page, overlay: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await settled(page);
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      ...(size.dpr ? { isMobile: true, hasTouch: true, deviceScaleFactor: size.dpr } : {}),
    });

    test(`ingenting ruller sidelengs på ${size.name}`, async ({ page }, testInfo) => {
      covers(testInfo, 'skallet: ingenting ruller sidelengs fra 320 (WCAG 1.4.10)');
      test.setTimeout(ANSWER_TIMEOUT * 2 + 30_000);

      await page.goto('/');
      await expect(page.locator('main')).toBeVisible();
      expectFits(await measure(page), 'startsiden');

      await page.getByRole('button', { name: /^Agent:/ }).click();
      await expect(page.locator('.ka-agent-picker')).toBeVisible();
      expectFits(await measure(page), 'agentmenyen åpen');
      await closeOverlay(page, page.locator('.ka-agent-picker'));

      await composer(page).click();
      await page.keyboard.type('simuler lang lenke');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
        timeout: ANSWER_TIMEOUT,
      });
      expectFits(await measure(page), 'svar med en lang lenke');

      await page.goto('/threads/nkom-maaloppnaaelse');
      await expect(page.locator('main .markdown').first()).toBeVisible();
      expectFits(await measure(page), 'tråd med svar og kilder');

      await openSidebar(page, 'Vis tråder og filter');
      expectFits(await measure(page), 'navigasjonspanelet åpent');
      if (await page.locator('dialog[open]').count()) {
        await closeOverlay(page, page.locator('dialog[open]'));
      }

      await openSidebar(page, 'Vis kilder');
      expectFits(await measure(page), 'kildepanelet åpent');
      if (await page.locator('dialog[open]').count()) {
        await closeOverlay(page, page.locator('dialog[open]'));
      }

      await page.locator('.ka-composer__file-input').setInputFiles({
        name: LONG_FILE_NAME,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });
      await expect(page.locator('.ka-attachments')).toBeVisible();
      expectFits(await measure(page), 'vedlegg med et langt filnavn');

      await page.evaluate(
        (stored) => localStorage.setItem('ka.layout.v1', stored),
        STORED_WIDE_LAYOUT,
      );
      await page.reload();
      await expect(page.locator('main .markdown').first()).toBeVisible();
      expectFits(await measure(page), 'brede panelbredder lagret fra en annen økt');
    });
  });
}

/**
 * Fra desktop til telefon i samme økt, og telefonen snudd.
 *
 * Etter et slikt bytte sto det et mørkt felt under panelene. Skallet var like
 * høyt som før, og resten av skjermen var tom. Siden var zoomet ut: raden ble
 * regnet fra `innerWidth`, som på en telefon er det synlige vinduet, og en rad
 * som var for bred, fikk vinduet til å melde seg bredere, så raden holdt seg for
 * bred. Målt 06.10: 774 × 1678 CSS-px og zoom 0,51, med et skall på 852 px øverst.
 *
 * `isMobile` er det som gjør at Chromium zoomer ut, så testen må ha det fra
 * start og bytte størrelse i samme side, slik DevTools gjør.
 */
test.describe('bytte av størrelse i samme økt', () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test('skallet dekker vinduet etter bytte fra desktop til telefon og snudd telefon', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'skallet: ingenting ruller sidelengs fra 320 (WCAG 1.4.10)');

    await page.goto('/threads/nkom-maaloppnaaelse');
    await expect(page.locator('main .markdown').first()).toBeVisible();

    for (const [width, height, where] of [
      [393, 852, 'byttet fra 1440×900 til 393×852'],
      [852, 393, 'snudd til 852×393'],
      [393, 852, 'snudd tilbake til 393×852'],
    ] as const) {
      await page.setViewportSize({ width, height });
      // Two frames for the new size to reach layout, then until nothing moves.
      await page.evaluate(
        () =>
          new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          ),
      );
      await settled(page);

      const screen = await page.evaluate(() => {
        const shell = document.querySelector('.shell')!.getBoundingClientRect();
        return {
          scale: Math.round((window.visualViewport?.scale ?? 1) * 100) / 100,
          visual: { width: window.innerWidth, height: window.innerHeight },
          layout: {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
          },
          shell: { top: Math.round(shell.top), height: Math.round(shell.height) },
        };
      });

      expect.soft(screen.scale, `${where}: siden er zoomet`).toBe(1);
      expect
        .soft(screen.visual, `${where}: det synlige vinduet er større enn siden`)
        .toEqual(screen.layout);
      expect
        .soft(screen.shell, `${where}: skallet dekker ikke vinduet`)
        .toEqual({ top: 0, height: height });
      expectFits(await measure(page), where);
    }
  });
});
