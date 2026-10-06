# 0005 — Our client as `apps/web`, behind the BFF in this repository

**Status:** direction chosen by Lars; the details below are proposed and not
agreed with the owners of this repository · **Date:** 2026-09-28 ·
**Corrected:** 2026-10-05

Numbered 0005 here. It was 0002 in Norwegian in the client's own repository
(`larsekhansen/kunnskapsassistenten-frontend`, `docs/arkitektur/`).

Corrected 2026-10-05 on three points, after the move was tried for real: the
order, `git subtree`, and the claim that the backend stores the chunks. Each
correction stands where the claim stood. The current picture for the move is
`design/plan-monorepo-2026-09-29.md`.

## Decision

> «Vi sikter på å overta /web i digdir/kunnskapsassistenten/src/apps. …
> Jeg antar /server er backend for frontend. Men det må funke bra.»
>
> «Vi kan vel se for oss en merge hvor vi beholder det beste fra mitt og
> hans.» (Lars, 2026-09-28)

In English: we aim to take over `/web` in `digdir/kunnskapsassistenten/src/apps`;
`/server` is assumed to be the backend-for-frontend, but it has to work well; and
the merge should keep the best of both.

`digdir/kunnskapsassistenten/src` has three parts:

- `apps/web`: a Preact SPA on `@digdir/designsystemet-web`.
- `apps/server`: a Hono server, that is, the BFF.
- `packages/contract`: the types between the two.

The app is deployed at <https://qa.kunnskap.digdir.cloud> with Entra ID. Our
client is to replace `apps/web`, and the BFF stays.

## Why the BFF stays

The backend authenticates applications, not people. It accepts `X-User-Id`
without checking it, and it answers with no CORS headers. Something on the
server side therefore has to hold the key and _be_ the identity.
[ADR 0002](0002-backend-for-frontend.md) explains it.

The BFF does all of this, and a security review has been through it:

- sign-in with Entra ID, with the identity derived from the session
- CSP, HSTS, a ban on framing, and CSRF
- `__Host-` cookies, an ownership check before a thread is continued, and a cap
  on the request body

Our thin server lets the browser decide `X-User-Id`, and it passes everything
under `/api/` through with the key attached. That is right for a test
environment in mock, but not for anything open to the world with real answers.

## Measured 2026-09-28

The BFF in this repository (`origin/main` `8639267`) ran locally with
`AUTH_MODE=off` against our backend: headless-rag on the branch
`fix/mcp-retrieve-filter-by`, tenant `kudos`, dataset `kudos-full`.

