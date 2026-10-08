// Kudos' document page has no page anchors; only the PDF address honours
// `#page=N`, so only such an address gets «Les side N».

/** True when this address opens the named page, not just the document. */
export function reachesPage(kudosUrl: string, page: number): boolean {
  const hash = kudosUrl.slice(kudosUrl.indexOf('#'));

  return kudosUrl.includes('#') && hash === `#page=${page}`;
}

/**
 * «Les side N på <korpus>» or «Les dokumentet på <korpus>», without «på …»
 * when nothing names the corpus.
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
