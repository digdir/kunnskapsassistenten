import { expect, test, type Locator, type Page } from '@playwright/test';
import { covers } from './a11y';
import { ANSWER_TIMEOUT, composer } from './helpers';

/**
 * Nothing scrolls sideways, at any width from 320 (WCAG 1.4.10 Reflow).
 *
 * Measured 06.10 on a phone: the answer column scrolled sideways, 37 px at
 * 375 and 19 at 393, with a scrollbar at the bottom of the screen. The cause
 * was long words that were not broken, in a suggestion and in a thread title,
 * and chips that could not wrap. This file makes sure it does not come back,
 * whatever sticks out next time.
 *
 * One test per breakpoint, which walks through the states in the same page.
 * When something fails, the message says which state, which element and how
 * far.
 *
 * The assertions are computed in the page:
 * - `<html>` has no overflow, and `window.scrollTo` moves nothing.
 * - `main` does not scroll sideways.
 * - No visible element goes outside the window sideways. Only what is not
 *   inside a box whose `overflow-x` clips or scrolls is checked here:
 *   everything inside `main` and the panels is in such a box, and is covered
 *   by the next two. Closed drawers, `inert` and `hidden` do not count.
 * - No text is cut off by a box with `overflow: hidden` or `clip`. The answer
 *   card (`.ds-card`) is such a box, so a word that does not break in an
 *   answer does not make `main` scroll. It disappears instead, and that is
 *   what this one catches. Text with `text-overflow: ellipsis` is cut on
 *   purpose and does not count, nor do the skip links before they get focus.
 * - Only the agreed boxes scroll (`SCROLLERS`).
 *
 * Below 774 the panel buttons stand in a row at the top
 * (digdir/kunnskapsassistenten#120), and `expectTopRow` measures it.
 */

type Size = { name: string; width: number; height: number; dpr?: 2 | 3 };

/** The phones have `dpr`, and run with `isMobile` and `hasTouch`. */
const SIZES: Size[] = [
  { name: '320×568', width: 320, height: 568, dpr: 2 },
  { name: '360×740', width: 360, height: 740, dpr: 3 },
  { name: '375×667', width: 375, height: 667, dpr: 2 },
  { name: '393×852', width: 393, height: 852, dpr: 3 },
  { name: '430×932', width: 430, height: 932, dpr: 3 },
  { name: 'landscape 667×375', width: 667, height: 375, dpr: 2 },
  { name: 'landscape 852×393', width: 852, height: 393, dpr: 3 },
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
    if (!main) throw new Error('main not found');

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
        outside.push(
          `${describe(el)} sticks out ${Math.round(box.right - width)} px past the end edge`,
        );
      } else if (box.left < -0.5) {
        outside.push(`${describe(el)} sticks out ${Math.round(-box.left)} px past the start edge`);
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
          `the text «${node.textContent.trim().slice(0, 40)}» in ${describe(parent)} sticks out ${Math.round(right - width)} px`,
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
              `the text «${node.textContent.trim().slice(0, 40)}» is cut ${Math.round(right - edge)} px by ${describe(up)}`,
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
        scrolling.push(`${describe(el)} scrolls ${el.scrollWidth - el.clientWidth} px sideways`);
      }
      if (y && !rule?.y) scrolling.push(`${describe(el)} scrolls vertically`);
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
  expect.soft(fit.html, `${where}: <html> overflows`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.moved, `${where}: window.scrollTo moved the page`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.main, `${where}: main scrolls sideways`).toBe(0);
  expect.soft(fit.outside, `${where}: outside the window sideways`).toEqual([]);
  expect.soft(fit.cut, `${where}: text cut off by a box`).toEqual([]);
  expect.soft(fit.scrolling, `${where}: scrolls when it should not`).toEqual([]);
}

/**
 * Up to this long, a finite animation is run to its end at once.
 * Designsystemet's finite ones are 0.15–0.4 s. Its 0.8–6 s ones are the
 * skeleton and the spinner, which are endless and left out anyway.
 */
const FINISH_AT_ONCE_MS = 2_000;

