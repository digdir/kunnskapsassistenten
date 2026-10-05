import { expect, test, type Locator, type Page } from '@playwright/test';
import { covers } from './a11y';
import { ANSWER_TIMEOUT, ask, composer, showThreads, MOCK } from './helpers';

/**
 * The thread list while a conversation is going on.
 *
 * `primary-sidebar.spec.ts` covers the list at rest: the groups, the search,
 * a row you click. It also covers one order of events — ask, then open the
 * list. This file is the other order, the one that was missing: the list is
 * already open when the question is sent.
 *
 * It was measured red before #69: `ThreadsView` read the threads once on
 * mount, so a thread the reader made while the list was open was not in the
 * list at all — eleven rows, and the twelfth only appeared after a detour
 * through the filter view and back.
 *
 * Nothing here waits for a poll, and that is the point. The list is read
 * again on the render where the shell says the conversation moved.
 */

function threadPanel(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Tråder og filter' });
}

/** One period group in the list, found by its own heading. */
function group(page: Page, title: string): Locator {
  return threadPanel(page)
    .locator('.threads-view__group')
    .filter({ has: page.getByRole('heading', { name: title, level: 3 }) });
}

/** The row a thread title sits in, so the timestamp beside it can be read. */
function row(page: Page, title: string): Locator {
  return threadPanel(page)
    .locator('.threads-view__item')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) });
}

test.describe('trådlista mens en samtale pågår', () => {
  test(
    'tråden du lager med lista åpen havner i lista, uten å bytte visning',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'ser en ny tråd dukke opp i lista mens den står åpen');
      await page.goto('/');
      await showThreads(page);

      const panel = threadPanel(page);
      /*
       * Count the rows only once they are there. The list opens on skeletons
       * and reads the threads asynchronously, so a count taken on the render
       * after the switch is 0 — and «one more than before» would then be a
       * claim about an empty list. Measured: expected 1, received 12.
       */
      await expect(panel.getByRole('link', { name: 'NKOM måloppnåelse' })).toBeVisible();
      const before = await panel.locator('.threads-view__thread').count();
      const question = 'Hvor mange årsverk bruker Nkom på tilsyn?';

      await composer(page).click();
      await page.keyboard.type(question);
      await page.keyboard.press('Enter');

      // The address is written with `replaceState` as the question is sent, so
      // it is there long before the answer is.
      await expect(page).toHaveURL(/\/threads\/[\w-]+$/);
      const id = page.url().split('/').pop();
      const created = panel.locator(`a[href="/threads/${id}"]`);

      /*
       * No `showThreads` between the question and this assertion: the list has
       * been open the whole time, and the row is in it while the answer is
       * still streaming. That is the whole claim — the thread exists the moment
       * the question is sent, and the list is a view of the same threads.
       */
      await expect(created).toHaveCount(1);
      // Navnet, ikke teksten: raden bærer også tid og korpus siden 23.09.
      // Unntak fra dirigenten, som for de andre radpåstandene i runden.
      await expect(created).toHaveAccessibleName(question);
      await expect(panel.locator('.threads-view__thread')).toHaveCount(before + 1);

      // And the reader can see which one they are in. `aria-current`, not the
      // colour, is what says it to a screen reader.
      await expect(created).toHaveAttribute('aria-current', 'page');
      await expect(panel.locator('[aria-current="page"]')).toHaveCount(1);

      /*
       * Under «I dag», which is where a thread made a second ago belongs.
       *
       * Not «first in the list», and that is a division of labour rather than a
       * hedge: the top row is asserted for the other order of events — ask,
       * then open the list — in `primary-sidebar.spec.ts`. What is new here is
       * that the row is in the list at all while the list was never closed.
       *
       * Both rest on the same property of the fixtures, and it was not there
       * until #68: `daysAgo` places a fixture hour that has not struck yet
       * proportionally in the part of today that has passed, so no fixture is
       * ever dated later than now. Before that, a thread made at 00:10 sorted
       * correctly under two fixtures stamped 09:30 the same day, and an
       * assertion about the top row was red between midnight and 09:30 over the
       * fixture clock rather than over the product.
       */
      await expect(group(page, 'I dag').locator(`a[href="/threads/${id}"]`)).toHaveCount(1);

      // The answer lands, the list is read again, and the row is still one row.
      await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
        timeout: ANSWER_TIMEOUT,
      });
      await expect(created).toHaveCount(1);
      await expect(created).toHaveAttribute('aria-current', 'page');
    },
  );

  test(
    'et svar i en eldre tråd flytter raden til «I dag» med klokkeslett',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'ser en eldre tråd flytte seg til «I dag» etter et svar');
      await page.goto('/');
      await showThreads(page);

      // `udir-laererspesial` is three days old in the fixtures, so it is in
      // «Siste 7 dager» at every hour of the clock.
      const title = 'Evaluering av lærerspesialordningen';
      await expect(group(page, 'Siste 7 dager').getByRole('link', { name: title })).toHaveCount(1);

      await threadPanel(page).getByRole('link', { name: title }).click();
      await expect(page).toHaveURL(/\/threads\/udir-laererspesial$/);

      await ask(page, 'Hva sier evalueringen om rekruttering?');

      /*
       * The thread was touched, so `updatedAt` moved, and the row moved with
       * it — without the list having been closed once. The timestamp is the
       * same reading: within today the row shows the clock rather than a
       * weekday (see threadTime.ts).
       */
      await expect(group(page, 'I dag').getByRole('link', { name: title })).toHaveCount(1);
      await expect(group(page, 'Siste 7 dager').getByRole('link', { name: title })).toHaveCount(0);
      await expect(row(page, title).locator('time')).toHaveText(/^\d{2}[:.]\d{2}$/);
    },
  );
});

