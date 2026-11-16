# Deploying to Azure Container Apps

One container: the Hono server signs people in, keeps their tokens, talks to
genki, and serves the built client from the same origin. Same origin is not
cosmetic, it is what keeps the session cookie first-party.

**Deployed and in use:** `https://qa.kunnskap.digdir.cloud`
Container app `ka-app` in resource group `rg-ka-test-weu`, West Europe,
subscription `Altinn-AI-Assistant`. Its images are in `sharedregistryswc`, a
registry shared with other apps, in resource group `rg-shared-registry-swc`,
Sweden Central. Every `az` command below names the subscription, because the
one a machine has as its default may be another. The DNS records for the
domain live in the Azure DNS zone `kunnskap.digdir.cloud` in `rg-ka-test-weu`,
delegated from `digdir.cloud` at Porkbun; the certificate is managed by
Container Apps.

## What is already set up

Sign-in is Ansattporten, `AUTH_MODE=ansattporten`: the server signs the person
in and calls genki with their token (`decisions/0011`). Who gets in is decided
by Ansattporten and genki, and the app adds no check of its own. The app has no
service key and no Entra ID settings. `AUTH_MODE=off` is for local
development only: unsigned identity, anyone can be anyone, the server refuses
to start with it unless the host in `APP_ORIGIN` is exactly `localhost`,
`127.0.0.1` or `[::1]`, and it listens only on
127.0.0.1 unless `LISTEN_HOST` names another address.

The app pulls its image with the managed identity `ka-app-id`, which has
`AcrPull` on the registry.

A new public host needs its callback registered with the Ansattporten client
before `APP_ORIGIN` and `ANSATTPORTEN_REDIRECT_URI` point at it. The next
section has the two URIs.

## Ansattporten instead of Entra ID

`authMode=ansattporten` signs people in with Ansattporten and sends their
token to genki (`decisions/0011`). It is what the test site runs. It needs,
besides the genki values in Deploying from scratch:

| Parameter                    | genki-test                                             |
| ---------------------------- | ------------------------------------------------------ |
| `authMode`                   | `ansattporten`                                         |
| `ansattportenIssuer`         | `https://test.ansattporten.no` (the default)           |
| `ansattportenClientId`       | the client id from Samarbeidsportalen                  |
| `ansattportenClientSecret`   | its secret (secure parameter, a Container Apps secret) |
| `ansattportenAudience`       | `digdir:genai` (the default)                           |
| `ansattportenAltinnResource` | `urn:altinn:resource:digdir-genai-platform-test`       |

`digdirApiKey` may then be empty, and `azureClientId` and `azureClientSecret`
are not used. The test site has none of the three. The redirect URI is
`https://<publicHost>/auth/callback` and must be registered with the client in
Samarbeidsportalen, with `https://<publicHost>/` as post-logout redirect URI.
The same client id is registered in the genki portal as a `browser` frontend
for the service.

The tokens live in the replica that signed the person in, so ingress is
sticky in this mode, and the app keeps one replica, since removing a replica
signs out everyone on it. A new revision or a restart signs everyone out.

`authMode=entra` is the template's default, and the test site does not run
with it. It signs people in with Entra ID, app registration
`altinn-ai-assistant-ka-sso`, single tenant, with admin consent granted. Only
accounts that exist in the tenant can sign in, and the app adds no check of
its own. The server then calls the backend with a service key, so
`digdirApiKey`, `azureClientId` and `azureClientSecret` are required, and a
new public host needs its `https://<host>/auth/callback` among the app
registration's redirect URIs.

## Changing a running deployment

There is no deploy pipeline, deliberately. `az acr build` uploads the working
tree, so nothing needs pushing to GitHub first.
`.github/workflows/ci.yml` still runs format, typecheck, tests and build on
pull requests.

Code change, about three minutes. The test site runs `main`, so build from a
clean checkout of it: `az acr build` uploads the working tree as it is, and the
image is tagged with the commit. The first line prints nothing when the tree is
clean.

