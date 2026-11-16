# Kunnskapsassistenten, the application

**Kunnskapsassistenten's client and the server that serves it, on genki.**

The client is drawn from genki's UI blocks: `<Assistant>` from `@genai/ui-assembly` with the
template `knowledge-assistant-next`, and what only KA knows (its words for Kudos, its suggestions,
its pages) around it. The server signs people in and is the only thing that talks to genki. There
is one client: the previous one, `apps/web`, was removed on 2026-11-16
([`decisions/0019`](decisions/0019-remove-the-previous-client.md)).

```
apps/web-next  The client. Vite, React, Designsystemet, and genki's blocks in vendor/genki. No secrets.
apps/server    Hono. Signs people in, holds their tokens or the service key, and serves the client.
v2/            Experiments with shared components, apart from the client (v2/README.md).
```

```
browser ──► apps/server ──► genki
            /auth/*              sign-in: Ansattporten or Entra ID, off locally
            /api/next/me         who is signed in, and which genki service the page asks
            /api/next/genki/*    a narrow proxy to genki's API, with the person's credential
            /api/next/feedback   feedback on an answer, checked against the person's thread
            /api/health          the readiness probe
            every other address  the client's page
```

The browser never gets a token or a key. The server holds them and adds them to each call to
genki, so something on the server side has to _be_ the identity. See
[`decisions/0002`](decisions/0002-backend-for-frontend.md) and
[`decisions/0011`](decisions/0011-ansattporten-in-the-bff.md).

## Deployed

<https://qa.kunnskap.digdir.cloud>, against genki-test, signed in with Ansattporten. How it is
deployed and rolled out is in [`deploy/README.md`](deploy/README.md).

## Getting started

From a fresh clone to the app on your machine, against genki-test. Each block is run on its own,
and every command after `cd` is run in `src/`.

### 1. The clone and Node 24

