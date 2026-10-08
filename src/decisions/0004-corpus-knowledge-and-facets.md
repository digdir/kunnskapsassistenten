# 0004 — Where the knowledge about a corpus should live

**Status:** proposed, not agreed with the owners of headless-rag or of this
repository · **Date:** 2026-09-24

Numbered 0004 here. It was 0001 in Norwegian in the client's own repository
(`larsekhansen/kunnskapsassistenten-frontend`, `docs/arkitektur/`).

## Context

The filter panel needs facets: lists of document types, organisations and
years, with counts. Somebody has to know that Kudos calls them `type`,
`orgs_long` and `concerned_years`, that `concerned_years` has noise such as
«2436», and that `orgs_short` is empty. Where should that knowledge live?

Headless-rag is meant to work with any frontend, and other organisations will
come with other corpora, perhaps several at once. Datasets and their structure
will always differ from one organisation to the next.

## What exists today

**The monorepo's frontend** has the facets as a fixed list in its own server
(`apps/server/src/facets.ts`), with the comment _«orgs_short is left out: it is
empty in this corpus»_. The server asks Typesense directly, with its own key.

**Our frontend** has facets only in mock. In live, `listFacets` returns an
empty list, because the backend has no facet API.

Both work for Kudos, and neither works for another corpus without new code.

## Alternatives

|       | where                                                           | cost                                                                                               |
| ----- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A** | A fixed list in every frontend                                  | Every frontend needs a Typesense key and the field names. The logic is copied per frontend.        |
| **B** | A fixed list in the backend                                     | As hardcoded as A, only in one place. A new corpus still needs new code.                           |
| **C** | An agent generates an MCP server or an API per organisation     | One codebase per organisation to maintain, test and security-approve. Generated code drifts apart. |
| **D** | A shared mechanism in the backend, policy in the dataset config | Somebody has to write a facet profile per dataset — see below.                                     |

## Decision (proposed): D

The headless-rag maintainers have already written the principle down, for
title fields and the auto-filter, in
`digdir-headless-rag/plans/proposed/retrieval-configurable-fields-rules-plan.md`:

> Code should ship the **mechanism** (…); the **policy** (which fields, which
> markers, which patterns) belongs in dataset-scoped config.

Facets are the natural next step.

**The mechanism, written once.** A Typesense schema describes itself: every
field says whether it is a facet. A shared tool in the backend reads the schema
and the dataset's profile, and returns the facets in a generic format:

```
[{ field: "type", label: "dokumenttyper", options: [{ value: "Årsrapport", count: 2874 }, …] }, …]
```

That is the format the monorepo's BFF already uses. The frontend draws what
comes, and knows nothing about Kudos.

**The policy, per dataset.** The schema alone is not enough. In Kudos, `title`,
`url` and `doc_num` are marked as facets too, and nobody wants to filter on
them. Every dataset therefore needs a small profile in the config tree the
backend already has per dataset:

- which fields are filters, and in which order
- the label, in Norwegian
- clean-up — `concerned_years` from 1990 to the current year, hide fields that
  are empty
- sorting — years descending, organisations by count

**The agent, as the one who proposes.** An agent can write the profile for a
new corpus: read the schema, see that `orgs_long` has 457 organisation names,
that `concerned_years` has outliers and that `orgs_short` is empty, and propose
the profile. A human approves it, and it is stored as configuration. Close to
plug and play, with no generated code in production.

**Several corpora at once** follows by itself: every dataset has its profile,
and the corpus picker in the frontend already exists.

## The filter itself is already in the right place

A chosen filter is sent to the backend as
`overrides.retrieve-filter-by = { fields: [{ field, selected-options }] }` —
the backend's own internal format, which the auto-filter and the agent's search
tool also use. It is generic and independent of the corpus.

It did not work before 2026-09-24, for five reasons in headless-rag, fixed on
the branch `fix/mcp-retrieve-filter-by` (no PR yet):

1. `retrieve-filter-by` was missing from the allow-list of per-call settings.
2. The MCP transport did not turn the keys into keywords, so **no** per-call
   setting has worked through MCP — measured: `retrieve-top-k 7` gave 100.
3. The agent's search let the model's filter, usually empty, replace the
   reader's. Now both apply, and the fallback drops only the model's part.
4. `value-type` arrived as text and was compared with a keyword, so a year
   filter was quoted as a string and Typesense rejected it — silently, 0 hits.
5. A filter value could become filter syntax. Measured: a year filter over
   1 883 documents became 4 706 when the «year» was `2024] || type:=[…`. Unsafe
   values are now dropped. It became reachable with 1–3: before, a filter the
   caller chose never reached the search. Found in review.

A sixth, found 2026-09-25, concerns the facets directly. The backend **does**
already have a facet function, `fetch-facets`, which the agent's
`inspect_filters` uses. It crashed every time, because a local binding shadowed
the function it called, and the formatter read `:name` instead of `:value`. The
agent answered «one document» when asked how many documents Kudos has. After the
fix: «over 10 000». The function is a natural starting point for the mechanism
in D.

**digdir/digdir-headless-rag#15 does the same, more strictly.** The PR («Make
tools/call filtering work end to end», opened 2026-09-25) fixes 1–5. It differs from our branch on three points:

- `overrides` accepts only three keys. Our no. 2 makes every per-call setting
  live, `model` and `max-tokens` included.
- An invalid filter is rejected with an error instead of being dropped.
- Field names are validated too.

It also has two things we can use. `retrieve-auto-filter: false` turns off the
auto-filter, which today takes years from the agent's rewritten search. And
`filters_applied` in `structuredContent` says which filters were actually used.

Our client sends the filter in a form it accepts, years included, as text with
`value-type integer`. It does not have no. 6. Proposal: use digdir/digdir-headless-rag#15 for 1–5, and
send no. 6 and the seed script as a separate PR on top.

Measured afterwards against the whole Kudos corpus: an impossible filter gives
0 hits, DFØ + Årsrapport gives only DFØ's annual report for 2024 — where
Statens vegvesen used to come up — and Årsrapport + 2024 gives only annual
reports from 2024.

## Consequences

- The profile is one more thing to maintain per dataset. But it is data, not
  code, and without it the logic is copied into every frontend instead.
- The mechanism has to be built in headless-rag. It is an addition, not a
  rewrite, but it is the maintainers' code and their decision.
- Until it exists, somebody has to deliver the facets in the meantime. See
  «Next steps».

## Next steps

1. Check with the monorepo's owners whether filtering has been solved another
   way, and with the headless-rag maintainers about D and the six fixes above.
2. Meanwhile: let the live client send the chosen filter. That part is right
   wherever the facets end up, because the format is the backend's own.
3. A temporary bridge for the facets: our thin server delivers them in the
   generic format above, from Typesense. When the backend gets the mechanism,
   the source behind the same contract changes, and the frontend does not.
