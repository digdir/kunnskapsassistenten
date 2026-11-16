# 0019: The previous client removed, and the next client the only one

**Status:** accepted · **Date:** 2026-11-16 · **Supersedes:** the toggle in
[0013](0013-next-client-behind-a-toggle.md), [0016](0016-excerpt-trial-asks-for-its-own-environment.md),
`KA_NEXT_ONLY` in [0017](0017-next-client-draws-a-layout-from-config.md),
[0018](0018-next-client-by-default.md), and `/api/v2` in [0009](0009-api-version-in-the-path.md)

## Context

The next client, `apps/web-next`, was the default on the test site (`decisions/0018`), with
`apps/web` reachable through «Tilbake til gammel versjon», and `apps/web`'s pages «Endringslogg»
and «Om prosjektet» served from `apps/web` whichever client was chosen (`decisions/0013`). A person
in the next client who opened «Endringslogg» from its profile menu was in `apps/web`. On
2026-11-16 the product owner decided to remove `apps/web` entirely, so that the next client is the
only one and nothing leads a person out of it.

## Decision

**`apps/web` goes, and everything only it used.** Its code, tests, end-to-end suite, design tokens,
its own server and Dockerfile, its CI jobs, its build in the image, and the server code that
answered only it: `/api/v2/*` (`apiV2.ts`, `apiShared.ts`, `apiAsk.ts`), the MCP client
(`mcp.ts`), Typesense (`facets.ts`, `excerpts.ts`), the capability probe, the dataset settings,
the sources and filters kept per thread, the models list and the excerpt trial. `packages/contract`
goes too: the types the server still needs are in `apps/server/src/types.ts`.

**The switch goes.** `GET` and `POST /api/next/ui`, the `ka_ui` cookie, «Tilbake til gammel
versjon», `KA_NEXT`, `KA_NEXT_DEFAULT` and `KA_NEXT_ONLY`. The server serves `apps/web-next` from
`WEB_NEXT_ROOT` at every page address, and `/api/next/*` is always mounted. A browser that still
has `ka_ui=classic` gets the next client.

**Old settings are ignored, not refused.** A deployment that still sets one of the retired settings
(`KA_NEXT`, `KA_NEXT_DEFAULT`, `KA_NEXT_ONLY`, `WEB_ROOT`, `KA_EXCERPT_ENVIRONMENT`,
`KA_CAPABILITIES`, `KA_FILTER_FIELDS`, `KA_DATASETS`, `KUDOS_BASE`, the Typesense settings, and
`DIGDIR_TOOL`, `DIGDIR_AGENT_ID`, `DIGDIR_TENANT` and `DIGDIR_DATASET_CONFIG_KEY`) starts as before,
and the log names them, by name only, as safe to remove. `WEB_NEXT_ROOT` without an `index.html`
now stops the server, since there would be no page to serve while the probe still answered.

**Old addresses keep working.** `/threads/:id` and `/chat/:id` redirect to `/?t=:id`, for
bookmarks and shared links. `/api/health` stays for the readiness probe (`decisions/0012`). Every
other `/api/v2/*` address is a 404, and so is a file under `/assets/*`.

**«Endringslogg» and «Om prosjektet» are the next client's own pages,** at the same addresses,
`/endringslogg` and `/om-prosjektet`, with the same text, drawn with Designsystemet on a card as
the assistant's. The page reads the address: the assistant at `/` and `/innstillinger`, these two
pages, and «Siden finnes ikke» at any other, `apps/web`'s «Onboarding» included. The profile menu
opens them with the assistant's address in `?fra=`, and their way back returns to that thread.
They are KA's pages, so the menu has them only for KA's service: another service drawn from a
layout (`decisions/0017`) gets genki's entries only, as `KA_NEXT_ONLY` gave it before.

**What `apps/web` kept in the browser is forgotten.** On its first load the next client removes
`apps/web`'s keys by name, among them the sources of its answers, which its «Logg ut» cleared and
nothing would clear now. Its colour scheme becomes the next client's, until one is chosen there.

**Names stay.** `apps/web-next`, `/api/next/*`, `/next-assets/*`, `WEB_NEXT_ROOT` and the
`KA_NEXT_MODEL`, `KA_NEXT_TENANT` and `KA_NEXT_LAYOUT` settings keep their names, so a deployment
keeps working with no change to its settings. Renaming them is a change of its own.

**The documentation moves.** `apps/web/docs` is `src/docs`: the reports and the decision log in
`src/docs/rapporter`, and `apps/web`'s own documentation, as it was, in `src/docs/previous-client`.
The theme stays reproducible: `apps/web`'s Designsystemet config is in `apps/web-next`, and
`npm run tokens:verify --workspace apps/web-next` checks `src/theme.css` against it.

## Consequences

- A rollout of the image changes nothing in the app's settings or secrets. The retired ones can be
  removed from the app afterwards, at any time; `deploy/README.md` lists them.
- The template no longer takes the parameters for the retired settings, nor `typesenseApiKey`, so
  a deployment that passes one of them fails until it is left out.
- Testers find their id in `userId` in `/api/next/me` (`decisions/0015`), which `/api/v2/me` gave.
- There is no end-to-end suite left: it was `apps/web`'s. The server's tests and the client's unit
  tests remain, and the image job in CI asks the image for the page, the old addresses and the
  API.
- `apps/web` is still in the history, and can be built from the commit before this change.
