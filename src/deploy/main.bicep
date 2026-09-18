@description('Base name; resources get suffixes from it.')
param name string = 'ka-app'
param location string = resourceGroup().location

@description('Image in ACR, e.g. altinnaicontainers.azurecr.io/ka-app:sha-abc1234')
param image string
param acrLoginServer string

@description('Backend the BFF talks to.')
param digdirApiBase string = 'https://test.rag.digdir.cloud'

@description('Hosted uses `kudos`; a local backend uses `default`.')
param digdirDatasetConfigKey string = 'kudos'

@description('Which sign-in to deploy. `off` is local development only and is not deployable.')
@allowed(['entra', 'supabase'])
param authMode string

@description('AUTH_MODE=supabase only: the project URL and its anon key.')
param supabaseUrl string = ''

@secure()
param supabasePublishableKey string = ''

@description('Entra ID. Leave clientId empty to run without sign-in, which is only sane for a throwaway environment.')
param azureTenantId string = tenant().tenantId
param azureClientId string = ''

@description('Comma-separated domains allowed to sign in. Empty admits anyone the tenant admits. digdir.no covers 202 accounts here and excludes ai-dev.no ones.')
param allowedEmailDomains string = 'digdir.no'

@secure()
param digdirApiKey string
@secure()
param azureClientSecret string = ''
@secure()
param sessionSecret string
@secure()
param typesenseApiKey string = ''

param typesenseHost string = ''
param kudosDocsCollection string = ''

var supabaseMode = authMode == 'supabase'
var authOn = !empty(azureClientId) || supabaseMode
var appFqdnPlaceholder = '${name}.${containerEnv.properties.defaultDomain}'

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
      ingress: {
        external: true
        targetPort: 8787
        transport: 'auto'
        stickySessions: { affinity: 'none' }
      }
      registries: [
        { server: acrLoginServer, identity: identity.id }
      ]
      secrets: concat(
        [
          { name: 'digdir-api-key', value: digdirApiKey }
          { name: 'session-secret', value: sessionSecret }
        ],
        !empty(azureClientId) ? [ { name: 'azure-client-secret', value: azureClientSecret } ] : [],
        supabaseMode ? [ { name: 'supabase-publishable-key', value: supabasePublishableKey } ] : [],
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
              { name: 'DIGDIR_DATASET_CONFIG_KEY', value: digdirDatasetConfigKey }
              { name: 'APP_ORIGIN', value: 'https://${appFqdnPlaceholder}' }
              { name: 'DIGDIR_API_KEY', secretRef: 'digdir-api-key' }
              { name: 'SESSION_SECRET', secretRef: 'session-secret' }
              { name: 'TYPESENSE_API_HOST', value: typesenseHost }
              { name: 'KUDOS_DOCS_COLLECTION', value: kudosDocsCollection }
            ],
            empty(authMode) ? [] : [ { name: 'AUTH_MODE', value: authMode } ],
            supabaseMode
              ? [
                  { name: 'SUPABASE_URL', value: supabaseUrl }
                  { name: 'SUPABASE_PUBLISHABLE_KEY', secretRef: 'supabase-publishable-key' }
                ]
              : [],
            !empty(azureClientId) ? [
              { name: 'AZURE_TENANT_ID', value: azureTenantId }
              { name: 'AZURE_CLIENT_ID', value: azureClientId }
              { name: 'AZURE_CLIENT_SECRET', secretRef: 'azure-client-secret' }
              { name: 'AZURE_REDIRECT_URI', value: 'https://${appFqdnPlaceholder}/auth/callback' }
            ] : [],
            authOn ? [ { name: 'ALLOWED_EMAIL_DOMAINS', value: allowedEmailDomains } ] : [],
            empty(typesenseApiKey) ? [] : [
              { name: 'TYPESENSE_API_KEY_ADMIN', secretRef: 'typesense-key' }
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
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output redirectUri string = 'https://${app.properties.configuration.ingress.fqdn}/auth/callback'
output principalId string = identity.properties.principalId