```sh
git status --short
SHA=$(git rev-parse --short=8 HEAD)

az acr build --subscription Altinn-AI-Assistant --registry sharedregistryswc --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --image sharedregistryswc.azurecr.io/ka-app:$SHA \
  --revision-suffix main$SHA
```

That swaps the image and nothing else. The variables and secrets stay as they
are. To change a variable, add `--set-env-vars` to an `az containerapp update`:
it adds or updates the variables it names and leaves the others as they are.
Quote a value with `|` in it, because `|` is a pipe to the shell.

Config or a secret, about 30 seconds and no rebuild. The app's secrets are
`session-secret` and `ansattporten-client-secret`. This replaces the
Ansattporten client secret. `read -rs` reads the value without
showing it or keeping it in the shell history:

```sh
read -rs SECRET
az containerapp secret set --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --secrets ansattporten-client-secret="$SECRET"
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --revision-suffix secret$(date +%H%M%S)
```

`secret set` alone changes nothing that is running: the value is only picked up
by a new revision, which the second command forces. Secrets are write-only in
the portal, though `az containerapp secret show` will read one back.

The old revision serves until the new one is healthy, so a bad image does not
take the site down. Roll back by deploying an older tag. The first command
lists the five newest; type the one to go back to:

```sh
az acr repository show-tags --subscription Altinn-AI-Assistant --name sharedregistryswc --repository ka-app --orderby time_desc --top 5 -o tsv
read -r OLDER
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --image sharedregistryswc.azurecr.io/ka-app:$OLDER \
  --revision-suffix rollback$(date +%H%M%S)
```

## Settings no longer read

The previous client, `apps/web`, is gone, and the switch between it and the next client with it
(`decisions/0019`). The server ignores the settings that only they used, and names at startup
those still set on the app, by name only:

`KA_NEXT`, `KA_NEXT_DEFAULT`, `KA_NEXT_ONLY`, `WEB_ROOT`, `KA_EXCERPT_ENVIRONMENT`,
`KA_CAPABILITIES`, `KA_FILTER_FIELDS`, `KA_DATASETS`, `KUDOS_BASE`, `TYPESENSE_API_HOST`,
`TYPESENSE_API_KEY_ADMIN`, `KUDOS_DOCS_COLLECTION`, `DIGDIR_TOOL`, `DIGDIR_AGENT_ID`,
`DIGDIR_TENANT` and `DIGDIR_DATASET_CONFIG_KEY`.

They do no harm, and can be removed at any time after the new image is out. The log line
`no longer read, and safe to remove:` names the ones the app has, and so does the first command
below, which prints the names of the app's variables and no values. The second removes the ones
`ka-app` had on 2026-11-16, about 30 seconds and no rebuild:

```sh
az containerapp show --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --query "properties.template.containers[0].env[].name" -o tsv
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --remove-env-vars KA_NEXT KA_NEXT_DEFAULT KA_CAPABILITIES KA_FILTER_FIELDS KA_DATASETS TYPESENSE_API_HOST TYPESENSE_API_KEY_ADMIN KUDOS_DOCS_COLLECTION DIGDIR_TOOL DIGDIR_AGENT_ID DIGDIR_TENANT DIGDIR_DATASET_CONFIG_KEY \
  --revision-suffix retired$(date +%H%M%S)
```

Then the secret only `TYPESENSE_API_KEY_ADMIN` used. A secret a variable still refers to cannot
be removed, so this comes after the variables:

```sh
az containerapp secret remove --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --secret-names typesense-key
```

A browser that chose the previous client keeps a `ka_ui` cookie, which nothing reads any more,
and gets the next client like everyone else. Its links to a thread, `/threads/<id>` and
`/chat/<id>`, open the thread.

## Another assistant from the builder

The client can draw another genki service in KA's way: its own name, suggestions and
collection words, with KA's blocks or others, as genki's builder lays them out
(`decisions/0017`). `KA_NEXT_LAYOUT` holds the layout, the JSON the builder's «Kopier oppsettet»
gives, or the path of a file with it. The server checks it with genki's own rules when it
starts, and does not start with a layout genki would refuse; the log names each problem by
rule and path. Without `KA_NEXT_LAYOUT`, the client is KA's own.

