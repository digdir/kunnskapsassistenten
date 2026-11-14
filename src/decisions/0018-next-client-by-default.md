# 0018: The next client by default, by a setting, on the way to the only one

**Status:** accepted · **Date:** 2026-11-14

## Context

The next client sits beside `apps/web` behind a toggle (`decisions/0013`): a browser gets
`apps/web` unless it chose the next client, and «Tilbake til gammel versjon» cleared that choice.
The product owner wants `apps/web` phased out slowly, with the next client shown to everyone by
default for now, and `apps/web` still reachable through «Tilbake til gammel versjon».

## Decision

**`KA_NEXT_DEFAULT=1` makes the next client the default.** A browser that has not chosen gets
the next client, its thread links included; a browser that chose either client keeps its
choice. It needs `KA_NEXT`, and is warned about and ignored without it, as `KA_NEXT_ONLY` is.
Without the next client's build it is not offered, and every browser gets `apps/web`, as one
with a `next` cookie does. An environment variable switches it on and off without a rebuild, as
the other settings do.

- **The choice is kept both ways.** `POST /api/next/ui` sets the cookie to `next` or `classic`,
  with the same attributes, instead of clearing it for `classic`. The page reads `classic` as
  `apps/web`, `next` as the next client, and no cookie, or one that names neither, as the
  default. `KA_NEXT_ONLY` still wins over any cookie.
- `GET /api/next/ui` says which client the browser gets, the default included, so `apps/web`'s
  info pages offer «Tilbake til ny versjon» to a browser that has it by default. `/api/next/me`
  is unchanged: the way back to `apps/web` stays.

## Consequences

- Unset, nothing changes for any browser: no cookie is `apps/web`, and a `next` cookie is the
  next client. A «Tilbake til gammel versjon» from before this decision cleared the cookie, so
  that browser has no choice, and gets the next client once the default is on.
- The phase-out goes default, then only: `KA_NEXT_DEFAULT` while `apps/web` stays reachable,
  then `KA_NEXT_ONLY` (`decisions/0017`), which leaves `apps/web` out and the way back with it.
