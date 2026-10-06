// Vår egen digdir-headless-rag i testmiljøet: backenden frontenden spør når
// den står i live. Samme bilde og samme korpus som lokalt (tenant `kudos`,
// datasett `kudos-full` mot den eksterne Typesense-instansen), i det samme Container
// Apps-miljøet som frontenden, og bare med intern adresse.
//
// Lages i tillegg til main.bicep, som må være kjørt først: miljøet og
// registeret er `existing` her. Oppskriften er docs/deploy-backend.md, og den
// kjøres i to omganger:
//   1. uten `withApp`: Postgres, delingen og seed-jobben, så databasen kan
//      seedes før noen server har den åpen;
//   2. med `withApp=true`: selve backenden.
//
// Databasen er Datahike i Postgres (Flexible Server), med headless-rags egen
// jdbc-backend. Datahike tåler én skriver, og derfor er det én replika, og
// jobben kjøres bare når appen ikke finnes.
//
// Ikke på Azure Files: Datahikes filbackend skriver en ny fil og gir den det
// gamle navnet, og SMB på Azure Files nekter det. Målt av dirigenten 28.09:
// seed-jobben feilet med AccessDeniedException på `.ksv.new -> .ksv`.
// Delingen har nå bare seed-skriptet.
//
// IKKE KJØRT. Bevist lokalt i samme form under Colima, se «Prøve det lokalt» i
// docs/deploy-backend.md.

@description('Backendens navn. Frontenden når den på http://<navn> inne i miljøet.')
param name string = 'ka-rag-test'
param location string = resourceGroup().location

@description('Miljøet main.bicep laget.')
param environmentName string = 'ka-frontend-test-env'

@description('Registeret main.bicep laget, med admin-brukeren på. Samme uttrykk som der, så standarden treffer i samme ressursgruppe.')
param registryName string = 'kafrontend${uniqueString(resourceGroup().id)}'

@description('Taggen på headless-rag-bildet, som er commit-sha-en det er bygget fra.')
@minLength(7)
param imageTag string

@description('Uten denne lages bare lagringen og seed-jobben. Appen lages når databasen er seedet.')
param withApp bool = false

@description('Lagringskontoen. Globalt unikt navn, derfor avledet av ressursgruppa.')
@minLength(3)
@maxLength(24)
param storageAccountName string = 'karag${uniqueString(resourceGroup().id)}'

@description('Delingen seed-skriptet ligger på. Navnet er fra da databasen lå der.')
param shareName string = 'ka-rag-db'

@description('Postgres-serveren. Globalt unikt navn, derfor avledet av ressursgruppa.')
param postgresServerName string = '${name}-${uniqueString(resourceGroup().id)}'

param postgresAdminLogin string = 'karagadmin'

@description('Databasen Datahike bruker, og tabellen i den.')
param postgresDatabase string = 'datahike'

param tenant string = 'kudos'
param dataset string = 'kudos-full'

@description('Typesense-instansen korpuset ligger i, som vert:port uten skjema.')
param typesenseHost string
param typesenseTls string = 'true'
param collectionPrefix string
param docsCollection string
param chunksCollection string
param phrasesCollection string

param colbertApiUrl string

param azureOpenAiEndpoint string
param azureOpenAiDeployment string

@secure()
@description('Krypterer hemmelighetene i config-databasen. Mistes den, kan de ikke leses igjen.')
param configMasterKey string

@secure()
param jwtSecret string

@secure()
@description('Nøkkelen frontenden bruker. «rag_» og 64 heksadesimale tegn.')
param apiKey string

@secure()
param azureOpenAiApiKey string

@secure()
param typesenseApiKeyAdmin string

@secure()
param colbertApiKey string

@secure()
@description('Admin-passordet til Postgres. Azure krever 8–128 tegn fra minst tre av: store, små, sifre, andre tegn.')
param postgresAdminPassword string

resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' existing = {
  name: registryName
}

var image = '${registry.properties.loginServer}/${name}:${imageTag}'

// Bildet hentes med registerets admin-bruker, ikke med en identitet: en
// identitet trenger AcrPull, og den rollen kan ingen av oss gi (Contributor gir
// ikke rett til å tildele roller). main.bicep slår admin-brukeren på. Passordet
// hentes her, ved utrulling, og står aldri i oppskriften eller i en variabel.
var registryLogin = [
  {
    server: registry.properties.loginServer
    username: registry.name
    passwordSecretRef: 'registry-password'
  }
]
var registrySecret = { name: 'registry-password', value: registry.listCredentials().passwords[0].value }

