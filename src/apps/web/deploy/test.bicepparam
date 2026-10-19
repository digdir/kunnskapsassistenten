// The test environment in live, for one person behind an address list or the
// shared secret, without Entra and without anyone who can grant roles. The
// recipe is «Live for one person» in docs/deploy.md.
//
// No secrets here. The keys, the image and the addresses that get in are read
// from environment variables when the template runs, so the file can be
// checked in, and a new run does not put the app back into mock.
//
// Never build it with `az bicep build-params` while the variables are set.
// Without `--stdout` it writes deploy/test.json with the keys in plain text
// (measured by KA CC on #169). `az deployment group create` builds it in
// memory. deploy/*.json is in .gitignore, but the file stays on the disk.
using './main.bicep'

param name = 'ka-frontend-test'

// The image's commit sha. Empty = only the foundation, without the app.
param imageTag = readEnvironmentVariable('KA_IMAGE_TAG', '')

// The registry's password, because AcrPull needs someone who can grant roles.
param registryAuth = 'admin'

// genki-test, the platform's test environment (src/decisions/0010). Kudos is
// tenant digdir and dataset kudos there, the names genki gives it.
param kaMode = 'live'
param digdirApiBase = 'https://api.genki-test.digdir.cloud'
param tool = 'kunnskapsassistenten__default'
param tenant = 'digdir'
param datasetConfigKey = 'kudos'
// The name the panel shows. Without it the panel shows the key «kudos».
param datasets = 'kudos=Kudos|10 064 dokumenter fra kudos.dfo.no'
param filterFields = 'kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer'
// A number gives a 301 to the document under /documents/, and a UUID is under
// /dokument/ (measured 30.09).
param documentUrls = 'kudos=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}'

// The genki key, kept as the secret genki-api-key. The headless-rag key stays
// as digdir-api-key for a rollback when KA_ROLLBACK_API_KEY is given; without
// it a run leaves that secret out, and it is gone. See «Rolling back» in
// docs/deploy.md.
param digdirApiKey = readEnvironmentVariable('DIGDIR_API_KEY', '')
param apiKeySecretName = 'genki-api-key'
param rollbackApiKey = readEnvironmentVariable('KA_ROLLBACK_API_KEY', '')

// The shared secret in the link: «Delt hemmelighet» in docs/deploy.md. With it
// the address list is not needed.
param accessSecret = readEnvironmentVariable('KA_ACCESS_SECRET', '')

// Comma-separated, in CIDR form: "1.2.3.4/32,5.6.7.8/32". The template stops if
// the key is set and both the list and the secret are empty.
param allowedIps = map(
  filter(split(readEnvironmentVariable('KA_ALLOWED_IPS', ''), ','), range => !empty(trim(range))),
  range => trim(range)
)

// The sign-in, when it comes: «Innlogging» in docs/deploy.md. Empty = off, and
// the template then turns it off even if it was on.
param entraClientId = readEnvironmentVariable('KA_ENTRA_CLIENT_ID', '')
param entraClientSecret = readEnvironmentVariable('KA_ENTRA_CLIENT_SECRET', '')

// The facets in the filter panel and the text of the excerpts, from the Kudos
// collections in the test Typesense: «Fasettene i filterpanelet» and «Teksten i
// utdragene» in docs/deploy.md. Only the search key is read from the
// environment. Without it the panel says filtering is not available, and the
// excerpts that their text could not be fetched.
param typesenseUrl = readEnvironmentVariable('TYPESENSE_URL', 'https://typesense-test.digdir.cloud:443')
param typesenseApiKey = readEnvironmentVariable('TYPESENSE_API_KEY', '')
param facetCollections = readEnvironmentVariable('KA_FACET_COLLECTIONS', 'kudos=KUDOS_preprod_v4_documents_ab897fbdedfa')
param chunkCollections = readEnvironmentVariable('KA_CHUNK_COLLECTIONS', 'kudos=KUDOS_preprod_v4_chunks_ab897fbdedfa')