One deployment draws one service, so another assistant is a second container app beside
`ka-app`, with its own host, sign-in and genki client. These steps are for a person, in order:

1. **The service in genki.** Make it in the genki portal, and publish it. Its id and variant
   make the model, `<service>__<variant>`, such as `rapportassistenten__default`.
2. **The layout.** On the service's page, «Byggeklosser»: choose a template, such as
   «Kunnskapsassistenten», and write its words in «Tekster». «Kopier oppsettet» copies the
   layout. Keep it as `layout.json`. Nothing in genki stores it yet.
3. **An Ansattporten client of its own.** In Samarbeidsportalen, as for `ka-app` (Ansattporten
   instead of Entra ID, above), with `https://<host>/auth/callback` as redirect URI and
   `https://<host>/` as post-logout redirect URI. An Ansattporten client id can be registered
   with one genki service only, so `ka-app`'s cannot be reused.
4. **Its client in genki.** On the service's page, «Kanaler og frontend», «Registrer
   brukerflate»: a browser frontend with the new client id and the host. genki confines a
   person's token to the service its client is registered for.
5. **The container app.** Deploy the template as in Deploying from scratch, with these
   parameters changed or added. `name` keeps it apart from `ka-app`: the template names the
   app, its environment, its identity and its log workspace after it, and the new identity
   needs `AcrPull` on the registry too.

   | Parameter                                          | Value                         |
   | -------------------------------------------------- | ----------------------------- |
   | `name`                                             | such as `ka-rapport`          |
   | `publicHost`                                       | the new host                  |
   | `ansattportenClientId`, `ansattportenClientSecret` | the new client's, from step 3 |
   | `kaNextModel`                                      | `<service>__<variant>`        |

6. **The layout on the app.** About 30 seconds and no rebuild. `jq -c` puts the JSON on one
   line, and checks that it is JSON:

   ```sh
   LAYOUT=$(jq -c . layout.json)
   az containerapp update --subscription Altinn-AI-Assistant -n ka-rapport -g rg-ka-test-weu \
     --set-env-vars "KA_NEXT_LAYOUT=$LAYOUT" --revision-suffix layout$(date +%H%M%S)
   ```

   If the new revision does not become healthy, its log says which of genki's rules the layout
   breaks. The old revision keeps serving meanwhile.

7. **Open it.** `https://<host>/` is the other assistant, for everyone.

A changed layout is step 6 again. `KA_NEXT_LAYOUT` with a path instead of JSON reads the file
at that path in the container, such as a Container Apps secret mounted as a volume. The template
takes it as `kaNextLayout`, empty by default; step 6 sets it on the app instead.

The other assistant keeps what only KA's host gives: the sign-in, only this service's threads,
and KA's two trials in «Innstillinger». Its profile menu has genki's «Innstillinger» and «Logg
ut», but not KA's «Endringslogg» and «Om prosjektet», which are KA's service's
(`decisions/0019`), and their addresses say «Siden finnes ikke». Every other word is the
layout's.

## Testers and genki's test environment

`KA_TESTERS` names the testers by user id, separated by commas or spaces (`decisions/0015`).
A tester's questions, threads and feedback go to genki with `GenAI-Environment: test`. Everyone
else sends no header and gets the service's `prod`. The client does not show it: a tester sees
no «Testmiljø». `KA_TEST_ENVIRONMENT` names another environment than `test`. Without `KA_TESTERS` nobody
is a tester and nothing changes.

The user id is `userId` in `/api/next/me`, which a tester opens on the site while signed in:
with Ansattporten it is `ansattporten:` followed by Ansattporten's subject for KA's client.

Add the `test` environment to the genki service first: until it has one, genki refuses a
tester's questions with `409 environment_not_found`. A key or client bound to environments must
allow `test` too. Then, about 30 seconds and no rebuild, type the ids separated by commas when
the first command waits:

```sh
read -r TESTERS
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --set-env-vars "KA_TESTERS=$TESTERS" --revision-suffix testers$(date +%H%M%S)
```

Nobody is a tester again with:

```sh
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --remove-env-vars KA_TESTERS --revision-suffix testers$(date +%H%M%S)
```

A new revision signs everyone out with Ansattporten, as every rollout does. The template takes
the same as `kaTesters` and `kaTestEnvironment`, empty by default.

## Deploying from scratch

Only needed if the resource group is gone. The names are the test site's. The
template names what it creates after its `name` parameter, `ka-app` by
default: the container app `ka-app`, the environment `ka-app-env`, the
identity `ka-app-id` and the log workspace `ka-app-logs`. The registry is not
created here: `sharedregistryswc` is in its own resource group.

The template's defaults are genki-test and Entra ID, which is not what the
test site runs, so the command passes Ansattporten. The two
`read` lines take the Ansattporten client id and then its secret, the secret
without showing it, and the session secret is made new:

```sh
SHA=$(git rev-parse --short HEAD)
read -r CLIENT_ID
read -rs CLIENT_SECRET
SESSION_SECRET=$(openssl rand -hex 32)

az group create --subscription Altinn-AI-Assistant -n rg-ka-test-weu -l westeurope
az acr build --subscription Altinn-AI-Assistant --registry sharedregistryswc --image ka-app:$SHA \
  --file src/Dockerfile src
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test-weu \
  --template-file src/deploy/main.bicep --parameters \
  image=sharedregistryswc.azurecr.io/ka-app:$SHA \
  acrLoginServer=sharedregistryswc.azurecr.io \
  publicHost=qa.kunnskap.digdir.cloud \
  sessionSecret="$SESSION_SECRET" \
  digdirApiBase=https://api.genki-test.digdir.cloud \
  authMode=ansattporten \
  ansattportenClientId="$CLIENT_ID" \
  ansattportenClientSecret="$CLIENT_SECRET" \
  ansattportenAltinnResource=urn:altinn:resource:digdir-genai-platform-test
```

The first `az deployment group create` **fails** on the image pull. That is
expected: the managed identity does not exist until the template creates it,
and it has no rights to the registry until granted. Grant, then deploy again:

```sh
az role assignment create --subscription Altinn-AI-Assistant --role AcrPull \
  --assignee-object-id "$(az identity show --subscription Altinn-AI-Assistant -n ka-app-id -g rg-ka-test-weu --query principalId -o tsv)" \
  --assignee-principal-type ServicePrincipal \
  --scope "$(az acr show --subscription Altinn-AI-Assistant -n sharedregistryswc --query id -o tsv)"
```

The template does not set up the domain. The DNS zone
`kunnskap.digdir.cloud`, the binding of `qa.kunnskap.digdir.cloud` to the app
and its managed certificate are not in `main.bicep`; `publicHost` only decides
`APP_ORIGIN` and the sign-in callback.

Parameters the template needs are declared with `@description` in
`main.bicep`. `image`, `acrLoginServer` and `sessionSecret` have no default.
`publicHost` is the custom domain. `digdirApiBase` is the genki API, genki-test
by default. `digdirApiKey` is for `authMode=entra`: a genki service key for
`kunnskapsassistenten`, made by an Entra ID login (genki-test is locked). With
Ansattporten it is not used. `kaNextModel`, `kaNextTenant` and `kaNextLayout`
are the client's service and variant, its tenant and a layout from genki's
builder, each empty for its default.

## Choices worth knowing about

**`minReplicas: 1`, not scale to zero.** A cold start would make the first
question of the day pay for boot.

**Ingress timeout is the default 240 s.** One turn streams for 30 to 90 s. If
turns get slower this is the setting that cuts them off, and it will look like
a frontend bug.

**Secrets are Container Apps secrets, not Key Vault.** One fewer moving part
for a test environment. The managed identity is already there if that changes.