// Postgres for Datahike. Burstable B1ms er det minste som finnes, og
// databasen er 12 MB etter seeding og én tråd (målt lokalt).
//
// Offentlig adresse, fordi miljøet fra main.bicep ikke er i et eget virtuelt
// nettverk. Brannmurregelen under slipper bare inn fra Azure, men fra hele
// Azure og ikke bare fra vårt miljø; passordet og TLS er det som skiller.
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresServerName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
  }
}

// Barna etter hverandre og ikke samtidig: en Flexible Server tar én endring
// om gangen og avviser resten mens den holder på.
resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: postgresDatabase
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// 0.0.0.0–0.0.0.0 er Azures egen måte å si «tjenester i Azure».
resource postgresAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
  dependsOn: [postgresDb]
}

// På som standard, men satt her så det står og ikke kan skrus av i
// portalen uten at malen skrur det på igjen.
resource postgresTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'require_secure_transport'
  properties: { value: 'on', source: 'user-override' }
  dependsOn: [postgresAzureServices]
}

// Container Apps monterer Azure Files med kontonøkkelen, så den må være på.
// Ingen blob-tilgang utenfra; kontoen har bare delingen.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
  }
}

// En slettet deling kan hentes tilbake i sju dager.
resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    shareDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

// SMB, fordi NFS i Container Apps krever et miljø i eget virtuelt nettverk,
// og det har ikke miljøet fra main.bicep.
resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: shareName
  properties: {
    enabledProtocols: 'SMB'
    shareQuota: 10
  }
}

resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: containerEnv
  name: shareName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: share.name
      accessMode: 'ReadWrite'
    }
  }
}

// Bare jobben monterer delingen, og bare for å lese seed-skriptet.
var seedVolume = { name: 'seed', storageType: 'AzureFile', storageName: envStorage.name }
var seedMount = { volumeName: 'seed', mountPath: '/seed' }

// Standard er en fjerdedel av minnet til heapen. Et svar med agenten bruker
// mer enn det, og containeren har ikke annet å bruke minnet til.
var jvmEnv = { name: 'JAVA_TOOL_OPTIONS', value: '-XX:MaxRAMPercentage=75' }

// Uten DATAHIKE_FILE_PATH, og med ADH_POSTGRES_URL, velger headless-rag
// jdbc-backenden (`load-bootstrap-config` i digdir.config.core). Passordet
// står i en secret og ikke i adressen. `sslmode=require` krever TLS fra vår
// side også.
var bootstrapEnv = [
  {
    name: 'ADH_POSTGRES_URL'
    value: 'jdbc:postgresql://${postgres.properties.fullyQualifiedDomainName}:5432/${postgresDatabase}?sslmode=require'
  }
  { name: 'ADH_POSTGRES_USER', value: postgresAdminLogin }
  { name: 'ADH_POSTGRES_PWD', secretRef: 'postgres-password' }
  { name: 'ADH_POSTGRES_TABLE', value: postgresDatabase }
  { name: 'CONFIG_MASTER_KEY', secretRef: 'config-master-key' }
  { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
  jvmEnv
]

// Seed-jobben: scripts/kudos-full/seed.clj fra headless-rag-grenen, som
// oppskriften legger på delingen, og som jobben leser fra /seed. Den skriver tenanten, datasettet og
// tjenestene (Typesense, ColBERT, Azure OpenAI) inn i config-databasen,
// kryptert med CONFIG_MASTER_KEY, og avslutter med et frasesøk som må gi treff.
//
// Vakta foran skriptet (`refuse-if-server-running!`) avslutter med 1 hvis appen
// svarer på /up. En seeding mens appen står, melder suksess og mister
// skrivingen (headless-rag #493). Adressen er appens interne navn, fordi
// vaktas egne standardadresser gjelder docker compose.
//
// Vakta er en reserve, ikke en stopper: den slipper gjennom på alt annet enn
// 2xx innen 500 ms, altså også på en omdirigering, mens appen starter og når
// navnet ikke slås opp. Oppskriften kjører derfor jobben bare når appen ikke
// finnes.
resource seedJob 'Microsoft.App/jobs@2024-03-01' = {
  name: '${name}-seed'
  location: location
  dependsOn: [postgresTls]
  properties: {
    environmentId: containerEnv.id
    configuration: {
      triggerType: 'Manual'
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      replicaTimeout: 1800
      // Ingen ny runde av seg selv: en ny kjøring over en tenant som alt er
      // seedet, er ikke prøvd.
      replicaRetryLimit: 0
      registries: registryLogin
      secrets: [
        registrySecret
        { name: 'config-master-key', value: configMasterKey }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'azure-openai-api-key', value: azureOpenAiApiKey }
        { name: 'typesense-api-key-admin', value: typesenseApiKeyAdmin }
        { name: 'colbert-api-key', value: colbertApiKey }
        { name: 'postgres-password', value: postgresAdminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'seed'
          image: image
          command: ['java']
          args: [
            '-cp'
            '/app/app.jar'
            'clojure.main'
            '-e'
            '(require \'digdir.setup.common) (digdir.setup.common/refuse-if-server-running! "seed-kudos-full.clj")'
            '/seed/seed-kudos-full.clj'
          ]
          resources: { cpu: json('1'), memory: '2Gi' }
          env: concat(bootstrapEnv, [
            { name: 'DIGDIR_SEED_GUARD_ADDRESSES', value: '${name}:80' }
            { name: 'KUDOS_TENANT', value: tenant }
            { name: 'KUDOS_DATASET', value: dataset }
            { name: 'KUDOS_COLLECTION_PREFIX', value: collectionPrefix }
            { name: 'KUDOS_DOCS_COLLECTION', value: docsCollection }
            { name: 'KUDOS_CHUNKS_COLLECTION', value: chunksCollection }
            { name: 'KUDOS_PHRASES_COLLECTION', value: phrasesCollection }
            { name: 'TYPESENSE_API_HOST', value: typesenseHost }
            { name: 'TYPESENSE_API_TLS', value: typesenseTls }
            { name: 'TYPESENSE_COLLECTION_PREFIX', value: collectionPrefix }
            { name: 'TYPESENSE_API_KEY_ADMIN', secretRef: 'typesense-api-key-admin' }
            { name: 'COLBERT_API_URL', value: colbertApiUrl }
            { name: 'COLBERT_API_KEY', secretRef: 'colbert-api-key' }
            { name: 'AZURE_OPENAI_USE_AZURE', value: 'true' }
            { name: 'AZURE_OPENAI_API_ENDPOINT', value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: azureOpenAiDeployment }
            { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }
          ])
          volumeMounts: [seedMount]
        }
      ]
      volumes: [seedVolume]
    }
  }
}

