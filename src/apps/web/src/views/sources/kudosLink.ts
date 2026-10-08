/**
 * What the link out to Kudos can honestly promise.
 *
 * Measured against kudos.dfo.no on 2026-09-16 (see
 * `design/kudos-lenker-og-usikre-2026-09-16.md`):
 *
 * - `https://kudos.dfo.no/dokument/<uuid>` is a landing page with the
 *   document's summary. It has no PDF viewer — no `iframe`, `embed` or
 *   `object` — and no per-page anchors, so no fragment on it scrolls
 *   anywhere. `#side-41` and `#page=41` both land at the top.
 * - The PDF itself is a separate address,
 *   `https://kudos.dfo.no/dokument/<uuid>/filer/<fil-uuid>.pdf`, served as
 *   `application/pdf` with `content-disposition: inline`. The browser's own
 *   viewer opens it and honours `#page=N` (PDF Open Parameters).
 *
 * So «Les side 41 på Kudos» is only true when the address is the file with
 * `#page=41` on it. Anywhere else the link opens the document at the top, and
 * that is what the label should say. The page number is not lost by this: the
 * excerpt prints «side 41» above the quote either way.
 *
 * The rule is written as a question about the address rather than a flag from
 * the data on purpose — the day the backend starts handing out file URLs, the
 * label upgrades itself with no further change here.
 */

/** True when this address opens the named page, not just the document. */
export function reachesPage(kudosUrl: string, page: number): boolean {
  const hash = kudosUrl.slice(kudosUrl.indexOf('#'));

  return kudosUrl.includes('#') && hash === `#page=${page}`;
}

/**
 * The link text for an excerpt's «read it at the source» link.
 *
 * The corpus is named rather than written in, for the same reason the
 * disclaimer names it: «Les dokumentet på Kudos» over a NorQuAD article is
 * the same false sentence KA CC measured on the line above it (bør on #129).
 * The name is the answer's corpus, so it does not change under a reader who
 * moves the chooser while an old thread is open.
 *
 * `undefined` when nothing names the corpus, and then the link says only what
 * it does. The disclaimer can fall back to «standardkorpuset» because it is a
 * sentence about where the text came from and has to say something; a link
 * label is not, and «Les dokumentet på standardkorpuset» would be a clumsy
 * name for a control (dirigenten, 21.09).
 *
 * The page half stays as it was. That is about the shape of the address and
 * not about whose corpus it is: only a file URL with `#page=N` opens a page,
 * whoever serves it, and anything else honestly says «dokumentet».
 */
export function kudosLinkLabel(
  kudosUrl: string,
  page: number | undefined,
  corpusName: string | undefined,
): string {
  const what =
    page !== undefined && reachesPage(kudosUrl, page) ? `Les side ${page}` : 'Les dokumentet';

  return corpusName === undefined ? what : `${what} på ${corpusName}`;
}

/** The same, for a document card's own link, which never names a page. */
export function documentLinkLabel(corpusName: string | undefined): string {
  return corpusName === undefined ? 'Les dokumentet' : `Les dokumentet på ${corpusName}`;
}
