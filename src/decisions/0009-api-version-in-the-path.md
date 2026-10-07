# 0009 — The API version in the path, one core, and main's format for the current client

**Status:** accepted · **Date:** 2026-10-07

## Context

This repository has one BFF, `src/apps/server`, and from now on two clients:

- **The current client**, `src/apps/web-preact`: the client on main at
  `8639267`, a Preact port of the original Clojure frontend. It is back next to
  the new one so the two can be compared, and it is changed only where it has
  to be to build in the workspace.
- **The new client**, `src/apps/web`, from
  `larsekhansen/kunnskapsassistenten-frontend`.

Both are served by the same deployment, with the same sign-in and the same
threads. Which page a browser gets is a separate choice, made by a cookie, and
not part of this decision.

The 19 commits to the BFF in #129 changed its API in place, for the new
client. The stream of `/api/ask` gained `thinking` and `tool-call` events,
sources became one per chunk instead of one per document, a filter the backend
would refuse became a 400 instead of being dropped, and the facets came from
configuration with every value. The current client cannot read that.
Measured 2026-10-07 with `useTurn.ts` from `apps/web-preact` and a stubbed
`fetch`:

- In main's format the answer is shown and the turn ends.
- With one `thinking` event before the answer, the turn is `undefined`, and
  the answer is never shown. `apply` has a `switch` with no `default`, so the
  first unknown type returns nothing, and every event after it meets
  `if (!t) return t`. `tsc` says the same: against the new contract the switch
  is not exhaustive (TS2345 on line 85).

On main, the BFF also passes the agent's plan on as the answer. Against
headless-rag every `response/chunk` is the agent's plan, and the answer comes
whole in the final frame. Main passed the chunks on as the answer and skipped
the final frame, so the current client shows the plan where the answer should
be (measured 2026-09-28, fixed in `9ab52e1`).

## Decision

**The version is in the path, and each client asks for its own.**
`/api/*` is for the current client, in the format of main `8639267`.
`/api/v2/*` is the new API, for the new client. `/auth/*` is shared.

**One core speaks to headless-rag, and each version is a router module on
top of it.**

- `mcp.ts` (`ask`), `facets.ts`, `capabilities.ts`, `sourceStore.ts` and
  `threadFilters.ts` are the core. There is one of each.
- `apiV1.ts` is `/api`, `apiV2.ts` is `/api/v2`, and `app.ts` mounts them.
- What both versions answer the same way is written once in `apiShared.ts`
  and mounted in both: `/health`, `/me`, `/models`, and listing, renaming and
  deleting threads.
- `POST …/ask` is one handler, `apiAsk.ts`. The question, the checks and the
  memory of sources and filters are the same for both. The version decides
  only how the events reach its client.

**`/api/*` gives main's format, not main's code.**

- Only the six event types main sent, which are the ones `useTurn.ts`
  handles: `conversation`, `stage`, `delta`, `sources`, `done` and `error`.
  The contract names them `TurnEventV1`. A `stage` is sent where main sent
  one, from the same frames.
- One source per document, in the order each document first appears,
  numbered from 1, with the passages of all its chunks joined. A thread read
  back gives its sources the same way.
- The facets are `{ field, label, options }`, and the capabilities are
  `{ capabilities, settled }`.
- The fixes to the core reach both clients: the answer instead of the plan,
  no error text from the backend in the browser, a blank chunk that does not
  hide the answer, the timeout on the excerpt lookup, and the checks on
  filters.

**The filter is keyed by the corpus's field names in both versions.** The
current client keys its selection by `facet.field` from `/api/facets`, which
are the Typesense field names (`type`, `orgs_long`, `concerned_years`).
`/api/v2` is keyed the same way (`FacetField.field`, `AskRequest.filter`). So
the same validation takes both, with nothing to translate. The year goes on
with `value-type: integer`, which main did not send.

**A contract test per client.** `apiV1.test.ts` sends the requests the current
client sends and reads the answers the way it reads them. It fails if any
other event type reaches it. `apiV2.test.ts` does the same for the new client.
Both run against the app (`app.request`), with headless-rag and Typesense
stubbed behind `fetch` (`apps/server/fixtures/backend.ts`).