/**
 * A search that stands when the list empties.
 *
 * The search field is not drawn over a list known to be empty (#209, the same
 * thought as Simens issue 82). A query that stood when the last thread went —
 * deleted mid-search — then went with the field out of sight, but not out of
 * the state, and came back invisibly with the next thread and filtered it
 * away: an empty field, no rows, and «Ingen treff». Measured by #2 with a fake
 * BFF and by KA CC in mock; jsdom cannot hold it, because `Search.Input`
 * delivers no `onInput` there.
 *
 * Every thread is deleted through the row menu, as a reader would, rather than
 * by writing the mock's store: a test that knows the store's shape would pass
 * over a change to it.
 *
 * The next question is asked straight from the field on `/`, and not through
 * «Start din første tråd». Since the follow-up to Simens issue 75 that link
 * turns the panel to the filters, which unmounts the list and drops the query
 * by itself, so going through it could not show the bug. Asking from the
 * field, with the list still open, is the way a reader still meets it.
 */
test.describe('et søk når lista blir tom', () => {
  async function deleteThread(page: Page, title: string): Promise<void> {
    await threadPanel(page)
      .getByRole('button', { name: `Flere valg for ${title}` })
      .click();
    await page.getByRole('button', { name: 'Slett', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Slett tråden' }).click();
    await expect(threadPanel(page).getByRole('link', { name: title, exact: true })).toHaveCount(0);
  }

  test(
    'et søk som sto da den siste tråden ble slettet, skjuler ikke den neste',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'et søk henger ikke igjen etter en tom liste');
      await page.goto('/');
      await showThreads(page);

      const panel = threadPanel(page);
      const last = 'NKOM måloppnåelse';
      await expect(panel.getByRole('link', { name: last })).toBeVisible();

      // Every other thread first, so NKOM is left on its own.
      const titles = (
        await panel.locator('.threads-view__thread .threads-view__thread-title').allTextContents()
      ).map((title) => title.trim());
      for (const title of titles) if (title !== last) await deleteThread(page, title);
      await expect(panel.locator('.threads-view__thread')).toHaveCount(1);

      const search = panel.getByRole('searchbox', { name: 'Søk i tråder' });
      await search.fill('Nkom');
      await deleteThread(page, last);

      // The empty state stands alone: no search field over an empty list.
      await expect(panel.getByRole('link', { name: /^Start din første tråd/ })).toBeVisible();
      // Alone: the heading and the line under it went with Simens issue 82.
      await expect(panel.getByText('Ingen tråder ennå')).toHaveCount(0);
      await expect(search).toHaveCount(0);

      // No «Nkom» in it, on purpose: a question that matched the old query
      // would stand in the list even if the query hung on, and the test would
      // be green without the fix. Measured: it was.
      const question = 'Hva sier dokumentene om romfart?';
      await composer(page).click();
      await page.keyboard.type(question);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/threads\/[\w-]+$/);

      // The list has been open the whole time, as in the first test in this file.
      await expect(panel.locator('.threads-view__thread')).toHaveCount(1, {
        timeout: ANSWER_TIMEOUT,
      });
      await expect(search).toHaveValue('');
      await expect(panel.getByText('Ingen treff')).toHaveCount(0);
    },
  );
});