/**
 * Until no finite animation is running, so a measurement never catches a
 * panel halfway open. Endless ones, such as a spinner, are left out: they
 * would never end.
 *
 * A short one, up to `FINISH_AT_ONCE_MS`, is run to its end at once with
 * `finish()` rather than waited for. What is measured is the layout it ends
 * in, and a machine under load can take seconds to play one that lasts
 * 300 ms: one run on a busy machine failed here with «the animations did
 * not finish» after a drawer opened, and the next run passed 26 of 26.
 * Throttling the CPU 20 times did not bring it back, since the compositor
 * plays CSS animations by the clock.
 *
 * A longer one is waited for, not finished. A transition that got a far too
 * long duration by mistake is something the reader sees, and finishing it
 * would hide that. If it has not ended in time, the message names it with its
 * length. The poll goes on while anything new starts, so one that starts over
 * and over is named too. With the short ones finished at once, load no longer
 * decides how long this takes, and five seconds is Playwright's own default
 * for an expect: three calls in one test fit in its 30 s.
 *
 * Not `reducedMotion: 'reduce'`: Designsystemet turns `.ds-dialog[open]` off
 * then, but the drawers' own `[data-placement]` animation outranks that rule
 * and plays anyway (measured 07.10 at 393).
 */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          (finishAtOnce) =>
            document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.playState === 'running' &&
                  animation.effect?.getComputedTiming().endTime !== Infinity,
              )
              .map((animation) => {
                const name =
                  animation instanceof CSSAnimation
                    ? animation.animationName
                    : animation instanceof CSSTransition
                      ? animation.transitionProperty
                      : 'animation';
                const target =
                  animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
                const where = `${name} on ${target?.tagName.toLowerCase() ?? 'unknown'}`;
                const length = Number(animation.effect?.getComputedTiming().endTime ?? 0);
                if (length > finishAtOnce) return `${where} lasts ${Math.round(length)} ms`;
                try {
                  animation.finish();
                } catch {
                  // An animation that cannot be finished is reported as still running.
                }
                return where;
              }),
          FINISH_AT_ONCE_MS,
        ),
      { message: 'the animations did not finish', timeout: 5_000 },
    )
    .toEqual([]);
}

/**
 * Opens a sidebar by its rail or toggle, when it is not open already, and
 * waits until it says it is open. Open already, as the navigation panel is
 * on a desktop, it is measured as it is.
 */