**When the current client goes,** `apiV1.ts`, its mount in `app.ts`,
`apiV1.test.ts` and `TurnEventV1` go with it.

## Why the path

The code that runs decides the format, and nothing else does. A response can
be explained from its URL alone: in a log line, in devtools, in a test and
with `curl`. A tab that still has the other client open keeps asking for its
own version, whatever the reader has chosen in another tab since.

## Alternatives considered

**The cookie that chooses the client also chooses the API format.** It is
there on every `/api` call already, and it needs no new paths. It was not
chosen because the cookie belongs to the browser and not to the tab. A reader
who switches client in one tab changes the format for every other tab, and a
tab with the other client still open then gets answers it cannot read. The
measurement above shows what that does to the current client: the turn is
lost, with no error. A response could also no longer be explained from the
request alone.

**One API, and the current client changed to read it.** It was not chosen
because the current client is there to be compared as it is. Teaching it
per-chunk sources and the new events would be a port, it would change what is
being compared, and it is more than the change needed to build.

**The version in a header**, such as `Accept` or a header of our own. It was
not chosen because it has the same weakness as the cookie, but is easier to
miss. A header is not in the URL, so it is not in an ordinary log line, it has
to be on every call the client makes, and caches have to vary on it.

**Main's `mcp.ts` and `facets.ts` kept word for word as the code behind
`/api/*`.** That is the most literal reading of «as on main», and removing it
later would be one folder. It was not chosen for two reasons. The current
client would go on showing the agent's plan as the answer, which is a fault in
the BFF and not in the client, and would make the comparison unfair. And there
would be two implementations of the protocol to keep in step with
headless-rag.

## Measured, and only read

Measured 2026-10-07:

- The contract tests, 17, and all 155 server tests, green.
- The real `server.ts` answers 200 on `/api/health` and `/api/v2/health`, gives
  each version its own capabilities, and 404 on an unknown path under
  `/api/v2`.
- The effect of one `thinking` event on `useTurn.ts`, described above.
- `apps/web-preact`: 55 of 55 tests and the build green with Node 24.21.0.
  `tsc` green with both TypeScript 5.9 and 6 once it reads `TurnEventV1`.

Only read:

- That headless-rag sends `agent/thinking` after every model response that is
  not blank (`agent/iteration_bundled.clj`, `agent/loop.clj`). The contract
  tests use a stubbed stream, not a running headless-rag.
- Neither client has been run in a browser against this BFF and a real
  headless-rag.

## Consequences

- The new client calls `/api/v2/*`. That change lands in the same push as
  this one. Until then it would get main's format.
- The current client no longer behaves exactly as on main. It gets the fixes
  listed above, every value of each facet (457 organisations, not 200), the
  year as an integer filter, and a 400 for a filter the backend would refuse,
  where main dropped it.
- Sources are stored once, one per chunk, and `/api/*` groups them when it
  sends them or reads a thread back. A thread asked in one client and read in
  the other gets the sources in the reader's format.
- In the current client, `[n]` in the answer and the numbers in the sources
  panel count different things, as on main. `[n]` is the place of a chunk in
  the result, and the panel numbers documents. An answer that cites `[1]`,
  `[2]` and `[3]` from two documents has sources 1 and 2, and `[3]` has no
  source 3 (measured 2026-10-07). It is main's format, not a fault in the
  client, and it should not be counted against it when the two are compared.
- The capability probe, the facet cache and the stores are shared. Both
  clients see the same capabilities.

## What would change the decision

- **The current client is removed.** Then `/api/*` and its module go, as
  described above. Whether `/api/v2` then moves back to `/api` is a choice for
  that day, and it would be a change to the new client too.
- **Others than our two clients start calling the BFF.** Then the versions are
  a public contract, and they would want a written schema each, not only
  contract tests.
- **The current client is to show the agent's steps or one source per
  chunk.** Then it moves to `/api/v2`, and `/api/*` goes earlier.
