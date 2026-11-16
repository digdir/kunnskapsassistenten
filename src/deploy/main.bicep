@description('Base name; resources get suffixes from it.')
param name string = 'ka-app'
param location string = resourceGroup().location

@description('Image in ACR, e.g. sharedregistryswc.azurecr.io/ka-app:sha-abc1234')
param image string
param acrLoginServer string

@description('The genki API the server talks to.')
param digdirApiBase string = 'https://api.genki-test.digdir.cloud'

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

@description('The genki service key, required with `entra`. With `ansattporten` it is not used, and may be empty.')
@secure()
param digdirApiKey string = ''
@secure()
param azureClientSecret string = ''
@secure()
param ansattportenClientSecret string = ''
@secure()
param sessionSecret string

@description('The genki service and variant the client asks, `<service>__<variant>`. Empty is `kunnskapsassistenten__default`.')
param kaNextModel string = ''

@description('The genki tenant the client reads collections and facets from. Empty is `digdir`.')
param kaNextTenant string = ''

@description('The layout the client draws, the JSON from genki\'s builder («Kopier oppsettet») or the path of a file holding it (decisions/0017). Empty draws KA\'s own.')
param kaNextLayout string = ''

@description('Testers by session user id (`userId` in `/api/next/me`), separated by commas or spaces: their calls to genki carry `GenAI-Environment` (decisions/0015). Empty: nobody is a tester.')
param kaTesters string = ''

@description('The genki environment testers get. Empty is `test`.')
param kaTestEnvironment string = ''

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
          : [ { name: 'azure-client-secret', value: azureClientSecret } ]
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
              { name: 'APP_ORIGIN', value: 'https://${appHost}' }
              { name: 'SESSION_SECRET', secretRef: 'session-secret' }
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
            empty(kaNextModel) ? [] : [
              { name: 'KA_NEXT_MODEL', value: kaNextModel }
            ],
            empty(kaNextTenant) ? [] : [
              { name: 'KA_NEXT_TENANT', value: kaNextTenant }
            ],
            empty(kaNextLayout) ? [] : [
              { name: 'KA_NEXT_LAYOUT', value: kaNextLayout }
            ],
            empty(kaTesters) ? [] : [
              { name: 'KA_TESTERS', value: kaTesters }
            ],
            empty(kaTestEnvironment) ? [] : [
              { name: 'KA_TEST_ENVIRONMENT', value: kaTestEnvironment }
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
