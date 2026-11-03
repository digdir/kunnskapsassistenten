@description('Base name; resources get suffixes from it.')
param name string = 'ka-app'
param location string = resourceGroup().location

@description('Image in ACR, e.g. sharedregistryswc.azurecr.io/ka-app:sha-abc1234')
param image string
param acrLoginServer string

@description('Backend the BFF talks to: headless-rag (`https://test.rag.digdir.cloud`) or genki (`https://api.genki-test.digdir.cloud`).')
param digdirApiBase string = 'https://test.rag.digdir.cloud'

@description('The tool the BFF asks. genki: `kunnskapsassistenten__default`.')
param digdirTool string = 'builtin.agent-rag-agent__agent-rag-graph-bundled'

@description('The agent new conversations belong to. genki: `kunnskapsassistenten`.')
param digdirAgentId string = 'builtin/agent-rag-agent'

param digdirTenant string = 'public-sector-knowledge'

@description('Hosted headless-rag uses `kudos`; a local backend and genki use `default`.')
param digdirDatasetConfigKey string = 'kudos'

@description('The dataset\'s filter fields, as `id:field[:valueType[:label]]|…` with id documentType, organisation or year. The year needs `integer`, or it finds nothing. Empty: no filter panel.')
param kaFilterFields string = 'documentType:type|organisation:orgs_long|year:concerned_years:integer'

@description('The dataset\'s name in the client, as `Name` or `Name|description`.')
param kaDataset string = 'Kudos'

@description('Sign-in: `entra` (Entra ID, the service key to the backend) or `ansattporten` (the person\'s token to genki). `off` is local development only.')
@allowed(['entra', 'ansattporten'])
param authMode string = 'entra'

@description('Entra ID app registration, for `authMode` `entra`.')
param azureTenantId string = tenant().tenantId
param azureClientId string = ''

@description('Ansattporten, for `authMode` `ansattporten`. The client is confidential (client_secret_basic), with the redirect URI `https://<host>/auth/callback`.')
param ansattportenIssuer string = 'https://test.ansattporten.no'
param ansattportenClientId string = ''
@description('The API the token is for, sent as `resource`.')
param ansattportenAudience string = 'digdir:genai'
@description('The Altinn resource in `authorization_details`. genki-test: `urn:altinn:resource:digdir-genai-platform-test`.')
param ansattportenAltinnResource string = ''

@description('Custom domain users reach the app on. Empty uses the Container Apps default domain.')
param publicHost string = ''

@description('Required with `entra`. With `ansattporten` only the capability probe uses it, and it may be empty.')
@secure()
param digdirApiKey string = ''
@secure()
param azureClientSecret string = ''
@secure()
param ansattportenClientSecret string = ''
@secure()
param sessionSecret string
@secure()
param typesenseApiKey string = ''

param typesenseHost string = ''
param kudosDocsCollection string = ''

@description('What the capability probe would find, forced: `filters` or `no-filters`. Empty lets the probe decide.')
param kaCapabilities string = ''

@description('The client a browser without the `ka_klient` cookie gets: `ny` (apps/web) or `gammel` (apps/web-preact). Empty: `gammel`.')
@allowed(['', 'ny', 'gammel'])
param kaDefaultClient string = ''

var appHost = empty(publicHost) ? '${name}.${containerEnv.properties.defaultDomain}' : publicHost
var ansattporten = authMode == 'ansattporten'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-id'
  location: location
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8787
        transport: 'auto'
        // The Ansattporten tokens are kept in the replica that signed the person in.
        stickySessions: { affinity: ansattporten ? 'sticky' : 'none' }
      }
      registries: [
        { server: acrLoginServer, identity: identity.id }
      ]
      secrets: concat(
        [
          { name: 'session-secret', value: sessionSecret }
        ],
        empty(digdirApiKey) ? [] : [ { name: 'digdir-api-key', value: digdirApiKey } ],
        ansattporten
          ? [ { name: 'ansattporten-client-secret', value: ansattportenClientSecret } ]
          : [ { name: 'azure-client-secret', value: azureClientSecret } ],
        empty(typesenseApiKey) ? [] : [ { name: 'typesense-key', value: typesenseApiKey } ]
      )
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(
            [
              { name: 'PORT', value: '8787' }
              { name: 'DIGDIR_API_BASE', value: digdirApiBase }
              { name: 'DIGDIR_TOOL', value: digdirTool }
              { name: 'DIGDIR_AGENT_ID', value: digdirAgentId }
              { name: 'DIGDIR_TENANT', value: digdirTenant }
              { name: 'DIGDIR_DATASET_CONFIG_KEY', value: digdirDatasetConfigKey }
              { name: 'APP_ORIGIN', value: 'https://${appHost}' }
              { name: 'SESSION_SECRET', secretRef: 'session-secret' }
              { name: 'TYPESENSE_API_HOST', value: typesenseHost }
              { name: 'KUDOS_DOCS_COLLECTION', value: kudosDocsCollection }
              { name: 'AUTH_MODE', value: authMode }
            ],
            empty(digdirApiKey) ? [] : [
              { name: 'DIGDIR_API_KEY', secretRef: 'digdir-api-key' }
            ],
            ansattporten ? [
              { name: 'ANSATTPORTEN_ISSUER', value: ansattportenIssuer }
              { name: 'ANSATTPORTEN_CLIENT_ID', value: ansattportenClientId }
              { name: 'ANSATTPORTEN_CLIENT_SECRET', secretRef: 'ansattporten-client-secret' }
              { name: 'ANSATTPORTEN_REDIRECT_URI', value: 'https://${appHost}/auth/callback' }
              { name: 'ANSATTPORTEN_AUDIENCE', value: ansattportenAudience }
              { name: 'ANSATTPORTEN_ALTINN_RESOURCE', value: ansattportenAltinnResource }
            ] : [
              { name: 'AZURE_TENANT_ID', value: azureTenantId }
              { name: 'AZURE_CLIENT_ID', value: azureClientId }
              { name: 'AZURE_CLIENT_SECRET', secretRef: 'azure-client-secret' }
              { name: 'AZURE_REDIRECT_URI', value: 'https://${appHost}/auth/callback' }
            ],
            empty(typesenseApiKey) ? [] : [
              { name: 'TYPESENSE_API_KEY_ADMIN', secretRef: 'typesense-key' }
            ],
            empty(kaCapabilities) ? [] : [
              { name: 'KA_CAPABILITIES', value: kaCapabilities }
            ],
            empty(kaFilterFields) ? [] : [
              { name: 'KA_FILTER_FIELDS', value: '${digdirDatasetConfigKey}=${kaFilterFields}' }
            ],
            empty(kaDataset) ? [] : [
              { name: 'KA_DATASETS', value: '${digdirDatasetConfigKey}=${kaDataset}' }
            ],
            empty(kaDefaultClient) ? [] : [
              { name: 'KA_DEFAULT_CLIENT', value: kaDefaultClient }
            ]
          )
          probes: [
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 8787 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: ansattporten ? 1 : 3 }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output redirectUri string = 'https://${appHost}/auth/callback'
output principalId string = identity.properties.principalId
