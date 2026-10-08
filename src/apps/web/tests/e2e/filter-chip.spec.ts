import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';
import { chooseFacetValue, MOCK } from './helpers';

/**
 * A filter chip is never wider than the field it sits in (#112).
 *
 * Designsystemet draws a selected value as a one-line pill: `white-space:
 * nowrap`, a fixed height, `text-overflow: ellipsis`, and no ceiling on the
 * width. The chip row wraps BETWEEN chips (#91), but one chip that is wider
 * than the panel on its own did not wrap at all — «Statsforvalteren i
 * Østfold, Buskerd, Oslo og Akershus» measured 456 px in a 327 px field at
 * 1440 and ran 92 px past the panel edge, remove cross off screen (measured
 * 21.09, skjermbilde 12:22). `src/views/filters/filters.css` puts the ceiling
 * on and wraps the text inside the chip instead of cutting it.
 *
 * This is an e2e test and not a unit test because the rule is CSS and jsdom
 * has none: `filters.css` contributes zero rules there — measured by #2 in
 * #112 — so a width assertion in vitest would compare two zeroes and pass on
 * a broken panel. Measured red without the fix: 492 against 363 at 1440.
 *
 * Two widths, because the same view is drawn in two boxes. 1440 is the panel
 * beside the answer, 1100 is under the 1139 breakpoint where the panel
 * becomes a drawer over the answer (#97). The drawer is the one where the
 * overflow has nowhere to go: the panel's own scroll region does not exist
 * there, and a chip past the edge is past the window.
 */

/**
 * The organisation from the screenshot, the longest name in the corpus as
 * rendered.
 *
 * «Buskerd» is not a typo in this file. Kudos itself spells the owner's
 * display name that way — `owner name` on document a1c6787d, where the title
 * says «Buskerud» — and `src/api/mock/corpus/kudos-korpus.json` is faithful
 * to the source. Correcting it here would make the test look for a value the
 * fixture does not have.
 */
const ORG = 'Statsforvalteren i Østfold, Buskerd, Oslo og Akershus';

const WIDE = { width: 1440, height: 900 };
/** Under the 1139 breakpoint from #97, so the panel is a drawer. */
const DRAWER = { width: 1100, height: 900 };

type Box = { x: number; right: number; width: number; height: number };

/**
 * The chip and the field it sits in, in the «Virksomheter» field.
 *
 * Read through the DOM and not through a role, for two reasons. The chip is a
 * bare `<data>` element u-combobox writes into the light DOM, with no role of
 * its own; and all three facet fields hold chips, so the read has to be
 * scoped to one field the way `facetOption()` is — «Statsforvalteren» would
 * otherwise be looked for among values from every dimension at once.
 */
async function chipAndField(page: Page, dimension: string) {
  return page.evaluate((label) => {
    const read = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    const labels = [...document.querySelectorAll('.filters-view ds-field label')];
    const field = labels
      .find((element) => element.textContent?.trim() === label)
      ?.closest('ds-field')
      ?.querySelector('ds-suggestion');
    if (!field) throw new Error(`fant ikke feltet «${label}» i filterpanelet`);

    const chip = field.querySelector(':scope > data');
    if (!chip) throw new Error(`ingen chip i feltet «${label}»`);

    return {
      chip: read(chip),
      field: read(field),
      text: chip.textContent?.trim() ?? '',
      /*
       * What the text needs against what the chip gives it. Equal means
       * nothing is cut; larger means the name is behind an ellipsis, which
       * is the other way this could «fit» and the one WCAG 1.4.4 and 1.4.10
       * are about — «Statsforvalteren i Østfold, Bu…» does not say which of
       * the statsforvaltere is filtered on.
       */
      overflow: Math.round(chip.scrollWidth - chip.clientWidth),
    };
  }, dimension);
}

function expectChipInsideField(
  measured: Awaited<ReturnType<typeof chipAndField>>,
  where: string,
): void {
  expect(measured.text, `chipen viser hele navnet ${where}`).toBe(ORG);

  expect(
    measured.chip.right,
    `chipens høyre kant ${where}: ${measured.chip.right} mot feltets ${measured.field.right} (chip ${measured.chip.width} px i et felt på ${measured.field.width})`,
  ).toBeLessThanOrEqual(measured.field.right);

  expect(
    measured.overflow,
    `avkortet tekst i chipen ${where}: ${measured.overflow} px stikker forbi det synlige`,
  ).toBe(0);
}

test.describe('en filterchip holder seg i feltet', () => {
  test('i panelet ved siden av svaret, på 1440', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'en lang filterchip bryter inne i feltet (#112)');
    await page.setViewportSize(WIDE);
    await page.goto('/');

    await chooseFacetValue(page, 'Virksomheter', ORG);

    const measured = await chipAndField(page, 'Virksomheter');
    expectChipInsideField(measured, 'i panelet på 1440');

    // Og det er en ekte prøve: uten taket i filters.css er chipen bredere enn
    // feltet, så navnet må være langt nok til å fylle det.
    expect(
      measured.chip.width,
      'chipen fyller feltet, ellers prøver testen ingenting',
    ).toBeGreaterThan(measured.field.width / 2);
  });

  test('i skuffa under brytepunktet, på 1100', MOCK, async ({ page }, testInfo) => {
    covers(testInfo, 'en lang filterchip bryter inne i feltet (#112)');
    await page.setViewportSize(DRAWER);
    await page.goto('/');

    const dialog = page.getByRole('dialog', { name: /^tråder og filter$/i });
    await page.getByRole('button', { name: /^Vis tråder og filter/ }).click();
    await expect(dialog).toBeVisible();
    /*
     * Wait the slide-in out before measuring anything, the way drawers.spec.ts
     * does: Designsystemet slides the drawer in from `translate: -3rem`, and
     * measured mid-flight every x in it is 46 px too far.
     */
    await page.evaluate(() =>
      Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
    );

    await chooseFacetValue(page, 'Virksomheter', ORG);

    const measured = await chipAndField(page, 'Virksomheter');
    expectChipInsideField(measured, 'i skuffa på 1100');

    // I skuffa er feltkanten også nær vindusranda, så en chip forbi den er
    // forbi skjermen. Målt mot skuffa selv, ikke bare mot feltet.
    const drawer = (await dialog.boundingBox())!;
    expect(
      measured.chip.right,
      `chipens høyre kant mot skuffas ${Math.round(drawer.x + drawer.width)}`,
    ).toBeLessThanOrEqual(Math.round(drawer.x + drawer.width));
  });
});
