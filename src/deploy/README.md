# Deploying to Azure Container Apps

One container: the Hono server holds the API key, talks to
`digdir-headless-rag`, and serves the built SPA from the same origin. Same
origin is not cosmetic, it is what keeps the session cookie first-party.

**Deployed and in use:** `https://qa.kunnskap.digdir.cloud`
Resource group `rg-ka-app`, Norway East, subscription `Altinn-AI-Assistant`,
images in `altinnaicontainers`. The DNS records for the domain live with
`digdir.cloud` at Porkbun; the certificate is managed by Container Apps.

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

Code change, about three minutes:

```sh
git diff --quiet HEAD || { echo 'uncommitted changes'; exit 1; }
SHA=$(git rev-parse --short HEAD)

az acr build --registry altinnaicontainers --image ka-app:$SHA \
  --file src/Dockerfile src
az containerapp update -n ka-app -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-app:$SHA \
  --revision-suffix sha$SHA
```

Config or a secret, about 30 seconds and no rebuild:

```sh
az containerapp secret set -n ka-app -g rg-ka-app --secrets digdir-api-key=<verdi>
az containerapp update -n ka-app -g rg-ka-app --revision-suffix key$(date +%H%M%S)
```

`secret set` alone changes nothing that is running: the value is only picked up
by a new revision, which the second command forces. Secrets are write-only in
the portal, though `az containerapp secret show` will read one back.

The old revision serves until the new one is healthy, so a bad image does not
take the site down. Roll back by deploying an older tag:

```sh
az containerapp update -n ka-app -g rg-ka-app \
  --image altinnaicontainers.azurecr.io/ka-app:<older-sha> \
  --revision-suffix rollback$(date +%H%M%S)
```

## Deploying from scratch

Only needed if the resource group is gone.

```sh
az group create -n rg-ka-app -l norwayeast
az acr build --registry altinnaicontainers --image ka-app:$(git rev-parse --short HEAD) --file src/Dockerfile src
az deployment group create -g rg-ka-app --template-file src/deploy/main.bicep --parameters ...
```

The first `az deployment group create` **fails** on the image pull. That is
expected: the managed identity does not exist until the template creates it,
and it has no rights to the registry until granted. Grant, then deploy again:

```sh
az role assignment create --role AcrPull \
  --assignee-object-id "$(az identity show -n ka-app-id -g rg-ka-app --query principalId -o tsv)" \
  --assignee-principal-type ServicePrincipal \
  --scope "$(az acr show -n altinnaicontainers --query id -o tsv)"
```

Parameters the template needs are declared with `@description` in
`main.bicep`. The ones that are not obvious: `digdirDatasetConfigKey` is
`kudos` on the hosted backend and `default` locally, and `publicHost` is the
custom domain, which decides `APP_ORIGIN` and the Entra callback.

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
