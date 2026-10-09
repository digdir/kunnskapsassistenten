# Deploying to Azure Container Apps

One container: the Hono server holds the API key, talks to
`digdir-headless-rag`, and serves the built SPA from the same origin. Same
origin is not cosmetic, it is what keeps the session cookie first-party.

**Deployed and in use:** `https://qa.kunnskap.digdir.cloud`
Resource group `rg-ka-app`, Norway East, subscription `Altinn-AI-Assistant`,
images in `altinnaicontainers`. Every `az` command below names the
subscription, because the one a machine has as its default may be another. The
DNS records for the domain live with `digdir.cloud` at Porkbun; the certificate
is managed by Container Apps.

## What is already set up

Sign-in is Entra ID, app registration `altinn-ai-assistant-ka-sso`, single
tenant, with admin consent granted. Only accounts that exist in the tenant can
sign in, and the app adds no check of its own. `AUTH_MODE=off` is for local
development only: unsigned identity, anyone can be anyone, and the server
refuses to start with it unless `APP_ORIGIN` is localhost.

A new public host needs its `https://<host>/auth/callback` added to the app
registration's redirect URIs before `APP_ORIGIN` and `AZURE_REDIRECT_URI` point
at it.

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

az acr build --subscription Altinn-AI-Assistant --registry altinnaicontainers --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-app:$SHA \
  --revision-suffix sha$SHA
```

**The first rollout of an image with the new client** (`apps/web` and
`apps/web-preact` side by side) needs two variables a deployment from before it
does not have. The path above swaps the image and nothing else: without
`KA_FILTER_FIELDS` the BFF has no facets and no filter panel, and without
`KA_DATASETS` no name for the dataset. Set them in the same update, once, with
the template's defaults under the dataset key `kudos`:

```sh
git status --short
SHA=$(git rev-parse --short HEAD)

az acr build --subscription Altinn-AI-Assistant --registry altinnaicontainers --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-app:$SHA \
  --set-env-vars 'KA_FILTER_FIELDS=kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer' 'KA_DATASETS=kudos=Kudos' \
  --revision-suffix sha$SHA
```

The values are quoted because `|` is a pipe to the shell. `--set-env-vars`
adds or updates the variables it names and leaves the others as they are.
`KA_DEFAULT_CLIENT` is left unset, so a browser without the `ka_klient` cookie
gets the current client; add `KA_DEFAULT_CLIENT=ny` to the same list when the
new one is to be the default. Later rollouts take the path above, and the
variables stay.

Config or a secret, about 30 seconds and no rebuild. `read -rs` reads the
value without showing it or keeping it in the shell history:

```sh
read -rs KEY
az containerapp secret set --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-app --secrets digdir-api-key="$KEY"
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-app --revision-suffix key$(date +%H%M%S)
```

`secret set` alone changes nothing that is running: the value is only picked up
by a new revision, which the second command forces. Secrets are write-only in
the portal, though `az containerapp secret show` will read one back.

The old revision serves until the new one is healthy, so a bad image does not
take the site down. Roll back by deploying an older tag. The first command
lists the five newest; type the one to go back to:

```sh
az acr repository show-tags --subscription Altinn-AI-Assistant --name altinnaicontainers --repository ka-app --orderby time_desc --top 5 -o tsv
read -r OLDER
az containerapp update --subscription Altinn-AI-Assistant -n ka-app -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-app:$OLDER \
  --revision-suffix rollback$(date +%H%M%S)
```

## Deploying from scratch

Only needed if the resource group is gone.

```sh
az group create --subscription Altinn-AI-Assistant -n rg-ka-app -l norwayeast
az acr build --subscription Altinn-AI-Assistant --registry altinnaicontainers --image ka-app:$(git rev-parse --short HEAD) --file src/Dockerfile src
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-app --template-file src/deploy/main.bicep --parameters ...
```

The first `az deployment group create` **fails** on the image pull. That is
expected: the managed identity does not exist until the template creates it,
and it has no rights to the registry until granted. Grant, then deploy again:

```sh
az role assignment create --subscription Altinn-AI-Assistant --role AcrPull \
  --assignee-object-id "$(az identity show --subscription Altinn-AI-Assistant -n ka-app-id -g rg-ka-app --query principalId -o tsv)" \
  --assignee-principal-type ServicePrincipal \
  --scope "$(az acr show --subscription Altinn-AI-Assistant -n altinnaicontainers --query id -o tsv)"
```

Parameters the template needs are declared with `@description` in
`main.bicep`. The ones that are not obvious: `digdirDatasetConfigKey` is
`kudos` on the hosted backend and `default` locally, and `publicHost` is the
custom domain, which decides `APP_ORIGIN` and the Entra callback.

`kaFilterFields` and `kaDataset` are the dataset's filter fields and its name,
passed as `KA_FILTER_FIELDS` and `KA_DATASETS` under `digdirDatasetConfigKey`.
They default to Kudos: `documentType:type|organisation:orgs_long|year:concerned_years:integer`
and `Kudos`. The year needs `integer`, or it finds nothing. Another dataset
needs its own fields, and an empty `kaFilterFields` means no filter panel.

`kaDefaultClient` is the client a browser without the `ka_klient` cookie gets:
`gammel`, the current client in `apps/web-preact`, unless it is set to `ny`,
the client in `apps/web`. The image has both. `?klient=ny` and `?klient=gammel`
switch one browser.

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
