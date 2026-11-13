# Kunnskapsassistenten, the application

**The frontend of Kunnskapsassistenten, built on `digdir-headless-rag`.**

Same product, same user experience, new technology and a different backend. It
is meant to run alongside the "old"
[Kunnskapsassistenten](https://test.kunnskap.digdir.cloud) and be compared with
it. The whole point is the swap: keep the frontend constant, swap the engine
underneath, and find out what the new backend can actually do.

**The port is complete.** The client is rewritten from scratch in React, talks
to `digdir-headless-rag` over the public API, and gives answers with sources
against the Kudos corpus: threads, streamed answers with status labels, a source
panel with excerpts, filters and sign-in. Along the way it turned up eleven
documented gaps in the backend's public contract, and something for the
evaluations to run against.

## Deployed

<https://qa.kunnskap.digdir.cloud>

Sign in with Entra ID. Accounts that exist in the tenant are let in.

Two things are not in place in the deployed environment, and both are in the
backend, not here:

- **Answers.** `test.rag.digdir.cloud` only offers `fact-checker` and
  `retrieve-only`, and rejects the agentic RAG modes with `mode_not_allowed`.
  The app is wired up and ready; the day the agent is switched on there, it
  answers.
- **Filters.** The deployed backend does not accept the filter from the client,
  so the chips are shown disabled with an explanation. They switch on by
  themselves when the backend starts accepting them, without a new deployment.

Against a local backend with the proposed changes, both work, and that is where
the comparison with the current Kunnskapsassistenten is made.

```
apps/web           Vite + React + Designsystemet (-css / -react). No secrets.
apps/server        Hono. Holds the API key. The only thing that talks to the backend.
packages/contract  The types that pass between the two.
```

```
React SPA  ──► apps/server ──► digdir-headless-rag
               (the BFF)       /api/mcp     conversation + streaming
                               /v1/models   lookup
                          ──► Typesense     facets, excerpts from sources
                                            (neither is in the API)
```

The browser never gets the API key. That is a requirement from the backend, not
a preference: it authenticates applications and not people, and `X-User-Id` is
accepted without verification. So something on the server side has to _be_ the
identity. See [`decisions/0002`](decisions/0002-backend-for-frontend.md).

## Getting started

From a fresh clone to the app on your machine, with the tests. Each block is run
on its own, and every command after `cd` is run in `src/`. Measured 06.10 on
macOS with Node 24.21.0 and npm 11.19.0.

Only the client against genki-test, step by step and also for those who are not
developers: [Run locally](apps/web/docs/run-locally.md). In short,
`npm run web`, with `apps/web/.env.local` made from `.env.example`.

### 1. The clone and Node 24

`mise.toml` pins the Node version. With [mise](https://mise.jdx.dev) activated
in the shell:

```sh
git clone https://github.com/digdir/kunnskapsassistenten.git
cd kunnskapsassistenten/src
mise trust
mise install
node --version
```

The last one should print `v24.21.0`. If you already have Node 24.15 or newer,
that is enough: `engines` requires `>=24.15`, and `.npmrc` has
`engine-strict`.

### 2. The dependencies

```sh
npm ci
```

One lockfile for the whole workspace: the BFF in `apps/server`, the client in
`apps/web` and the types between them in `packages/contract`.

`npm ci` runs `prepare` in `apps/web`, and that puts `pre-commit` and
`pre-push` in `.git/hooks` for the whole repo. `pre-commit` runs lint-staged on
the files being committed, and `pre-push` typechecks the client. npm 11 does not
run install scripts from dependencies that are not approved in `allowScripts`,
and reports `simple-git-hooks` and `fsevents` at the end. The hooks are
installed anyway, from `prepare`, and the rest of the recipe works without those
two scripts.

### 3. The BFF against a backend

```sh
cp apps/server/.env.example apps/server/.env
```

Fill in `DIGDIR_API_BASE` and `DIGDIR_API_KEY` in `apps/server/.env`. If the
dataset is not the default one, also `DIGDIR_TENANT` and
`DIGDIR_DATASET_CONFIG_KEY`. `KA_FILTER_FIELDS` and `KA_DATASETS` give the
client the fields in the filter and the name of the corpus. Typesense
(`TYPESENSE_API_HOST`, `TYPESENSE_API_KEY_ADMIN` and `KUDOS_DOCS_COLLECTION`)
provides the filters and the excerpts in the sources. The BFF only searches
there, so the key is a search key, never the admin key, even though the variable
is called `_ADMIN`. The keys stay in the BFF and never reach the browser.

```sh
npm run doctor
```

`npm run doctor` is the quick way to find out why nothing works. It checks that
the key authenticates, that it gives access to the agent that is configured,
that the conversation API answers, and that Typesense is reachable. If something
fails, it says what to change. The Typesense check looks up the collection with
`GET /collections/…`, which a search key is not allowed to do: measured 13.10,
that returned 401, while the search the BFF makes returned 200.

Two backends, selected by `DIGDIR_API_BASE`:

|                                 |                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `https://test.rag.digdir.cloud` | deployed test environment. Nothing to run yourself, but you need a key for that environment. |
| `http://localhost:8099`         | local. The setup is in `digdir-headless-rag`.                                                |

Or genki, see [Against genki](#against-genki).

Keys are per environment: one made locally does not authenticate against the
deployed backend. Without Typesense the app answers, but the filter row is
hidden and the source cards show no excerpts.

### Against genki

genki is the new backend ([`decisions/0010`](decisions/0010-genki-as-backend.md)).
The BFF talks to it the same way as to `digdir-headless-rag`, so the switch is
only settings in `apps/server/.env`. `DIGDIR_API_KEY` is the service key from
genki, see below:

```sh
DIGDIR_API_BASE=https://api.genki-test.digdir.cloud
DIGDIR_API_KEY=
DIGDIR_TOOL=kunnskapsassistenten__default
DIGDIR_AGENT_ID=kunnskapsassistenten
DIGDIR_TENANT=public-sector-knowledge
DIGDIR_DATASET_CONFIG_KEY=default
```

genki names tools `<service>__<variant>` and ties conversations to the service,
so `DIGDIR_TOOL` and `DIGDIR_AGENT_ID` have to change. genki maps the tenant and
the dataset key above to its Kudos dataset.

The key is a service key for `kunnskapsassistenten`, made under «API-nøkler for
tjenesten» in the portal (`https://portal.genki-test.digdir.cloud`). genki-test
is locked for model calls, so the key has to be made by someone who signed in
with Entra ID, not TestID. A key made by anyone else gets
`urn:genai:problem:locked-environment`. Locally the address is
`http://localhost:8080`, with a key from the local genki.

`npm run doctor` checks the setup against genki the same way.

The filter check ([What the backend supports](#what-the-backend-supports)) asks
headless-rag's `builtin.retrieve-only-agent__retrieve-only`, which genki does not
have. Against genki it gets no answer, and after the attempts the filter panel
is off. `KA_CAPABILITIES=filters` turns it on. Read in the code, not measured.

### 4. The BFF and the client together

```sh
VITE_API_MODE=bff KA_BFF_URL=http://localhost:8787 npm run dev
```

The BFF starts on `PORT` from `.env` (8787), and the client on
<http://localhost:5173>, with `/api` and `/auth` forwarded to the BFF.
`KA_BFF_URL` is needed, because otherwise the client looks for the BFF on 8788.
If 5173 is taken, Vite picks the next free port and prints it.

### 5. The client alone, against the backend

```sh
cp apps/web/.env.example apps/web/.env.local
```

Fill in the two keys in `apps/web/.env.local`: `KA_API_KEY`, your own key from
genki's portal (step 3 of [Run locally](apps/web/docs/run-locally.md)), and
`TYPESENSE_API_KEY`, a search key for Typesense and never the admin key. The
rest is in `.env.example` for genki-test. Without the file, `npm run web` has
neither a backend nor keys.

```sh
npm run web
```

The client in live on <http://localhost:5173>, the way the test environment
runs it: the Vite proxy sends the questions straight to the backend in
`KA_API_URL`, genki-test in `.env.example`, with the key, and the filters and
the excerpts come from Typesense. If anything is missing, the dev server prints
one line at startup saying what and where it is set. Mock is only for the tests
below.

### 6. The tests

```sh
npm run format:check
npm run typecheck
npm test
npm run lint --workspace apps/web
npm run build
```

`npm test` runs the server's tests with `node --test` and the client's with
vitest.

End-to-end with Playwright. The suite builds the client in mock and tests it on
port 4173, or on the one `KA_E2E_PORT` gives.

```sh
npx playwright install chromium
npm run test:e2e --workspace apps/web
```

### 7. The image

The same image the deployment uses: the BFF with the built client, from the
same origin.

```sh
docker build --tag ka .
docker run --rm --detach --name ka --publish 127.0.0.1:8787:8787 -e AUTH_MODE=off -e LISTEN_HOST=0.0.0.0 -e APP_ORIGIN=http://localhost:8787 -e DIGDIR_API_KEY=unused ka
curl -fsS --retry 15 --retry-all-errors --retry-delay 1 http://localhost:8787/api/health
docker stop ka
```

`curl` should print `{"ok":true}`. Without sign-in the server listens only on
127.0.0.1, which a published port does not reach, hence `LISTEN_HOST=0.0.0.0`;
`127.0.0.1:` in `--publish` keeps it on this machine.

The image serves the client in `apps/web`, which calls the API under
`/api/v2/*`. `/api/health` answers beside it for the readiness probe and the
image's health check (`decisions/0012`).

## Commands

|                                         |                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                           | the BFF and the client, with watch. The client runs in live without `VITE_API_MODE=bff`, see [Getting started](#getting-started) |
| `npm run web`                           | only the client, in live, with `apps/web/.env.local`                                                                             |
| `npm run doctor`                        | checks the connection to the backend                                                                                             |
| `npm run build`                         | production build of the client                                                                                                   |
| `npm test`                              | server (node:test) and web (vitest)                                                                                              |
| `npm run typecheck`                     | all three projects                                                                                                               |
| `npm run format`                        | prettier, writes                                                                                                                 |
| `npm run format:check`                  | prettier, checks only                                                                                                            |
| `npm run lint --workspace apps/web`     | oxlint and stylelint in the client                                                                                               |
| `npm run test:e2e --workspace apps/web` | Playwright against the client in mock                                                                                            |

## Status

The client works end to end against the Kudos corpus through the BFF: threads,
streamed answers with the agent's steps, and sources with excerpts when
Typesense is set up.

The same build runs against both versions of the backend. See [What the backend
supports](#what-the-backend-supports).

|                                                                        |                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Conversation through the BFF: streamed answer and the agent's steps    | done. Two display levels, Standard and Detaljert. After a reload the steps are gone, because the BFF does not keep them    |
| Thread list: search, rename, delete                                    | done. Grouped by time, asks before deleting, and rolls the change back when the BFF says no                                |
| Several turns in the same thread, start screen with suggestions        | done                                                                                                                       |
| URLs                                                                   | `/threads/<id>` opens the thread. Info pages, a 404 page and a page title of its own per route                             |
| Sources: clickable `[n]`, excerpts per answer, «Kilder brukt i svaret» | done, with search in the answer and in the sources. After a reload only the last answer has sources, from the BFF's memory |
| Copy the answer and the link to the thread, keywords from the search   | done                                                                                                                       |
| Link to feedback                                                       | not included                                                                                                               |
| Choice of agent                                                        | done, from `/api/v2/models`. The agent's mode cannot be chosen                                                             |
| Sign-in                                                                | in the BFF, Entra ID, off locally. See [Sign-in](#sign-in). On a 401 the client saves the draft before sign-in             |
| Name and «Logg ut»                                                     | from `/api/v2/me`. «Logg ut» also clears what the client remembers about the answers in the browser                        |
| The image                                                              | the BFF with the client built in bff mode, from the same origin. See [`deploy/`](deploy/README.md)                         |
| Filter panel: facets with counts, locked per thread                    | done, with a notice when the filter is locked. Fields and corpus name from the BFF                                         |
| Filters when the backend does not accept them                          | the panel says «Filtrering er ikke tilgjengelig ennå»                                                                      |
| Generated thread titles                                                | falls back to the question until the backend makes one                                                                     |
| Folders                                                                | dropped. The backend has tags, not folders                                                                                 |
| Without a backend                                                      | mock with an extract of Kudos, only for the automated tests                                                                |
| Layout                                                                 | resizable panels, drawers on narrow screens, and light and dark mode                                                       |

## What the backend supports

The server measures it at startup instead of assuming it, and exposes the
result at `/api/v2/capabilities`. That way the same build works against both
versions of the backend, and the filters switch on without a new deployment the
day the changes are in.

The filter check is a real test, not a declaration: it sends a filter that
cannot match anything, and compares with the same search without a filter. If
there are hits without the filter and none with it, the filter got through.
Without that control, a backend that is down would look like one that supports
filters.

Forced with `KA_CAPABILITIES="filters"` or `"no-filters"`.

## Sign-in

`AUTH_MODE` picks the mechanism.

|                |                                                                      |
| -------------- | -------------------------------------------------------------------- |
| `entra`        | Entra ID. What runs on `qa.kunnskap.digdir.cloud`.                   |
| `ansattporten` | Ansattporten, against genki. The person's token goes to the backend. |
| `off`          | Local only. Unsigned id, anyone can become anyone.                   |

If you leave out `AUTH_MODE`, it is derived: `entra` if the Azure variables are
set, otherwise `off`. The server prints which mode it runs in at every startup.

No token reaches the browser, only a signed cookie. `/api/v2/*` answers 401
without sign-in, and `/api/health` and `/api/v2/health` are open. Who gets in is decided by Entra ID, not by
the app. `AUTH_MODE=off` refuses to start unless the host in `APP_ORIGIN` is
exactly `localhost`, `127.0.0.1` or `[::1]`, over http or https, and
the server then listens only on 127.0.0.1, so no one else on the network can use
it as you. `LISTEN_HOST` names another address, such as `0.0.0.0` inside a
container, whose published port then decides who can reach it.
Setup in [`deploy/README.md`](deploy/README.md).

### Ansattporten

With `AUTH_MODE=ansattporten` the person signs in with Ansattporten in the BFF,
and the BFF calls genki with the person's token instead of the service key
([`decisions/0011`](decisions/0011-ansattporten-in-the-bff.md)). The tokens stay
on the server; the browser only gets a signed cookie with a key to them. They
are renewed with the refresh token before they expire, and «Logg ut» also ends
the session in Ansattporten.

Locally, against genki-test, in `apps/server/.env`:

```sh
AUTH_MODE=ansattporten
SESSION_SECRET=<openssl rand -hex 32>
DIGDIR_API_BASE=https://api.genki-test.digdir.cloud
DIGDIR_TOOL=kunnskapsassistenten__default
DIGDIR_AGENT_ID=kunnskapsassistenten
DIGDIR_DATASET_CONFIG_KEY=default
ANSATTPORTEN_ISSUER=https://test.ansattporten.no
ANSATTPORTEN_CLIENT_ID=<client id from Samarbeidsportalen>
ANSATTPORTEN_CLIENT_SECRET=<the client secret>
ANSATTPORTEN_REDIRECT_URI=http://localhost:8787/auth/callback
ANSATTPORTEN_ALTINN_RESOURCE=urn:altinn:resource:digdir-genai-platform-test
KA_CAPABILITIES=no-filters
```

`DIGDIR_API_KEY` can be left empty. It is then only used for the filter check,
and without it `KA_CAPABILITIES` applies. The client has to be registered in
Ansattporten with `http://localhost:8787/auth/callback`, and in the genki portal
as a client of type `browser` with the same client id.

Who gets in:

- The organisations are in the token (`authorization_details` for the Altinn
  resource). If there is one, no `GenAI-Acting-For` is sent. If there are
  several, the person chooses on `/auth/org`, and the choice is sent as
  `GenAI-Acting-For`.
- A sign-in with Entra ID through Ansattporten has no organisations in the
  token. Then the BFF asks genki (`GET /me`). The token has no name either, so
  the email address is shown instead.
- genki-test is locked for language models: only Entra ID sign-ins in Digdir's
  group get answers. Others get the page «Ingen tilgang» at sign-in
  (`urn:genai:problem:entra-not-trusted`), or the message «Testmiljøet er låst»
  when they ask (`urn:genai:problem:locked-environment`).

The tokens are held in the process's memory. A restart signs everyone out, and
the deployment keeps each person on the same replica (`stickySessions`).

The shared secret in the link (`?secret=`) belongs to the server in
`apps/web/server`, which deploys the client on its own against headless-rag. It
is unchanged. The BFF has no such gate: with Ansattporten, sign-in is the gate.

### Feedback

`POST /api/v2/feedback` takes `{ conversationId, taskId, rating, comment? }`
and forwards it to genki. `taskId` comes with `done` in the
answer, and on the answers when a thread is read. The BFF only sends feedback on
an answer that is in the person's own thread. headless-rag sends no `taskId`, so
there the route gives 404. A backend that has answer ids but does not accept
feedback gives `{ ok: false, unavailable: true }`.

## Documentation

From 2026-10-16, new and changed text in the repo is written in English:
code, comments, test names, commit messages, branch names, PRs, issues,
reviews and docs. What users see or hear stays Norwegian bokmål with æøå.
Older Norwegian text is translated when a PR touches it, as this README has
been.

[`decisions/`](decisions/) are the ADRs, in English like `digdir-headless-rag`:
why Preact, why a BFF, why `/api/mcp` rather than `/v1`. 0004–0008 came with
the client in `apps/web`: where the knowledge about a corpus should live, the
client behind the BFF, filter fields and corpus names from the BFF, the display
level, and the text in the excerpts and the sources after a reload. 0009 is the
API version in the path: `/api/*` in the format from main for the client in
`apps/web-preact`, and `/api/v2/*` for the client in `apps/web`. 0010 is genki
as the backend, 0011 sign-in with Ansattporten in the BFF, and 0012 retires
`apps/web-preact` and `/api/*` with it.

[`deploy/README.md`](deploy/README.md) covers deployment to Azure and sign-in.

## Where things are

| Where                                             | What                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/`                                            | **This.** The application: SPA, server and contract.                                       |
| [`../docs/`](../docs)                             | Design work, acceptance criteria, insight.                                                 |
| [`../docs/archive/evals/`](../docs/archive/evals) | The evaluations from the headless-rag period, archived as documentation. Not run.          |
| `digdir/digdir-headless-rag`                      | **The backend.** Used over HTTP only.                                                      |
| `digdir/digdir-rag`                               | **Archived.** The original Clojure monolith. A source of Norwegian text, not a dependency. |
| `digdir/digdir-rag-frontend`                      | **A separate alpha demo.** Unrelated to this, despite the name.                            |

Working material that belongs to the project but not to the repo, such as the
original plan, the presentations and the captured stylesheet, is kept outside,
in `_notes/` next to the checkouts.
