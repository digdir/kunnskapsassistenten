# Deploying to Azure Container Apps

One container: the Hono server holds the API key, talks to
`digdir-headless-rag`, and serves the built SPA from the same origin. Same
origin is not cosmetic, it is what keeps the session cookie first-party.

**Deployed and in use:** `https://qa.kunnskap.digdir.cloud`
Resource group `rg-ka-test-weu`, West Europe, subscription `Altinn-AI-Assistant`,
images in `sharedregistryswc`. Every `az` command below names the
subscription, because the one a machine has as its default may be another. The
DNS records for the domain live in the Azure DNS zone `kunnskap.digdir.cloud` in
`rg-ka-test-weu`, delegated from `digdir.cloud` at Porkbun; the certificate
is managed by Container Apps.

## What is already set up

Sign-in is Entra ID, app registration `altinn-ai-assistant-ka-sso`, single
tenant, with admin consent granted. Only accounts that exist in the tenant can
sign in, and the app adds no check of its own. `AUTH_MODE=off` is for local
development only: unsigned identity, anyone can be anyone, the server refuses
to start with it unless the host in `APP_ORIGIN` is exactly `localhost`,
`127.0.0.1` or `[::1]`, and it listens only on
127.0.0.1 unless `LISTEN_HOST` names another address.

A new public host needs its `https://<host>/auth/callback` added to the app
registration's redirect URIs before `APP_ORIGIN` and `AZURE_REDIRECT_URI` point
at it.

## Ansattporten instead of Entra ID

`authMode=ansattporten` signs people in with Ansattporten and sends their
token to genki (`decisions/0011`). It needs, besides the genki values in
Deploying from scratch:

| Parameter                    | genki-test                                                  |
| ---------------------------- | ----------------------------------------------------------- |
| `authMode`                   | `ansattporten`                                              |
| `ansattportenIssuer`         | `https://test.ansattporten.no` (the default)                |
| `ansattportenClientId`       | the client id from Samarbeidsportalen                       |
| `ansattportenClientSecret`   | its secret (secure parameter, a Container Apps secret)      |
| `ansattportenAudience`       | `digdir:genai` (the default)                                |
| `ansattportenAltinnResource` | `urn:altinn:resource:digdir-genai-platform-test`            |
| `kaCapabilities`             | `no-filters` or `filters`, as there is no key to probe with |

`digdirApiKey` may then be empty, and `azureClientId` and `azureClientSecret`
are not used. The redirect URI is `https://<publicHost>/auth/callback` and
must be registered with the client in Samarbeidsportalen, with
`https://<publicHost>/` as post-logout redirect URI. The same client id is
registered in the genki portal as a `browser` frontend for the service.

The tokens live in the replica that signed the person in, so ingress is
sticky in this mode, and the app keeps one replica, since removing a replica
signs out everyone on it. A new revision or a restart signs everyone out.

## Changing a running deployment

There is no deploy pipeline, deliberately. `az acr build` uploads the working
tree, so nothing needs pushing to GitHub first.
`.github/workflows/ci.yml` still runs format, typecheck, tests and build on
pull requests.

Code change, about three minutes. Commit first: `az acr build` uploads the
working tree as it is, and the image is tagged with the commit. The first line
prints nothing when there is nothing uncommitted.

```sh
git status --short
SHA=$(git rev-parse --short HEAD)

az acr build --subscription Altinn-AI-Assistant --registry sharedregistryswc --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --image sharedregistryswc.azurecr.io/ka-app:$SHA \
  --revision-suffix sha$SHA
```

**The first rollout of an image with the client in `apps/web`** needs two
variables a deployment from before it does not have. The path above swaps the image and nothing else: without
`KA_FILTER_FIELDS` the BFF has no facets and no filter panel, and without
`KA_DATASETS` no name for the dataset. Set them in the same update, once, with
the template's defaults under the dataset key `kudos`:

```sh
git status --short
SHA=$(git rev-parse --short HEAD)

az acr build --subscription Altinn-AI-Assistant --registry sharedregistryswc --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --image sharedregistryswc.azurecr.io/ka-app:$SHA \
  --set-env-vars 'KA_FILTER_FIELDS=kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer' 'KA_DATASETS=kudos=Kudos' \
  --revision-suffix sha$SHA
```

The values are quoted because `|` is a pipe to the shell. `--set-env-vars`
adds or updates the variables it names and leaves the others as they are.
Later rollouts take the path above, and the variables stay.

The image serves only the client in `apps/web` (`decisions/0012`). A
`KA_DEFAULT_CLIENT` left on the app from before is ignored, and a browser's
`ka_klient` cookie no longer matters.

Config or a secret, about 30 seconds and no rebuild. `read -rs` reads the
value without showing it or keeping it in the shell history:

