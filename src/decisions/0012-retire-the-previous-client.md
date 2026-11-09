# 0012 — The previous client retired, and `/api/*` with it

**Status:** accepted · **Date:** 2026-11-06 · **Supersedes:** the two
clients and `/api/*` in [0009](0009-api-version-in-the-path.md)

## Context

[0009](0009-api-version-in-the-path.md) put two clients behind the BFF so they
could be compared: `apps/web-preact` (`gammel`), the client on main at
`8639267`, and `apps/web` (`ny`). The cookie `ka_klient` chose the page, with
`KA_DEFAULT_CLIENT` as the default and `?klient=` to switch one browser. Each
client asked for its own version of the API: `/api/*` in main's format and
`/api/v2/*`.

On 2026-11-06 it was decided to retire `apps/web-preact`. `apps/web` is the
client.

## Decision

**`apps/web-preact` goes, and the switch with it.** `clientSwitch.ts`, the
cookie, `?klient=`, `KA_DEFAULT_CLIENT`, `WEB_ROOT_PREACT`, the
`kaDefaultClient` parameter in `deploy/main.bicep`, the client's build in the
image and the root scripts, and the link «Bytt til forrige klient» on the
settings page. The BFF serves one build, from `WEB_ROOT`.

**`/api/*` goes, as 0009 said it would:** `apiV1.ts`, its mount in `app.ts`,
`apiV1.test.ts` and `TurnEventV1` in the contract. Nothing else calls it.
`apps/web` calls `/api/v2/*`, the server in `apps/web/server` calls genki
directly, and the only other caller in the repository is in the archived
evals, which are not run.

**Except `/api/health`.** The readiness probe in `deploy/main.bicep`, the
image's `HEALTHCHECK`, the `image` job in CI and the README ask
`/api/health`. The probe belongs to the running Container App, and the usual
rollout (`az containerapp update --image`) leaves it as it is. A new image
without `/api/health` would never be ready, and the old revision would go on
serving. So it stays: one route in `app.ts`, open without sign-in as before,
beside `/api/v2/health`.

**`/api/v2` stays where it is.** Moving it back to `/api` would change
`apps/web` and the probe too. 0009 left that choice for the day the previous
client went, and nothing needs it yet.

## Consequences

- A browser with `ka_klient=gammel`, or a link with `?klient=gammel`, gets
  `apps/web`. Nothing reads the cookie any more, and it runs out on its own.
- A `KA_DEFAULT_CLIENT` left on the running app is ignored. Deploying the
  template with `kaDefaultClient` fails, because the parameter is gone.
- `apiShared.ts` and the `present` argument to `askRoute` stay as they are.
  With one version they could be folded into `apiV2.ts`. That is left for a
  change that needs it.
- The lockfile loses what only `apps/web-preact` used: Preact and its Vite
  preset, `marked`, DOMPurify, `@digdir/designsystemet-web` 1.21.1, Vite 7,
  jsdom 30 and their dependencies.
- The previous client is still in the history. It can be built from the
  commit before this change, should a comparison be needed again.
