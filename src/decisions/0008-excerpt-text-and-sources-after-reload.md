# 0008 — The excerpt text, and the sources after a reload, in live

**Status:** accepted · **Date:** 2026-09-30 · **Changed:** 2026-10-05: the
steps (issue 88 in `digdir/kunnskapsassistenten`), the numbers measured in review
of larsekhansen/kunnskapsassistenten-frontend#227, what the store holds (review
of larsekhansen/kunnskapsassistenten-frontend#233), and that it is cleared on
«Logg ut»

Numbered 0008 here. It was 0005 in Norwegian in the client's own repository
(`larsekhansen/kunnskapsassistenten-frontend`, `docs/arkitektur/`).

## Context

Two of the points in the third round of design review concern the data behind
the sources panel in live mode. That is the mode the test environment in Azure
runs.

- **86d:** an open excerpt shows the heading path and the link to Kudos, but not
  the text from the document.
- **Extra 2:** reload the page, also after a deployment, and all the sources
  are gone.

This was measured against the local stack on :8080 (tenant `kudos`, dataset
`kudos-full`) on 30.09, with three questions through `/api/mcp` the way
`LiveChatClient` sends them:

- `structuredContent.chunks` has the fields `chunk_id`, `doc_num`,
  `chunk_index`, `title` and `metadata`, but not the text. The answers had 6, 15
  and 3 chunks. In the code, headless-rag picks the fields with `select-keys`
  without `content_markdown`, and it takes only the first 20 chunks
  (`mcp/tools.clj:731-740`, read, not measured).
- A conversation read back with `GET /api/conversations/:id` has `chunks: []`
  on every message. That is digdir/digdir-headless-rag#21:
  `transact-used-data` (`data/db.cljc:1297`) is never called.
- The stored text of the answer is identical, character for character, to the
  text in `tools/call`, measured in one answer of 621 characters. The message
  gets an id of its own in the backend, while the client gives the answer the id
  `msg-<time>` in `done`. So the id from the stream cannot be used to recognise
  the answer after a reload, but the conversation's id and the answer's text can.
- The references to the chunks in one answer with 3 chunks were 1041 characters
  of JSON, with the headings. That comes to about 350 characters per chunk.

headless-rag has no route where a client with `X-API-Key` gets the text of
chunks from their ids. That is read in the code, not measured. The excerpt lives
in Typesense, in the dataset's chunk collection, in the field
`content_markdown`, and `chunk_id` is also the Typesense id
(`docs/loader.clj:521`). The BFF in this repository fetches the text from there,
with the ids from the answer (`apps/server/src/excerpts.ts`). Our thin server
already asks Typesense for the facets (0004).

## Decision

**1. The text.** The thin server gets
`GET /api/excerpts?dataset=<key>&ids=<id>,…`. It looks the ids up in the
dataset's chunk collection and answers
`{ "excerpts": { "<chunk_id>": "<content_markdown>" } }`. An id that does not
exist is left out. The route uses the same `TYPESENSE_URL` and
`TYPESENSE_API_KEY` as the facets, and a new `KA_CHUNK_COLLECTIONS`
(`dataset=collection;…`), with the same grammar as `KA_FACET_COLLECTIONS`.
`LiveChatClient` asks the route when the answer is done and before the sources
are passed on. The text ends up in `Excerpt.text`, in the same shape the BFF
gives in bff mode. If the lookup fails, or an id is missing, `textUnavailable`
is set, and the panel says so in words, as it does in bff mode.

**2. The sources after a reload.** The client stores the references to the
chunks of each answer in `localStorage`. The key is the conversation's id and a
fingerprint of the answer's text. When a thread is opened and the backend does
not have the chunks, the client finds the references again, builds the sources
the same way as in the stream and fetches the text from the route in point 1.
Only what the stream gave is stored, that is, ids, document number, title,
address and headings. No text from the documents is stored in the browser.

**3. The steps after a reload** (changed 2026-10-05). The procedure box was
gone for the same reason (issue 88 in `digdir/kunnskapsassistenten`). The same
store therefore also keeps what the stream said about the steps, beside the
chunks: the steps as they came (`thinkingSteps`), the hits, the documents and
the search words (`retrieval`), and how long the agent thought (`thoughtMs`).
Those are the agent's own words about what it did, and the search strings it
used, not text from the documents. They come from the question the reader
asked; see «What the store holds» below. The thinking time is measured in the
client on the same events and in the same order as the chat measures it, so the
number after a reload is the one that was on the screen. The answer is written
down before the text is looked up, so a reload in the middle of the lookup
loses nothing.

The reason for point 2 is that it is the only way that works now without a
change in headless-rag. The lookup by ids is the same in both situations, so a
new answer and an answer read back cannot show different text for the same
chunk.

## Alternatives considered

- **Store the sources with their text in `localStorage`.** Then no lookup is
  needed on reload. But the text from the documents stays in the browser, and it
  takes more room. How much is not measured, because the text does not exist in
  live. It is what bff mode could have done, because the BFF gives the text, but
  the BFF has no route for a lookup by ids.
- **`POST /api/skills/enrichment-fetch-chunk-context/execute` in
  headless-rag.** It takes one chunk per call, and by its own documentation it
  is a tool for work outside the run, not part of the search. It is not
  measured. It would have meant 3 to 20 calls per answer through a surface not
  made for us.
- **`/v1/chat/completions`.** It gives the text for the chunks the answer cites,
  but only by running a new turn with the agent.