|                                          | result                                                                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run doctor`                         | 13 agents, the conversation API scoped by `X-User-Id`, Typesense with 10 064 documents                                            |
| `/api/capabilities`                      | `filters: true`. The probe sends an impossible filter and got 0 hits. In the deployed environment the filters are off.            |
| `/api/facets`                            | 8 document types, 200 organisations, 22 years                                                                                     |
| `/api/models`                            | 13 agents gathered into 8 choices, with modes under them                                                                          |
| `/api/ask` with `type = Årsrapport`      | 18 s, one source (DFØ's annual report 2024) with an excerpt of 9 372 characters                                                   |
| the answer text from `/api/ask`          | **only the agent's plan, 393 characters. The answer itself never arrived.**                                                       |
| the same question directly to `/api/mcp` | `response/chunk` had 527 characters of plan («Jeg vil finne …»), and the last frame had the answer, 539 characters                |
| identity                                 | without a cookie, every request became a new anonymous user. The identity lives in the session, not in a header the browser sets. |

The answer goes missing because the BFF shows `response/chunk` as answer text
and skips the last frame when something has already been streamed. Against this
backend, every such delta is the agent's plan, followed by an `agent/thinking`
with the same words. The answer comes whole in the last frame. Our client
measured this before, on 11.09, and holds the deltas back until it is clear
whether they are plan or answer (`McpStreamState` in
`apps/web/src/api/live/mcp.ts`).

## The best of both

| Part                                    | In this repository today                                                         | The client moving in                                                                                                                  | Kept                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The client                              | Preact and DS-web: 1 353 lines of TypeScript without tests, and 816 lines of CSS | React and DS-react, the Figma design, panels that can be dragged, accessibility work, 984 unit and 151 e2e tests                      | **the new one**. [ADR 0001](0001-frontend-technology.md) calls it the product track.                         |
| Server, sign-in and security            | Hono, Entra and all of the above                                                 | a thin proxy                                                                                                                          | **this repository's**                                                                                        |
| Reading the MCP stream                  | shows the plan and loses the answer (measured)                                   | plan and answer kept apart (measured)                                                                                                 | **our logic, moved into the BFF**                                                                            |
| The contract between browser and server | `TurnEvent`: conversation, stage, delta, sources, done and error                 | richer: thinking steps, hits, sources per answer                                                                                      | **this repository's as the base**, extended with what the new client shows                                   |
| Sources when a thread is opened again   | in the BFF's memory, the last answer only, gone on restart                       | the references in the browser, and the text is looked up (0008, live only). The backend does not store them, see the correction below | **our way**, but through the BFF                                                                             |
| Facets and filter                       | facets from Typesense, a probe, the filter locked per thread                     | the filter choice is sent, fields per dataset as configuration                                                                        | **this repository's** facets, probe and lock. The fields become configuration per dataset in time (0004, D). |
| Agent picker                            | API and UI                                                                       | none                                                                                                                                  | **this repository's API, the new client's UI**                                                               |
| Renaming and deleting threads           | API and UI                                                                       | search only                                                                                                                           | **this repository's API, the new client's UI**                                                               |
| Corpus picker                           | one dataset from the environment                                                 | several                                                                                                                               | **ours**. The BFF has to be able to choose between the datasets the key is allowed.                          |
| Mock without a backend                  | none                                                                             | a full demo with fixtures                                                                                                             | **ours**, for CI and demos                                                                                   |
| Filter fixes in headless-rag            | digdir/digdir-headless-rag#15, stricter validation                               | the branch, six fixes                                                                                                                 | **digdir/digdir-headless-rag#15** for 1–5, and **our** no. 6 (`fetch-facets`) on top. See 0004.              |
| Deployment                              | `ka-app`, by hand with `az`                                                      | a template and deployment from GitHub (larsekhansen/kunnskapsassistenten-frontend#166)                                                | **this repository's environment**. The deployment from GitHub can be brought along.                          |

## What has to change

**In the BFF** (code in this repository):

1. Keep the plan apart from the answer in the stream, as our client does.
2. Send the sources per message when a thread is opened again. **Corrected
   2026-10-05:** this said «The backend has them», and that is not true.
   `tools/call` stores only the answer text, and `transact-used-data` is never
   called, so `GET /api/conversations/:id` gives `chunks: []` on every message.
   Measured 29.09, reported as digdir/digdir-headless-rag#21. Until that is
   fixed, the sources have to come from somewhere else; 0008 does it in live
   mode by looking the text up in Typesense and keeping the references in the
   browser.
3. Carry thinking steps and hits in the contract.
4. Let the client choose a dataset among those the key is allowed.

**In our client**:

- A `ChatClient` against `/api/ask`, `/api/conversations`, `/api/facets`,
  `/api/capabilities`, `/api/models` and `/api/me`, beside mock.
- A 401 leads to sign-in. User name and «Logg ut».
- UI for the agent picker, renaming and deleting, the filter lock, a feedback
  link, and a warning when the answer has no sources.
- The script inside `index.html`, which sets the colour scheme before the first
  paint, becomes a file of its own. The BFF's CSP (`script-src 'self'`) stops
  such a script.
- `/config.js` does not exist behind the BFF. What the client needs to know
  about the environment has to come from `/api/me` and `/api/capabilities`.

## When it «works well»

- The e2e suite is green against the BFF, not only against mock.
- The same question gives the same answer and sources through the BFF as
  directly against the backend.
- Sign-in works at the deployed address, and the stream arrives without
  buffering.
- No accessibility regression: keyboard, focus and screen reader for text that
  streams in.
- It has stood side by side with the web component client before it takes over
  the address.

## Order

**Replaced 2026-10-05** by the table «Rekkefølge» in
`design/plan-monorepo-2026-09-29.md`, which was written after the move was tried
for real. Two things were turned around:

- **The BFF changes come after the move, not before.** Each of them touches
  `apps/server`, `packages/contract` and `apps/web` at once, and that is easiest
  when all three are in the same repository.
- **Headless-rag is no longer a step of its own.** It goes through issues, not
  PRs from us.

The order that applied when this was written, for the record:

1. Headless-rag: take digdir/digdir-headless-rag#15 instead of fixes 1–5 on our
   side, and send no. 6 and the seed script as a separate PR.
2. A `ChatClient` against the BFF in our repository, tried against it locally.
3. The changes in the BFF, as PRs to this repository.
4. Move the client in as `src/apps/web`, with its history (`git subtree`), CI
   and e2e.
5. Deployment in `ka-app`, and then take over the address.

## Consequences

- The web component track ([ADR 0001](0001-frontend-technology.md)) does not
  become the product. The outcome belongs to that ADR and is written down there.
  It has to be agreed first.
- Our thin server goes when the client has moved. Until then it is the test
  environment in mock.
- CI becomes a monorepo CI, with workspaces and e2e in a subfolder.

## Corrected 2026-10-05: `git subtree` does not keep the file history

Item 4 in the old order above says «with its history (`git subtree`)». The
trial move on 29.09 (`design/_briefs/bygg/maalt-monorepo-proeve-2026-09-29.md`)
measured that this is not true in the way it was meant:

| Method                  | Commits | `git log` on one file under `src/apps/web/` | `--follow` | SHAs       |
| ----------------------- | ------- | ------------------------------------------- | ---------- | ---------- |
| `git subtree add`       | 734     | **1**, only the merge commit                | **0**      | kept       |
| `filter-repo` and merge | 734     | 5, as in our repository                     | works      | become new |

Both bring the commits along. The difference is whether the history of a
single file can be followed afterwards, and it is `subtree` that cannot.

**Lars chose a third way on 2026-10-05: one copy, without history** (D1 in the
plan). The source and the SHA are in the commit message and in the README in
`apps/web`, so whoever looks finds the way to the archived repository. Then
neither of the two rows above is what happens — they stay because they are
what the choice was made on, and because `subtree`, which this ADR originally
pointed to, does not do what the ADR said it did.

## Corrected 2026-10-05: 0008 solves the sources in live only

0008 («The excerpt text, and the sources after a reload») applies to **live
mode alone**, as it says itself under «Consequences». Behind the BFF the problem
is the same, and the same store could be used, but it has not been done. So
the move here does not bring 0008 along: when the client stands behind the BFF,
the sources after a reload are still the BFF's business, and today they live in
the BFF's memory, for the last answer only, and are gone on restart.
