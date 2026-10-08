/**
 * The year it is in Norway, which is the last year a year filter offers.
 *
 * A plan or an allocation letter names the year it runs to, so a corpus holds
 * years no document is FROM yet, and the filter offered 2027–2035 (issue 75,
 * 30.09). Shared because two policies end here and have to agree:
 * the server's, counted from Typesense (server/facets.ts), and the mock's
 * (src/api/mock/corpus/facets.ts).
 *
 * Oslo and not the machine's clock, because the container runs in UTC and
 * the reader does not: an hour into the new year in Norway it is still the
 * old one there.
 */
export function currentYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Oslo', year: 'numeric' }).format(now),
  );
}