async function openSidebar(page: Page, name: string): Promise<void> {
  const show = page.getByRole('button', { name, exact: true });
  if (!(await show.count())) {
    // Open already. A name that is neither here nor open is a wrong name.
    await expect(
      page.getByRole('button', { name: name.replace(/^Vis /, 'Skjul '), exact: true }),
    ).toBeAttached();
    return;
  }
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

/** Below this the two buttons stand in a bar above the answer column (`compactMaxViewport`). */
const TOP_ROW_BELOW = 774;

/** The narrowest size from `width` up: where something that stops at `width` is seen to stop. */
function narrowestFrom(width: number): number {
  return Math.min(...SIZES.map((size) => size.width).filter((each) => each >= width));
}

type FlagState = {
  name: string;
  on: readonly string[];
  /**
   * The sizes where the flag changes the page. Elsewhere it is the page «no
   * flags» measures, and running it again costs a test each and finds nothing.
   * Left out, every size. The resize runs under every state, since it crosses
   * the limits.
   */
  sizes?: (size: Size) => boolean;
};

/**
 * The flag states the breakpoints and the resize run under. A flag that
 * changes the layout adds a line here, with `sizes` when it only acts at some.
 */
const FLAG_STATES: FlagState[] = [
  { name: 'no flags', on: [] },
  /*
   * Retired when the row at the top became standard. A browser that tried it
   * still has it stored, and has to get the same page as one that never did.
   */
  {
    name: 'retired mobile-top-row stored',
    on: ['mobile-top-row'],
    sizes: (size) => size.width <= narrowestFrom(TOP_ROW_BELOW),
  },
  // Every size: the filters move to the sources' side in the drawer too.
  { name: 'filters-right-panel', on: ['filters-right-panel'] },
];

/**
 * What the buttons that open the two panels are called with these flags on.
 * With `filters-right-panel` the filters move to the sources' side, and the
 * names follow the views (`slotLabel`).
 */
function panelButtons(on: readonly string[]): { primary: string; secondary: string } {
  return on.includes('filters-right-panel')
    ? { primary: 'Vis tråder', secondary: 'Vis filter og kilder' }
    : { primary: 'Vis tråder og filter', secondary: 'Vis kilder' };
}

/** Turns the flags on before the app reads storage, on every load. */
async function withFlags(page: Page, on: readonly string[]): Promise<void> {
  if (on.length === 0) return;
  await page.addInitScript(
    (ids) => {
      localStorage.setItem('ka.flags.v1', JSON.stringify(ids));
    },
    [...on],
  );
}

/** At and below this the text edge is its 16 px floor: `clamp(16px, 4vw, 32px)`. */
const TEXT_EDGE_FLOOR_UP_TO = 400;

/**
 * Below `TOP_ROW_BELOW`: the two buttons in a bar above the answer column, and
 * the column in the whole width. From it up: no bar.
 *
 * In the bar each button stands on the text edge, `--ka-main-padding-inline`,
 * measured from its own window edge: 16 px on a phone held upright. Measured
 * before the fix at 390: 16 at the start and 9 at the end, and from 667 the
 * end button ran past the window edge, where the panel clipped it.
 */
async function expectTopRow(page: Page, where: string): Promise<void> {
  const row = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const main = document.querySelector('main')!.getBoundingClientRect();
    const button = (slot: string) =>
      document
        .querySelector(`.shell > .${slot} > .panel > .sidebar-header button[aria-controls]`)
        ?.getBoundingClientRect();
    const primary = button('primary-sidebar');
    const secondary = button('secondary-sidebar');
    const buttons = [primary, secondary].filter((box) => box !== undefined);
    // The text edge as the page resolves it, from the same custom property.
    const probe = document.createElement('div');
    probe.style.paddingInlineStart = 'var(--ka-main-padding-inline)';
    document.body.append(probe);
    const textEdge = Number.parseFloat(getComputedStyle(probe).paddingInlineStart);
    probe.remove();
    const tenth = (value: number) => Math.round(value * 10) / 10;
    return {
      width,
      bar: document.querySelector('.shell')!.hasAttribute('data-compact'),
      main: { left: Math.round(main.left), width: Math.round(main.width) },
      buttonsAbove: buttons.length === 2 && buttons.every((box) => box.bottom <= main.top + 0.5),
      textEdge: tenth(textEdge),
      insets: {
        start: primary ? tenth(primary.left) : null,
        end: secondary ? tenth(width - secondary.right) : null,
      },
    };
  });
  const expected = row.width < TOP_ROW_BELOW;
  expect
    .soft(
      row.bar,
      `${where}: the row at the top ${expected ? 'is missing' : 'is there when it should not be'}`,
    )
    .toBe(expected);
  if (!expected) return;
  expect
    .soft(row.main, `${where}: the answer column does not have the whole width`)
    .toEqual({ left: 0, width: row.width });
  expect.soft(row.buttonsAbove, `${where}: the buttons are not above the answer column`).toBe(true);
  for (const side of ['start', 'end'] as const) {
    expect
      .soft(
        Math.abs((row.insets[side] ?? Infinity) - row.textEdge),
        `${where}: the ${side} button is ${row.insets[side]} px from its edge, not on the text edge at ${row.textEdge} px`,
      )
      .toBeLessThanOrEqual(0.5);
  }
  if (row.width <= TEXT_EDGE_FLOOR_UP_TO) {
    expect.soft(row.insets, `${where}: the buttons are not 16 px from the edges`).toEqual({
      start: 16,
      end: 16,
    });
  }
}