- **`sessionStorage`.** It survives a reload of the page, but not the tab being
  closed. The sources are wanted back the next day too.
- **Wait for digdir/digdir-headless-rag#21.** That is the right fix, but it is
  not in place.

## Consequences

- **The test environment needs a key that can search the chunk collection.**
  The search key the frontend has there today (id 2) has only
  `documents:search` on `KUDOS_preprod_v4_documents_.*`. Then the lookup answers
  with an error, and every excerpt gets `textUnavailable`. A new key is a write
  to Typesense, and it has to be made by someone with admin access to it. The
  name of the chunk collection also has to go into `KA_CHUNK_COLLECTIONS`.
  Without those two, point 2 still works, but without text.
- **The ids from the browser go into a Typesense filter.** The route takes only
  ids made of `A–Z`, `a–z`, `0–9`, `.`, `_`, `:` and `-`, and at most 20 at a
  time, the same as headless-rag gives per answer (`apps/web/shared/excerpts.ts`).
  The client splits a longer list into requests of 20, so an answer with more
  chunks gets its text the day headless-rag gives more. Each id is put in
  backticks in `filter_by`. The key never leaves the server. The dataset has to
  be one of those that are configured.
- **The sources arrive a little later than the answer,** by the time the lookup
  takes. Measured in review of larsekhansen/kunnskapsassistenten-frontend#227:
  150–155 ms while the answer came, and 45–155 ms after a reload. A thread that
  is reloaded is drawn when all the lookups are done, and it stood 237 ms after
  the reload. If Typesense hangs, the route answers 502 after 5 seconds
  (measured: 5011 ms), and both the sources in a new answer and a thread being
  opened wait that long. The client itself gives up after 6 seconds. Drawing the
  thread first and filling in the text afterwards would need a new path for
  updates through the chat and the sources panel. At 237 ms as a rule, that is
  not worth it now.
- **The store in the browser has a limit.** The references take about 380
  characters per chunk (5308 characters for 14 chunks, measured in review of
  larsekhansen/kunnskapsassistenten-frontend#227) and at most 20 chunks per
  answer, so about 7 600 characters per answer, plus the steps. The client keeps
  the store under 1 000 000 characters by removing the thread used longest ago.
  If writing is not possible, everything is as before: the sources disappear on
  reload, and that is the only thing that happens.
- **What the store holds** (`ka.sources.v1`, corrected 2026-10-05 after review
  of larsekhansen/kunnskapsassistenten-frontend#233). The key is the backend's
  id for the conversation and a fingerprint of the answer text, that is, the
  length and a hash, not the text itself. For each answer this is there:
  - **the chunks**: id, document number, title, address and the heading path.
    That is what the answer itself carried, and it comes from a public corpus.
  - **the steps**: every step with id, kind, label, detail, search strings and
    duration. That is the agent's plan in the first person (the label on a
    thinking step), the search strings it used (`queries`) and the tool's
    summary (`result-summary`, which is in `detail`). All of it comes from the
    question the reader asked.
  - **the search words** in `retrieval.keywords`. Measured 5.10: the first
    search word was the question, word for word.
  - **the numbers**: hits, documents, the thinking time in milliseconds, and
    when the thread was last used.

  The answer text, the question as a field of its own and text from the
  documents are not there. The question can still be read out of the search
  words and the agent's plan.

- **The store is per browser, not per user, and it stays.** It has no expiry.
  It is cleared only when it grows too large (the thread used longest ago goes
  first), when the reader clears the site's data, or when the code removes it. In
  live without sign-in, as in the test environment today, the identity is also
  per browser (`ka.user.v1`). Then whoever uses the browser sees the threads
  anyway. With sign-in every user has their own threads, and the app only brings
  out sources and steps for threads the backend gives the signed-in user. The
  store is still shared, so the next person to use the same browser can read the
  previous one's search words and the agent's plan in the developer tools. What a
  sign-out in Azure does to `localStorage` is not measured.
- **The store is cleared on «Logg ut»** (Lars said yes on 5.10). That applies
  where there is a sign-out, that is, in bff mode (`/auth/logout`,
  `beforeLogout` in `apps/web/src/api/session.ts`). The store is cleared in the
  click, before the browser follows the link. Today only live mode writes to the
  store, and live has no sign-out, so behind the BFF what is cleared is what a
  browser brings along from live. The clearing is thus in place the day the store
  is used behind the BFF. If live gets sign-in, the same clearing has to go in
  there.
- **An answer is recognised by its text.** If the backend changes the text after
  it has been stored, the answer does not get its sources back, and the panel is
  then as today. That is safer than putting sources on the wrong answer.
- **Live mode only.** Mock has its own data. Behind the BFF the problem is the
  same, and the same store could be used there, but it is not part of this
  decision.
- **The thin server is to go** (0005). The route is a bridge, like the facets in 0004. In this repository it is the BFF that owns the lookup.

## What would change the decision

- **headless-rag stores the chunks per message
  (digdir/digdir-headless-rag#21).** `GET /api/conversations/:id` then gives
  `contentMarkdown` for every chunk, and `sourcesFromChunks` already reads it.
  Then the store in the browser can be removed.
- **headless-rag includes `content_markdown` in `structuredContent.chunks`.**
  Then point 1 is not needed for a new answer. It is API request A1, and in the
  code it is adding one field to a `select-keys`.
- **The fingerprint misses.** If stored text and streamed text turn out to differ
  for many answers, the key has to become something else. That could be the
  question's text and its place in the conversation. This is measured in one
  answer.
