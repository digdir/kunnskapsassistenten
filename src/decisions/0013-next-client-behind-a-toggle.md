# 0013 — The next client beside the current one, behind a toggle

**Status:** accepted · **Date:** 2026-11-12

## Context

Kunnskapsassistenten's next client is built from genki's UI blocks: `<Assistant>` from
`@genai/ui-assembly`, with the template `knowledge-assistant-next`. It should be tried by
colleagues on the test site, with their own sign-in and their own threads, while `apps/web`
stays as it is and remains the default.

A separate host was considered first: its own container app and Ansattporten client next to qa.
genki confines a browser token to the one service its client id is registered for, so a
separate genki service would have needed its own client, redirect URI and server process. Kept to
the service `apps/web` already uses, `kunnskapsassistenten`, the person's token reaches it, and the
next client can live in the same app.

## Decision

**One app, two clients, and a toggle, as Outlook does it.** The same container app, host,
session, sign-in and genki service serve both. A cookie chooses the page:

- `POST /api/next/ui` with `{ "ui": "next" }` sets `ka_ui=next` (`__Host-ka_ui` on https),
  `HttpOnly`, `SameSite=Lax`, for a year; `{ "ui": "classic" }` clears it. The page then
  reloads, and the server sends the chosen client's `index.html`. Without the cookie a browser
  gets `apps/web`.
- `apps/web` shows «Prøv ny versjon» at the foot of the navigation panel when
  `GET /api/next/ui` says the next client is offered. The next client has
  «Tilbake til gammel versjon» in its profile menu.
- A thread link opens in the chosen client: `/threads/:id` (and the older `/chat/:id`) goes to
  `/?t=:id` for the next client, and `/?t=:id` to `/threads/:id` for `apps/web`.
- The two builds keep their files apart, `/assets/*` and `/next-assets/*`, so only the page
  depends on the cookie. The page is sent with `Vary: Cookie`.

**`KA_NEXT=1` switches it on.** Without it, `/api/next/*` is not mounted, the cookie is ignored,
and «Prøv ny versjon» is not drawn. Turning it off sends everyone back to `apps/web` with no
rebuild. `WEB_NEXT_ROOT` names the build; the image sets it.

**The next client lives in `apps/web-next` and imports nothing from `apps/web`.** genki's four
frontend packages (`@genai/client`, `@genai/i18n`, `@genai/ui-blocks`, `@genai/ui-assembly`)
are a source snapshot in `apps/web-next/vendor/genki`, pinned to the genki commit in
`GENKI_COMMIT`, refreshed only by `scripts/sync-genki.sh`, and resolved with Vite aliases and
tsconfig `paths`. CI takes the snapshot again from digdir/genki and fails on any difference.
Browser storage keys start with `ka-next.`.

**The server adds one API, `/api/next`, in `nextApi.ts`,** under `/api/*`, so the session, the
sign-in check and the 64 kB body limit come first:

- `GET /me`: the person's name and organisation, the sign-out, the genki model and tenant, and
  whether they may rename and delete. `KA_NEXT_MODEL` (default `kunnskapsassistenten__default`)
  and `KA_NEXT_TENANT` (default `digdir`) choose the variant and tenant without a rebuild, so a
  variant that cites excerpts can be switched on later.
- `/genki/*`: a proxy to exactly the calls `createGenkiApi` makes, with the caller's credential
  as every call of `apps/web` (`backendHeaders`). Queries are reduced to the parameters the call
  takes and the tenant is the server's; a new thread and a question are rebuilt from the fields
  they may carry, for this service only. Everything else is 403 and never forwarded, feedback
  included. Rename and delete pass only with a person's token, never with the service key.
  Answers stream through as they come, and «Stopp» ends the call to genki.
- A call genki refuses or fails reaches the page as a fixed sentence with genki's status and
  code, never genki's own text, as in decision 0009; only the status is logged. An answer that
  fails after it has begun to stream still carries genki's own error in the stream, as genki's
  own clients get it. A redirect from genki is never followed: it is a 502. Proxied responses
  are `no-store`, and their body type is JSON or an event stream, whatever genki says.
- Writes are checked for `Sec-Fetch-Site: same-origin` when sent, and this site's `Origin` when
  sent: Hono's `csrf()` checks only form posts. A write with a body also needs a JSON body type;
  a delete carries no body, so it needs none.

## Consequences

- One rollout serves both clients, and every rollout signs everyone out, as before.
- Threads are the same in both clients: genki keeps them for the service, and both read them
  from it. Feedback is not offered in the next client until genki's assembly carries the run id
  of an answer.
- The next client's profile menu is genki's, and takes no host entries today, so
  «Tilbake til gammel versjon» is put into it from `apps/web-next` through a portal. When genki's
  menu takes host entries, it becomes one entry in the profile and the portal goes.
- Removing the next client is removing `apps/web-next`, `nextApi.ts`, `nextPage.ts`, their tests,
  the mount in `app.ts`, `apps/web/src/nextVersion` and its line in `SidebarFooter.tsx`.
  Removing `apps/web` later is the reverse, and then the next client becomes `WEB_ROOT`.
