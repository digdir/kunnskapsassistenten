/**
 * An address from a backend, if it is one the app may put in an `href`.
 *
 * Both clients build `SourceDocument.url` and `Excerpt.kudosUrl` from what a
 * backend hands them, and the sources panel renders those as links. The
 * address is read off a document in the corpus, so it is not this app's own
 * and nothing guarantees its shape — the client checks it for itself rather
 * than trusting that whatever is in front of it already did (the review of
 * #129).
 *
 * `http` and `https` only, written as a list of what IS allowed, so a scheme
 * nobody thought of is refused rather than let through. No base is passed on
 * purpose: a relative address is not something a source has, so one is
 * refused outright rather than resolved against the page.
 *
 * A source whose address is dropped is still a source. The panel already has
 * words for a document with no public link, which is the normal state for a
 * folder-based corpus.
 *
 * Here and not in either client, because it is the same rule for both and a
 * second copy of «what may become a link» would drift from the first within
 * the week. Which client it would have gone in is not a free choice either.
 * The dependency between them runs one way today, from the BFF client to the
 * live one: `bff/mapping.ts` reads stored messages and chunks with the live
 * client's own readers, and `BffChatClient` decodes SSE with its decoder,
 * while nothing under `live/` imports from `bff/`. Putting the rule in the
 * live client would have said it is the live client's; putting it in the BFF
 * client would have turned that one direction around. A file of its own says
 * what is true — the rule is the app's, not either backend's — and leaves the
 * direction where it was.
 */
export function publicUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}
