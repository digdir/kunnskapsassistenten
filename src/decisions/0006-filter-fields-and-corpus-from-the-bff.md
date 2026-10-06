# 0006 — Filter fields and the corpus name from the BFF

**Status:** accepted · **Date:** 2026-09-29

Numbered 0006 here. It was 0003 in Norwegian in the client's own repository
(`larsekhansen/kunnskapsassistenten-frontend`, `docs/arkitektur/`).

## Context

The filter panel needs to know three things about the corpus. It has to know
which Typesense field each dimension is, that is, that document types are
`type` and years are `concerned_years`. It has to know the value type, that is,
that a year is an `integer`. And it has to know what the corpus is called. In
live and mock the client reads this from `VITE_KA_FILTER_FIELDS` and
`VITE_KA_DATASETS`, either baked into the build or from `/config.js` from our
thin server (`apps/web/src/api/runtimeConfig.ts`).

Behind the BFF in this repository there is no `/config.js`. The pod — this
repository with our client in `src/apps/web` — therefore got a dead filter
panel. It said «Filtrering er ikke tilgjengelig», although `/api/facets`
answered with data (measured 29.09). This is D16 in
`design/plan-monorepo-2026-09-29.md`.

The BFF also had the fields in its code (`FIELDS` in
`apps/server/src/facets.ts`). So it worked only against Kudos, and the client
had to be built with the same list.

This was measured against the whole of Kudos on 29.09, with the same count
made directly in Typesense:

- The BFF gave 200 of 457 organisations and 22 of 46 years. The reasons were
  `max_facet_values` 200 and a cap of 300.
- A year without `value-type: integer` gave 0 chunks. With it, it gave 4.
- More than 100 chosen values in one field were cut to 100 without a word.

## Decision

The BFF owns the configuration of its own dataset, and the client fetches it
from there. The BFF reads `KA_FILTER_FIELDS` and `KA_DATASETS`, with the same
grammar as the client's variables. `/api/facets` gives `id`, `field`,
`valueType`, `label` and every value with its count for each field.
`/api/capabilities` gives `dataset`, which is the key, the name and the
description. In bff mode the client uses this instead of the build's
configuration. Live and mock are as before.

The reason is that the BFF is already the one that decides which dataset is
asked (`DIGDIR_DATASET_CONFIG_KEY`), and the one that counts the facets. Then
the field names and the name of that same dataset belong in the same place. If
the client said it itself, it would repeat something it cannot know, and be
wrong the moment somebody changed the dataset in the BFF and did not rebuild
the client.

## Consequences

- One image of the client works against any dataset the BFF is set up for. A
  new corpus is a change to the BFF's configuration, not a new build.
- The corpus name arrives after the first paint. The corpus store
  (`apps/web/src/api/corpus.ts`) takes it in with `adoptServerCorpus`, and
  `useActiveCorpus` draws again. Until the answer comes, the panel shows the
  build's name or the key.
- The thread's filter (`ThreadDetail.filter`) is translated from the BFF's
  field names to dimensions with the same fields. A field the client does not
  know is not shown.
- Against a BFF without `id` on the facets, like the one on `8639267`, the
  client still uses the build's `VITE_KA_FILTER_FIELDS`.
- The cap of 100 values is enforced in two places, each of which holds on its
  own. The client does not send a field where every value is chosen, and says
  so in the panel above 100. The BFF also drops a field where every known value
  is chosen, and it answers 400 with `filter-too-many-values` or
  `filter-invalid-value` instead of cutting. The client shows that with the code
  `filter-refused`: a text of its own about what has to change in the filter,
  and no «Prøv igjen», which would only send the same filter once more.
- The probe in the BFF retries for about nine minutes before it decides. The
  panel asks first with short pauses, and then every 15 seconds for as long as
  the BFF answers that the probe has not finished. While it waits, it says
  «Henter filtre». A BFF that does not answer gives an error with «Prøv igjen»
  instead.

## What would change the decision

- **headless-rag makes the filter metadata available.** `inspect_filters`
  already builds `available-fields` with `value-type` and `facet-options` with
  counts. If whoever calls the API could get this, the BFF could stop having the
  fields in its configuration and just pass on what the backend says, for each
  corpus. A draft issue is in `design/_briefs/bygg/`.
- **The BFF is to be able to choose between several datasets** (0005, change 4). Then
  `dataset` has to become a list, and the fields have to come per dataset.