// Backenden. Tjenestenøklene får den ikke: de ligger i config-databasen etter
// seedingen, og serveren leser dem derfra. Den trenger bare nøklene som åpner
// databasen, og nøkkelen frontenden bruker.
//
// `E2E_API_KEY` er headless-rags krok for første oppstart
// (`digdir.e2e.seed/maybe-seed!`): ved hver oppstart legger den inn de
// innebygde agentene og lagrer akkurat denne verdien som API-nøkkel, med
// scope `query` og uten grense for tenant, datasett, agent eller modus. Hva det
// betyr, står i docs/deploy-backend.md, «Nøkkelen».
resource app 'Microsoft.App/containerApps@2024-03-01' = if (withApp) {
  name: name
  location: location
  dependsOn: [postgresTls]
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8080
        transport: 'auto'
        // Frontenden kaller http://<navn>. Uten denne omdirigerer ingressen
        // http til https (Microsofts dokumentasjon for `allowInsecure`), og et
        // POST som følger en 301, blir et GET. Ikke målt i Azure. Adressen
        // finnes bare inne i miljøet.
        allowInsecure: true
      }
      registries: registryLogin
      secrets: [
        registrySecret
        { name: 'config-master-key', value: configMasterKey }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'api-key', value: apiKey }
        { name: 'postgres-password', value: postgresAdminPassword }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: { cpu: json('2'), memory: '4Gi' }
          env: concat(bootstrapEnv, [
            { name: 'TENANT', value: tenant }
            { name: 'DATASET_CONFIG_KEY', value: dataset }
            { name: 'E2E_API_KEY', secretRef: 'api-key' }
          ])
          // /up svarer først når oppstarten er ferdig: skjema, agenter og
          // nøkkel skrives før serveren lytter.
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/up', port: 8080 }
              initialDelaySeconds: 30
              periodSeconds: 10
              failureThreshold: 10
            }
            {
              type: 'Readiness'
              httpGet: { path: '/up', port: 8080 }
              periodSeconds: 10
            }
            {
              type: 'Liveness'
              httpGet: { path: '/up', port: 8080 }
              periodSeconds: 30
              failureThreshold: 3
            }
          ]
        }
      ]
      // Én, fordi databasen tåler én skriver. Aldri null: en kaldstart her tar
      // like lang tid som oppstarten over.
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

@description('Adressen frontenden bruker som DIGDIR_API_BASE.')
output apiBase string = 'http://${name}'
output storageAccountName string = storage.name
output shareName string = share.name
output seedJobName string = seedJob.name
output postgresServer string = postgres.properties.fullyQualifiedDomainName
