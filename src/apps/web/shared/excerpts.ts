/**
 * The contract of `GET /api/excerpts` (server/excerpts.ts,
 * docs/arkitektur/0005), shared by the server that answers it and the client
 * that asks, so the two cannot disagree about what a request may hold.
 */

/**
 * The most ids one request may carry.
 *
 * 20 because that is what headless-rag gives one answer:
 * `structuredContent.chunks` is `(take 20 chunks)` in
 * `server/src/digdir/mcp/tools.clj`. The client splits a longer list into
 * requests of this size anyway, so an answer with more chunks still gets its
 * text if that number is raised one day (KA CC on #227).
 */
export const MAX_EXCERPT_IDS = 20;

/**
 * What a chunk id is made of. Kudos's are twelve hex digits; the rest of the
 * set is what Nikolai's BFF accepts, so an id one of them takes, the other
 * does too. The server refuses anything else before Typesense is asked, and
 * the client never sends it.
 */
export const CHUNK_ID = /^[A-Za-z0-9._:-]{1,128}$/;
