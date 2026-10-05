// Testmiljøet i live, for én person bak en adresseliste, uten Entra og uten
// noen som kan gi roller. Oppskriften er «Live for én person» i
// docs/deploy.md.
//
// Ingen hemmeligheter her. Nøkkelen, bildet og adressene som slipper inn,
// leses fra miljøvariabler når malen kjøres, så fila kan sjekkes inn og en
// ny kjøring setter ikke appen tilbake til mock.
//
// Bygg den aldri med `az bicep build-params` mens miljøvariablene er satt.
// Uten `--stdout` skriver den deploy/test.json med nøkkelen i klartekst
// (målt av KA CC på #169). `az deployment group create` bygger den i
// minnet. deploy/*.json er i .gitignore, men fila blir liggende på disken.
using './main.bicep'

param name = 'ka-frontend-test'

// Commit-sha-en til bildet. Tom = bare grunnmuren, uten app.
param imageTag = readEnvironmentVariable('KA_IMAGE_TAG', '')

// Registerets passord, fordi AcrPull krever noen som kan gi roller.
param registryAuth = 'admin'

// Backenden fra docs/deploy-backend.md: bare intern adresse, i samme miljø.
param kaMode = 'live'
param digdirApiBase = 'http://ka-rag-test'
param tenant = 'kudos'
param datasetConfigKey = 'kudos-full'
// Navnet panelet viser. Uten det står datasettnøkkelen «kudos-full» der.
param datasets = 'kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no'
param filterFields = 'kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer'
// Bitene har doc_num og ingen url. Et tall gir 301 til dokumentet under
// /documents/, og en UUID finnes under /dokument/ (målt 30.09).
param documentUrls = 'kudos-full=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}'

param digdirApiKey = readEnvironmentVariable('DIGDIR_API_KEY', '')

// Den delte hemmeligheten i lenken: «Delt hemmelighet» i docs/deploy.md.
// Med den trengs ikke adresselista.
param accessSecret = readEnvironmentVariable('KA_ACCESS_SECRET', '')

// Kommaseparert, i CIDR-form: "1.2.3.4/32,5.6.7.8/32". Malen stopper hvis
// nøkkelen er satt og både lista og hemmeligheten er tomme.
param allowedIps = map(
  filter(split(readEnvironmentVariable('KA_ALLOWED_IPS', ''), ','), range => !empty(trim(range))),
  range => trim(range)
)

// Innloggingen, når den kommer: «Innlogging» i docs/deploy.md. Tom = av, og
// malen slår den da av også om den var på.
param entraClientId = readEnvironmentVariable('KA_ENTRA_CLIENT_ID', '')
param entraClientSecret = readEnvironmentVariable('KA_ENTRA_CLIENT_SECRET', '')

// Fasettene i filterpanelet og teksten i utdragene: «Fasettene i
// filterpanelet» og «Teksten i utdragene» i docs/deploy.md. Tomme = panelet
// sier at filtrering ikke er tilgjengelig, og utdragene at teksten ikke
// kunne hentes.
param typesenseUrl = readEnvironmentVariable('TYPESENSE_URL', '')
param typesenseApiKey = readEnvironmentVariable('TYPESENSE_API_KEY', '')
param facetCollections = readEnvironmentVariable('KA_FACET_COLLECTIONS', '')
param chunkCollections = readEnvironmentVariable('KA_CHUNK_COLLECTIONS', '')