```sh
read -rs KEY
az containerapp secret set --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --secrets digdir-api-key="$KEY"
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu --revision-suffix key$(date +%H%M%S)
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

## The next client, behind a toggle

The image holds two clients: `apps/web`, which everyone gets, and `apps/web-next`, built from
genki's UI blocks (`decisions/0013`). `KA_NEXT=1` offers the next one: `apps/web` then shows
«Prøv ny versjon» at the foot of the navigation panel, and a person who chooses it gets it on
every load until they choose «Tilbake til gammel versjon» in its profile menu. The choice is a
cookie per browser. Without `KA_NEXT` nothing of it shows, and the cookie is ignored.

It uses the same sign-in and the same genki service as `apps/web`. `KA_NEXT_MODEL` names the
variant it asks (default `kunnskapsassistenten__default`) and `KA_NEXT_TENANT` the tenant whose
collections it reads (default `digdir`). On a running deployment, about 30 seconds and no
rebuild:

```sh
# On
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --set-env-vars KA_NEXT=1 --revision-suffix next$(date +%H%M%S)
# Off: everyone gets apps/web again
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --remove-env-vars KA_NEXT --revision-suffix classic$(date +%H%M%S)
```

The template takes the same as `kaNext`, `kaNextModel` and `kaNextTenant`, empty by default.

## Testers and genki's test environment

`KA_TESTERS` names the testers by user id, separated by commas or spaces (`decisions/0015`).
A tester's questions, threads and feedback, in both clients, go to genki with
`GenAI-Environment: test`, and the chat shows «Testmiljø» beside the send button. Everyone else sends no header and gets the service's
`prod`. `KA_TEST_ENVIRONMENT` names another environment than `test`. Without `KA_TESTERS` nobody
is a tester and nothing changes.

The user id is `userId` in `/api/v2/me`, which a tester opens on the site while signed in:
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

## The excerpt trial

`KA_EXCERPT_ENVIRONMENT` names a genki environment of the service whose version cites by
excerpt (`decisions/0016`). With it set, Innstillinger in `apps/web` offers «Fotnoter som
viser til utdraget», and the calls of a person who turns it on go to genki with `GenAI-Environment` set to
that environment. Testers keep their own environment. Without it there is no switch and nothing
changes.

Add the environment to the genki service first: until it has one, genki refuses those questions
with `409 environment_not_found`. A key or client bound to environments must allow it too. Then,
about 30 seconds and no rebuild, type the environment's
name when the first command waits:

```sh
read -r EXCERPT_ENVIRONMENT
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --set-env-vars "KA_EXCERPT_ENVIRONMENT=$EXCERPT_ENVIRONMENT" --revision-suffix excerpt$(date +%H%M%S)
```

The trial is gone again with:

```sh
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-test-weu \
  --remove-env-vars KA_EXCERPT_ENVIRONMENT --revision-suffix excerpt$(date +%H%M%S)
```

A new revision signs everyone out with Ansattporten, as every rollout does. The template takes
the same as `kaExcerptEnvironment`, empty by default.

## Deploying from scratch

Only needed if the resource group is gone.

```sh
az group create --subscription Altinn-AI-Assistant -n rg-ka-test-weu -l westeurope
az acr build --subscription Altinn-AI-Assistant --registry sharedregistryswc --image ka-app:$(git rev-parse --short HEAD) --file src/Dockerfile src
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test-weu --template-file src/deploy/main.bicep --parameters ...
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

Parameters the template needs are declared with `@description` in
`main.bicep`. The ones that are not obvious: `digdirDatasetConfigKey` is
`kudos` on the hosted backend and `default` locally, and `publicHost` is the
custom domain, which decides `APP_ORIGIN` and the Entra callback.

`digdirApiBase`, `digdirTool` and `digdirAgentId` choose the backend. They
default to headless-rag. For genki-test: `https://api.genki-test.digdir.cloud`,
`kunnskapsassistenten__default` and `kunnskapsassistenten`, with
`digdirDatasetConfigKey` set to `default` and `digdirApiKey` a genki service key
for `kunnskapsassistenten`, made by an Entra ID login (genki-test is locked).
On a running deployment the same switch is
`--set-env-vars DIGDIR_API_BASE=… DIGDIR_TOOL=… DIGDIR_AGENT_ID=… DIGDIR_DATASET_CONFIG_KEY=default`
and the key with `secret set` as above.

`kaFilterFields` and `kaDataset` are the dataset's filter fields and its name,
passed as `KA_FILTER_FIELDS` and `KA_DATASETS` under `digdirDatasetConfigKey`.
They default to Kudos: `documentType:type|organisation:orgs_long|year:concerned_years:integer`
and `Kudos`. The year needs `integer`, or it finds nothing. Another dataset
needs its own fields, and an empty `kaFilterFields` means no filter panel.

## Known limits

**Questions do not answer on the deployed instance.**
`test.rag.digdir.cloud` rejects `agent-rag-graph-bundled` and
`agent-rag-graph-faithful` with `mode_not_allowed`, and `simple-qa` returns
`isError` with an empty answer. Only `fact-checker` and `retrieve-only` work
there, and neither is the product. Verified with two API keys, one granting
all five agents explicitly, so it is the backend's configuration and not a key
scope. A local backend exposes nine agent and mode pairs including the ones
needed.

**Filters are disabled.** The capability probe finds the hosted backend drops
caller-supplied filters, so the chips render disabled with an explanation.
They enable themselves once the backend takes filters, with no redeploy.
`kaCapabilities=filters` forces them on if the probe cannot get an answer.
Against a slow backend the probe can stay unsettled for about 9 minutes
(three tries of 60 s, 1 and 5 minutes apart), with the filters hidden, and
then answers no until the app restarts.

**The hosted dataset key is `kudos`, not `default`.** Getting it wrong fails
every call with "API key is not allowed to access the requested dataset",
which reads like a permissions problem.

## Choices worth knowing about

**`minReplicas: 1`, not scale to zero.** A cold start would make the first
question of the day pay for boot and re-run the capability probe.

**Ingress timeout is the default 240 s.** One turn streams for 30 to 90 s. If
turns get slower this is the setting that cuts them off, and it will look like
a frontend bug.

**Secrets are Container Apps secrets, not Key Vault.** One fewer moving part
for a test environment. The managed identity is already there if that changes.