for (const flags of FLAG_STATES) {
  for (const size of SIZES.filter(flags.sizes ?? (() => true))) {
    test.describe(size.name, () => {
      test.use({
        viewport: { width: size.width, height: size.height },
        ...(size.dpr ? { isMobile: true, hasTouch: true, deviceScaleFactor: size.dpr } : {}),
      });

      test(`nothing scrolls sideways at ${size.name}, ${flags.name}`, async ({
        page,
      }, testInfo) => {
        covers(testInfo, 'skallet: ingenting ruller sidelengs fra 320 (WCAG 1.4.10)');
        test.setTimeout(ANSWER_TIMEOUT * 2 + 30_000);
        await withFlags(page, flags.on);

        await page.goto('/');
        await expect(page.locator('main')).toBeVisible();
        expectFits(await measure(page), 'front page');
        await expectTopRow(page, 'front page');

        await page.getByRole('button', { name: /^Agent:/ }).click();
        await expect(page.locator('.ka-agent-picker')).toBeVisible();
        expectFits(await measure(page), 'agent menu open');
        await closeOverlay(page, page.locator('.ka-agent-picker'));

        await composer(page).click();
        await page.keyboard.type('simuler lang lenke');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
          timeout: ANSWER_TIMEOUT,
        });
        expectFits(await measure(page), 'answer with a long link');

        await page.goto('/threads/nkom-maaloppnaaelse');
        await expect(page.locator('main .markdown').first()).toBeVisible();
        expectFits(await measure(page), 'thread with answer and sources');

        await expectTopRow(page, 'thread with answer and sources');

        await openSidebar(page, panelButtons(flags.on).primary);
        expectFits(await measure(page), 'navigation panel open');
        if (await page.locator('dialog[open]').count()) {
          await closeOverlay(page, page.locator('dialog[open]'));
        }

        await openSidebar(page, panelButtons(flags.on).secondary);
        expectFits(await measure(page), 'sources panel open');
        if (await page.locator('dialog[open]').count()) {
          await closeOverlay(page, page.locator('dialog[open]'));
        }

        // No attachment with a long name: mock has no upload until a backend does
        // (src/api/uploadFactory.ts), so the paperclip is not drawn. Put the step
        // back with it.

        await page.evaluate(
          (stored) => localStorage.setItem('ka.layout.v1', stored),
          STORED_WIDE_LAYOUT,
        );
        await page.reload();
        await expect(page.locator('main .markdown').first()).toBeVisible();
        expectFits(await measure(page), 'wide panel widths stored by another session');
        await expectTopRow(page, 'wide panel widths stored by another session');
      });
    });
  }

  /**
   * From desktop to phone in the same session, and the phone turned.
   *
   * After such a switch there was a dark field under the panels. The shell was
   * as tall as before, and the rest of the screen was empty. The page was
   * zoomed out: the row was computed from `innerWidth`, which on a phone is the
   * visible window, and a row that was too wide made the window report itself
   * wider, so the row stayed too wide. Measured 06.10: 774 × 1678 CSS px and
   * zoom 0.51, with a shell of 852 px at the top.
   *
   * `isMobile` is what makes Chromium zoom out, so the test must have it from
   * the start and change size in the same page, as DevTools does.
   */
  test.describe(`resizing in the same session, ${flags.name}`, () => {
    test.use({
      viewport: { width: 1440, height: 900 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });

    test('the shell covers the window after switching from desktop to phone and turning the phone', async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'skallet: ingenting ruller sidelengs fra 320 (WCAG 1.4.10)');
      await withFlags(page, flags.on);

      await page.goto('/threads/nkom-maaloppnaaelse');
      await expect(page.locator('main .markdown').first()).toBeVisible();

      for (const [width, height, where] of [
        [393, 852, 'switched from 1440×900 to 393×852'],
        [852, 393, 'turned to 852×393'],
        [393, 852, 'turned back to 393×852'],
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

        expect.soft(screen.scale, `${where}: the page is zoomed`).toBe(1);
        expect
          .soft(screen.visual, `${where}: the visible window is larger than the page`)
          .toEqual(screen.layout);
        expect
          .soft(screen.shell, `${where}: the shell does not cover the window`)
          .toEqual({ top: 0, height: height });
        expectFits(await measure(page), where);
        await expectTopRow(page, where);
      }
    });
  });
}

/**
 * A link to the retired flag still lands on Innstillinger, as every `?flagg=`
 * link does, but turns nothing on and stores nothing.
 */
test.describe('a link to the retired flag mobile-top-row', () => {
  test.use({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  test('lands on Innstillinger with every experiment off, and the row at the top', async ({
    page,
  }) => {
    await page.goto('/?flagg=mobile-top-row');

    await expect(page).toHaveURL(/\/innstillinger$/u);
    await expect(page.getByRole('heading', { level: 2, name: 'Eksperimenter' })).toBeVisible();
    const switches = page.getByRole('switch');
    await expect(switches.first()).toBeAttached();
    for (const toggle of await switches.all()) await expect(toggle).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('ka.flags.v1'))).toBeNull();
    await expectTopRow(page, 'Innstillinger after the link');
  });
});
