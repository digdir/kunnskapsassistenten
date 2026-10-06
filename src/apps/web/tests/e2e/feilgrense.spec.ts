import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ANSWER_TIMEOUT, composer, MOCK } from './helpers';

/**
 * The page that stands where the app was, after an error React cannot recover
 * from (#221).
 *
 * A white page appeared in the test environment on 30.09, starting a new
 * thread: `NotFoundError: Failed to execute 'removeChild' on 'Node'`. The cause
 * in that browser is not known. The mechanism is: something outside React —
 * a page translator, an extension — replaces text nodes while an answer
 * streams, and React, removing a node that is no longer where it left it,
 * throws in its commit phase and unmounts the whole root. Measured by #5 in
 * design/_briefs/bygg/maalt-hvit-skjerm-ny-traad.md, and by KA CC: on `main`
 * before #221, 8 of 8 white pages, with `#root` empty; with #221, 8 of 8 times
 * the page below.
 *
 * The imitation is what a page translator does: it watches the page, and
 * every text node that appears is swapped for a `<font>` with the same text.
 * It starts when the answer's text starts, and stops when the error page is
 * there. Swapping once, at a moment chosen by the test, was the first version,
 * and it was green 15 of 15 locally but red on CI, where the one swap landed
 * after the stream had done its last update. Watching makes it independent of
 * the machine's speed: every update React makes from then on meets text it no
 * longer owns, and the lists that are redrawn when the sources arrive are
 * among them.
 */
function installTranslator(): void {
  const state = window as unknown as { translatedTexts: number };
  state.translatedTexts = 0;

  const translate = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      const tag = text.parentElement?.tagName;
      // Text already translated sits in a <font>, and swapping it again would
      // feed the observer its own changes for ever.
      if (
        text.textContent?.trim() &&
        tag !== 'FONT' &&
        tag !== 'SCRIPT' &&
        tag !== 'STYLE' &&
        tag !== 'TEXTAREA'
      ) {
        texts.push(text);
      }
    }
    for (const text of texts) {
      const font = document.createElement('font');
      font.textContent = text.textContent;
      text.replaceWith(font);
    }
    state.translatedTexts += texts.length;
  };

  const observer = new MutationObserver(() => {
    if (document.querySelector('.app-crash')) {
      observer.disconnect();
      return;
    }
    if (document.querySelector('.ka-answer-card .markdown p')) translate();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

test.describe('feilgrensen', () => {
  test(
    'en sideoversetter mens svaret strømmer gir «Noe gikk galt», ikke hvit skjerm',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'en feil React ikke kommer seg fra, gir en side med «Last inn på nytt»');

      // An error the boundary catches is reported with `console.error`; one
      // that gets past it reaches the page as `pageerror`, and that is the
      // white page.
      const uncaught: string[] = [];
      page.on('pageerror', (error) => uncaught.push(`${error.name}: ${error.message}`));

      await page.goto('/');
      await page.evaluate(installTranslator);
      await composer(page).click();
      await page.keyboard.type('Hva sier dokumentene om romfart?');
      await page.keyboard.press('Enter');

      const heading = page.getByRole('heading', { name: 'Noe gikk galt', level: 1 });
      await expect(heading).toBeVisible({ timeout: ANSWER_TIMEOUT });
      expect(
        await page.evaluate(
          () => (window as unknown as { translatedTexts: number }).translatedTexts,
        ),
        'oversetteren byttet tekst',
      ).toBeGreaterThan(0);
      // Whatever held the focus is gone, so the heading takes it.
      await expect(heading).toBeFocused();
      await expect(
        page.getByText(/utvidelse i nettleseren, eller oversettelse av siden/),
      ).toBeVisible();
      expect(uncaught, 'feilen skal fanges, ikke nå siden').toEqual([]);

      await expectNoAxeViolations(page, 'feilsiden', { keepFocus: true });

      // The one thing that helps: loading again.
      await page.getByRole('button', { name: 'Last inn på nytt' }).click();
      await expect(composer(page)).toBeVisible();
      await expect(heading).toHaveCount(0);
    },
  );
});