`mise.toml` pins the Node version. With [mise](https://mise.jdx.dev) activated in the shell:

```sh
git clone https://github.com/digdir/kunnskapsassistenten.git
cd kunnskapsassistenten/src
mise trust
mise install
node --version
```

The last one should print `v24.21.0`. Node 24.15 or newer is enough: `engines` requires
`>=24.15`, and `.npmrc` has `engine-strict`.

### 2. The dependencies

```sh
npm ci
```

One lockfile for the whole workspace: the server in `apps/server`, the client in `apps/web-next`
and the experiments in `v2/`.

### 3. The server's settings

```sh
cp apps/server/.env.example apps/server/.env
```

Fill in `DIGDIR_API_KEY` in `apps/server/.env`. The rest is set for genki-test with sign-in off.
The key is a service key for `kunnskapsassistenten`, made under «API-nøkler for tjenesten» in
genki's portal (<https://portal.genki-test.digdir.cloud>), choosing «Tjenester»,
«Kunnskapsassistenten» and «Kanaler og frontend». genki-test is locked for model calls, so the key
has to be made by someone who signed in with Entra ID, not TestID; a key made by anyone else gets
`urn:genai:problem:locked-environment`. The portal shows the key once. It stays in the server and
never reaches the browser.

```sh
npm run doctor
```

`npm run doctor` is the quick way to find out why nothing works. It checks that the key
authenticates, that it gives access to the service and variant the client asks
(`KA_NEXT_MODEL`), and that genki's conversations answer. If something fails, it says what to
change.

### 4. The app

```sh
npm run web
```

That builds the client and starts the server serving it on <http://localhost:8787>, the way the
test site runs it, with sign-in off. Locally with the service key, rename, delete and feedback are
not offered: genki takes them only with a person's token.

For work on the client, with reloads as you save:

```sh
npm run dev
```

The server starts on `PORT` from `.env` (8787), and Vite on <http://localhost:5173>, with `/api`
and `/auth` sent to the server. `KA_SERVER_URL` names another server for Vite.

### 5. The tests

```sh
npm run format:check
npm run typecheck
npm test
npm run build
node apps/web-next/scripts/check-bundle-size.mjs apps/web-next/dist
npm run tokens:verify --workspace apps/web-next
```

`npm test` runs the server's tests with `node --test`, and the client's and `v2/`'s with vitest.
The bundle check holds the client's first load to 300 kB gzip. `tokens:verify` checks that
`apps/web-next/src/theme.css` is the theme Designsystemet makes from
`apps/web-next/designsystemet.config.json`; `npm run tokens:build --workspace apps/web-next`
writes it.

### 6. The image

The same image the deployment uses: the server with the built client, from the same origin.

```sh
docker build --tag ka .
docker run --rm --detach --name ka --publish 127.0.0.1:8787:8787 -e AUTH_MODE=off -e LISTEN_HOST=0.0.0.0 -e APP_ORIGIN=http://localhost:8787 -e DIGDIR_API_KEY=unused ka
curl -fsS --retry 15 --retry-all-errors --retry-delay 1 http://localhost:8787/api/health
docker stop ka
```

`curl` should print `{"ok":true}`. Without sign-in the server listens only on 127.0.0.1, which a
published port does not reach, hence `LISTEN_HOST=0.0.0.0`; `127.0.0.1:` in `--publish` keeps it
on this machine.

## Commands

|                        |                                                                               |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run web`          | builds the client, and starts the server serving it, as the test site runs it |
| `npm run dev`          | the server and the client's Vite, with watch                                  |
| `npm run doctor`       | checks the connection to genki                                                |
| `npm run build`        | production build of the client, and of `v2/`                                  |
| `npm test`             | the server (node:test), the client and `v2/` (vitest)                         |
| `npm run typecheck`    | the server, the client and `v2/`                                              |
| `npm run format`       | prettier, writes                                                              |
| `npm run format:check` | prettier, checks only                                                         |

## The client's pages

The server sends the client's page for every address, and the page reads the address:

|                                   |                                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| `/`, `/?t=<id>`                   | the assistant, with the thread in `?t=`                                     |
| `/innstillinger`                  | «Innstillinger»                                                             |
| `/endringslogg`, `/om-prosjektet` | KA's pages «Endringslogg» and «Om prosjektet», from the profile menu        |
| `/threads/<id>`, `/chat/<id>`     | the previous client's thread links: the server redirects them to `/?t=<id>` |
| any other                         | «Siden finnes ikke»                                                         |

## Sign-in

`AUTH_MODE` picks the mechanism.

|                |                                                                  |
| -------------- | ---------------------------------------------------------------- |
| `ansattporten` | Ansattporten. The person's token goes to genki. The test site's. |
| `entra`        | Entra ID. The server calls genki with the service key.           |
| `off`          | Local only. Unsigned id, anyone can become anyone.               |

If you leave out `AUTH_MODE`, it is derived: `entra` if the Azure variables are set, otherwise
`off`. The server prints which mode it runs in at every startup.

No token reaches the browser, only a signed cookie. `/api/*` answers 401 without sign-in, and
`/api/health` is open. Who gets in is decided by Ansattporten and genki, or by Entra ID, not by
the app. `AUTH_MODE=off` refuses to start unless the host in `APP_ORIGIN` is exactly `localhost`,
`127.0.0.1` or `[::1]`, over http or https, and the server then listens only on 127.0.0.1, so no
one else on the network can use it as you. `LISTEN_HOST` names another address, such as `0.0.0.0`
inside a container, whose published port then decides who can reach it. Setup in
[`deploy/README.md`](deploy/README.md).

### Ansattporten

With `AUTH_MODE=ansattporten` the person signs in with Ansattporten in the server, and the server
calls genki with the person's token instead of the service key
([`decisions/0011`](decisions/0011-ansattporten-in-the-bff.md)). The tokens stay on the server;
the browser only gets a signed cookie with a key to them. They are renewed with the refresh token
before they expire, and «Logg ut» also ends the session in Ansattporten.

Locally, against genki-test, in `apps/server/.env`:

```sh
AUTH_MODE=ansattporten
SESSION_SECRET=<openssl rand -hex 32>
DIGDIR_API_BASE=https://api.genki-test.digdir.cloud
ANSATTPORTEN_ISSUER=https://test.ansattporten.no
ANSATTPORTEN_CLIENT_ID=<client id from Samarbeidsportalen>
ANSATTPORTEN_CLIENT_SECRET=<the client secret>
ANSATTPORTEN_REDIRECT_URI=http://localhost:8787/auth/callback
ANSATTPORTEN_ALTINN_RESOURCE=urn:altinn:resource:digdir-genai-platform-test
```

`DIGDIR_API_KEY` can be left empty: it is not used. The client has to be registered in
Ansattporten with `http://localhost:8787/auth/callback`, and in the genki portal as a client of
type `browser` with the same client id.

Who gets in:

- The organisations are in the token (`authorization_details` for the Altinn resource). If there
  is one, no `GenAI-Acting-For` is sent. If there are several, the person chooses on `/auth/org`,
  and the choice is sent as `GenAI-Acting-For`.
- A sign-in with Entra ID through Ansattporten has no organisations in the token. Then the server
  asks genki (`GET /me`). The token has no name either, so the email address is shown instead.
- genki-test is locked for language models: only Entra ID sign-ins in Digdir's group get answers.
  Others get the page «Ingen tilgang» at sign-in (`urn:genai:problem:entra-not-trusted`), or the
  message «Testmiljøet er låst» when they ask (`urn:genai:problem:locked-environment`).

The tokens are held in the process's memory. A restart signs everyone out, and the deployment
keeps each person on the same replica (`stickySessions`).

### Feedback

`POST /api/next/feedback` takes `{ conversationId, taskId, rating, reasons?, comment? }` and
forwards it to genki, only with a person's token: genki records feedback from anyone holding the
service key, so local runs never write it. The server first checks that the run is an answer in
one of the person's own threads ([`decisions/0013`](decisions/0013-next-client-behind-a-toggle.md)).

## Documentation

New and changed text in the repo is written in English: code, comments, test names, commit
messages, branch names, PRs, issues, reviews and docs. What users see or hear stays Norwegian
bokmål with æøå.

- [`decisions/`](decisions/) are the architecture decisions. The latest ones: 0010 genki as the
  backend, 0011 sign-in with Ansattporten, 0013 the next client and its API, 0015 testers on
  genki's test environment, 0017 a layout from genki's builder, and 0019 the removal of the
  previous client. 0001–0009 and 0012, 0014, 0016 and 0018 are about clients that are gone, and
  say so where they were superseded.
- [`docs/`](docs/) has the reports and the decision log, and the previous client's documentation.
- [`deploy/README.md`](deploy/README.md) covers deployment to Azure, sign-in and the settings.
- [`apps/web-next/README.md`](apps/web-next/README.md) covers the client and its copy of genki.

## Where things are

| Where                                             | What                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/`                                            | **This.** The application: the client and the server.                             |
| [`../docs/`](../docs)                             | Design work, acceptance criteria, insight.                                        |
| [`../docs/archive/evals/`](../docs/archive/evals) | The evaluations from the headless-rag period, archived as documentation. Not run. |
| `digdir/genki`                                    | **The backend**, and the UI blocks the client is drawn from.                      |
