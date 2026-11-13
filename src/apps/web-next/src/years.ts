// The year list in the next client's filter, as the classic client's server shapes it
// (apps/server/src/facets.ts `shapeFacet`): Kudos's `concerned_years` holds about a thousand
// values, from page numbers and parse noise before 1990 to years far ahead, because some documents
// name a period that runs for centuries. genki returns them all, so the list showed «2252 (0)».
import type { AssistantApi } from '@genai/ui-assembly';

/** The first year kept. Earlier values are page numbers and parse noise. */
export const FIRST_YEAR = 1990;

/**
 * The year it is in Norway, the last year kept. Oslo and not the machine's clock: an hour into
 * the new year in Norway, a browser on UTC still has the old one.
 */
export const currentYear = (now = new Date()): number =>
  Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Oslo', year: 'numeric' }).format(now),
  );

type Field = Awaited<ReturnType<AssistantApi['loadFacets']>>[number];

/**
 * A year field's options from `FIRST_YEAR` to this year, newest first. A value the reader has
 * chosen stays, whatever it is, so its chip keeps its label and can be removed.
 */
export const boundYears = (
  field: Field,
  chosen: readonly string[] = [],
  thisYear = currentYear(),
): Field => {
  if (field.kind !== 'year') return field;
  const keep = (value: string) => {
    if (chosen.includes(value)) return true;
    if (!/^\d{4}$/.test(value)) return false;
    const year = Number(value);
    return year >= FIRST_YEAR && year <= thisYear;
  };
  return {
    ...field,
    options: field.options
      .filter((option) => keep(option.value))
      .sort((a, b) => Number(b.value) - Number(a.value)),
  };
};

/** `api`, with every year field's options bounded. */
export const withYearBounds = (
  api: AssistantApi,
  thisYear: () => number = currentYear,
): AssistantApi => ({
  ...api,
  loadFacets: async (selection, dataset, fields) => {
    const found = await api.loadFacets(selection, dataset, fields);
    const year = thisYear();
    return found.map((field) => boundYears(field, selection[field.id] ?? [], year));
  },
});
