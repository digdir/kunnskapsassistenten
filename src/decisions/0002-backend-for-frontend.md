# 0002 — A backend-for-frontend is mandatory

**Status:** accepted · **Date:** 2026-09-11

## Context

A backend-for-frontend is mandatory, because **the backend has no concept of an
end user**. It authenticates applications via API key, not people. Three
consequences, in order of severity:

1. **`X-User-Id` is unverified.** `require-external-api-user-id!`
   (`api/util.clj:20-25`) trims the header and rejects blank — that is the
   entire check — and `require-api-conversation-owner!` (`api/util.clj:27`) then compares that string to
   the stored owner. Whoever sets the header _is_ that user. From a browser,
   changing one string in devtools reads anyone's conversations. Something
   server-side must therefore _be_ the identity.
2. **The API key is a broad, long-lived bearer credential**, scoped to datasets
   and agents rather than to a person, with an optional expiry that defaults to
   none (`config/api_keys.clj:830`). In a browser it is in devtools, in the
   Network tab, and in any XSS payload.
3. **No CORS.** There is no `Access-Control-Allow-*` anywhere in the backend
   source, so a direct browser call fails at preflight. Treat this as a symptom,
   not the reason — adding CORS would not fix 1 or 2.

The need disappears only when the backend speaks OIDC/Ansattporten per user and
issues short-lived tokens carrying identity. That is an explicit v0.1 non-goal
(`considered-divergences.md`), and the same gap the genKI deck lists as
"Hjemmesnekra pålogging → Ansattporten".

`digdir-headless-rag/server/docs/api/examples/browser-proxy/proxy.mjs`
is a ~200-line reference BFF that already does the hard parts: holds the key,
pins the tool server-side, and streams without buffering. Buying this as an API
gateway doing OIDC plus key injection is the same component under another name;
skipping it is not an option.

```
┌───────────┐   POST /api/chat (SSE)   ┌──────────┐   POST /api/mcp (SSE)   ┌──────────────┐
│  browser  │ ───────────────────────► │   BFF    │ ──────────────────────► │ headless-rag │
│  Preact   │ ◄─── text/event-stream ─ │ holds key│ ◄─── notifications/ ─── │              │
└───────────┘                          └──────────┘      progress           └──────────────┘
```

The BFF owns the user session and maps it to the `X-User-Id` header that scopes
conversations. The browser must never choose its own `X-User-Id` — that header
is the only thing separating one user's conversations from another's.

## Decision

Two deployable artifacts, not one framework. `apps/server` holds the API key,
owns the session, and is the only thing that talks to `digdir-headless-rag`.
`apps/web` has no code path that reads a secret.

A framework that blurs which code runs where is a poor fit at exactly the
boundary where that distinction matters most, and the four things that keep SSE
incremental — `flushHeaders`, `socket.setNoDelay(true)`, `X-Accel-Buffering: no`
and no compression middleware on the stream route — need explicit control of the
response pipeline.

## Consequences

The BFF is a second thing to deploy and a second place for bugs. It is also the
only place a real login can be added later: replacing the dev session in
`apps/server/src/session.ts` with Ansattporten changes one file, because
`X-User-Id` is derived in exactly one place.

This decision expires the day the backend speaks OIDC per user and issues
short-lived tokens carrying identity.
