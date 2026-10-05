// Testmiljø for KA-frontenden: én Container App med den bygde klienten og
// serveren som holder API-nøkkelen, og en identitet GitHub ruller ut med.
//
// Kopi av Nikolais `src/deploy/main.bicep` fra digdir/kunnskapsassistenten,
// tilpasset vår app. Det som er tatt bort er Supabase, Typesense og
// øktnøkkelen. Innlogging med Entra er plattformens egen («Easy Auth») og slås
// på med `entraClientId`; uten den er appen åpen som før. Se «Innlogging» i
// docs/deploy.md.
//
// Kjøres i to omganger, se «Første gang» i docs/deploy.md:
//   1. uten `imageTag`: register, miljø, logger og begge identitetene, så
//      rollene kan gis før appen finnes og første henting av bildet ikke feiler;
//   2. med `imageTag`: selve appen.
//
// Registeret er vårt eget og ikke det delte `altinnaicontainers`. Der bygger
// også Nikolais `ka-app`, og AcrPush på det registeret ville latt en kjøring
// fra `main` her overskrive bildene hans. Grunnlaget står i docs/deploy.md,
// «Hvorfor eget register».
//
// IKKE KJØRT. Første utrulling gjør et menneske med Contributor på
// ressursgruppa; rolletildelingene er et eget steg fordi de krever Owner eller
// User Access Administrator, som malen ikke kan anta.

@description('Grunnnavn. Ressursene får suffikser av det.')
param name string = 'ka-frontend-test'
param location string = resourceGroup().location

@description('Taggen på bildet i vårt register, som er commit-sha-en. Tom = bare grunnmuren, ingen app.')
param imageTag string = ''

@description('Registerets navn. Globalt unikt i Azure, derfor avledet av ressursgruppa.')
@minLength(5)
@maxLength(50)
param registryName string = 'kafrontend${uniqueString(resourceGroup().id)}'

@description('Repoet som får rulle ut, som «eier/navn». Byttes den dagen repoet flyttes til digdir.')
param githubRepository string = 'larsekhansen/kunnskapsassistenten-frontend'

@description('Backenden serveren snakker med.')
param digdirApiBase string = 'https://test.rag.digdir.cloud'

@description('`mock` svarer fra fixturer og trenger ingen backend eller nøkkel. `live` spør på ekte.')
@allowed(['mock', 'live'])
param kaMode string = 'mock'

@description('Hostet backend bruker `kudos`; en lokal bruker `default`.')
param datasetConfigKey string = 'kudos'

@description('Tenant og datasettnøkkel er begge eller ingen: backenden forkaster én alene.')
param tenant string = 'digdir'

@description('Korpusene velgeren tilbyr: "nøkkel=Navn|beskrivelse;nøkkel=Navn". Tom = ett korpus og ingen velger.')
param datasets string = ''

@description('Hva hvert korpus kaller filterdimensjonene: "datasett=dimensjon:felt|dimensjon:felt:verditype;…". En dimensjon uten oppføring filtreres det ikke på.')
param filterFields string = 'kudos=documentType:type|organisation:orgs_long|year:concerned_years:integer'

@description('Hvor hvert korpus sine dokumenter kan leses: "datasett=mal for tall|mal for UUID;…", med {doc_num} der nummeret står. Et datasett uten oppføring får ingen lenke.')
param documentUrls string = 'kudos=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}'

@description('Tom i mock. Da får appen verken secret eller variabel.')
@secure()
param digdirApiKey string = ''

@description('Klient-ID-en til app-registreringen innloggingen bruker. Tom = ingen innlogging.')
param entraClientId string = ''

@description('Client secret til registreringen. Må være med når entraClientId er satt.')
@secure()
param entraClientSecret string = ''

@description('Tenanten registreringen ligger i. Standard er tenanten abonnementet hører til.')
param entraTenantId string = subscription().tenantId

@description('Hvordan appen henter bildet: `identity` med AcrPull (krever noen som kan gi roller), eller `admin` med registerets eget passord (holder med Contributor).')
@allowed(['identity', 'admin'])
param registryAuth string = 'identity'

@description('Den delte hemmeligheten i lenken ?secret=. Tom = ingen port. Se «Delt hemmelighet» i docs/deploy.md.')
@secure()
param accessSecret string = ''

@description('Registerets admin-bruker. På som standard: backenden (deploy/rag.bicep) henter bildet med passordet, og en kjøring uten test.bicepparam skal ikke slå det av. Av bare når ingenting i ressursgruppa bruker passordet.')
param registryAdminUser bool = true

@description('Adressene som slipper inn, i CIDR-form ("1.2.3.4/32"). Tom = ingen begrensning.')
param allowedIps array = []

@description('Typesense for fasettene i filterpanelet, med skjema og port. Tom = ingen fasetter; se «Fasettene i filterpanelet» i docs/deploy.md.')
param typesenseUrl string = ''

@description('Nøkkelen til Typesense. En søkenøkkel for dokument- og bitsamlingene holder. Blir Container Apps-secret.')
@secure()
param typesenseApiKey string = ''

@description('Dokumentsamlingen per datasett: "datasett=samling;…".')
param facetCollections string = ''

@description('Bitsamlingen per datasett, for teksten i utdragene: "datasett=samling;…". Tom = utdragene sier at teksten ikke kunne hentes; se «Teksten i utdragene» i docs/deploy.md.')
param chunkCollections string = ''

// Uten nøkkel står både secret og variabel utenfor. Det er ikke målt om
// Container Apps godtar en secret med tom verdi, og en app i mock har ingen
// bruk for en; utelatt er riktig uansett hva svaret er.
var hasKey = !empty(digdirApiKey)

// Innloggingen er på når klient-ID-en er gitt, og da må secreten også være
// det. Uten secret bruker plattformen implisitt flyt, som Microsoft fraråder,
// og det skal ikke skje fordi noen glemte en parameter ved en ny kjøring.
var hasLogin = !empty(entraClientId)
var loginSecretName = 'microsoft-provider-authentication-secret'
var loginSecret = hasLogin && empty(entraClientSecret)
  ? fail('entraClientId er satt uten entraClientSecret. Se «Innlogging» i docs/deploy.md.')
  : entraClientSecret

// Adresselista, sjekket før den brukes. Nøyaktig én `/`, en adresse foran
// den, og et prefiks som ikke begynner på 0, ikke har mellomrom og ikke er
// bredere enn /8. `"/32"` er det en feilet `curl` i oppskriften ga, og `/0`
// (eller `/000`) slipper inn alle; begge ville ellers sett ut som en liste og
// latt nøkkelen passere under (KA CC på #169). Strengsjekker og ikke `int()`,
// fordi et element uten `/` ellers ville feilet på tallet i stedet for med
// meldingen. Om det foran `/` er en adresse, avgjør ARM.
var badRanges = filter(
  allowedIps,
  range =>
    length(split(range, '/')) != 2 || startsWith(range, '/') || startsWith(last(split(range, '/')), '0') || contains(
      last(split(range, '/')),
      ' '
    ) || contains(['', '1', '2', '3', '4', '5', '6', '7'], last(split(range, '/')))
)
var checkedRanges = empty(badRanges)
  ? allowedIps
  : fail(format('allowedIps må være adresser i CIDR-form, ikke bredere enn /8. Avvist: {0}', join(badRanges, ', ')))

// Den delte hemmeligheten, trimmet som serveren trimmer den. Bare mellomrom
// er av der, og skal ikke telle som vern her (KA CC på #171). Serveren nekter
// å starte med en kortere enn 24 tegn (server/access.ts); her stopper
// utrullingen før det, med en melding i stedet for en revisjon som aldri blir
// klar.
var trimmedAccessSecret = trim(accessSecret)
var hasAccessSecret = !empty(trimmedAccessSecret)
var checkedAccessSecret = hasAccessSecret && length(trimmedAccessSecret) < 24
  ? fail('accessSecret er kortere enn 24 tegn. Se «Delt hemmelighet» i docs/deploy.md.')
  : trimmedAccessSecret

// En nøkkel skal ha noe foran seg: innloggingen, en adresseliste eller den
// delte hemmeligheten. Uten noen av dem ville den stått på hvert kall fra hvem
// som helst med adressen (KA CC på #169). En glemt parameter blir da en stopp,
// og ikke en åpen app i live.
var apiKey = hasKey && !hasLogin && empty(checkedRanges) && !hasAccessSecret
  ? fail('digdirApiKey er gitt uten entraClientId, allowedIps og accessSecret. Se «Live for én person» i docs/deploy.md.')
  : digdirApiKey

// Registerets passord, lest av malen selv og lagt som secret. Det skrives
// aldri ut: det står ikke i utdataene, og et ternært uttrykk evaluerer bare
// grenen som gjelder, så `listCredentials()` kalles ikke med admin av.
var useAdmin = registryAuth == 'admin' && !registryAdminUser
  ? fail('registryAuth=admin krever registryAdminUser=true.')
  : registryAuth == 'admin'
var registryPasswordSecret = 'registry-password'

// Én regel per adresse. Er alle `Allow`, slipper ingen andre inn.
var ipRules = [
  for (range, index) in checkedRanges: {
    name: 'tillatt-${index}'
    ipAddressRange: range
    action: 'Allow'
  }
]

// Tomme verdier utelates av samme grunn. Serveren leser en tom variabel og en
// manglende likt (`value()` i server/config.ts), så ingenting endrer mening.
var plainEnv = filter(
  [
    { name: 'PORT', value: '8787' }
    { name: 'KA_MODE', value: kaMode }
    { name: 'DIGDIR_API_BASE', value: digdirApiBase }
    { name: 'VITE_KA_TENANT', value: tenant }
    { name: 'VITE_KA_DATASET_CONFIG_KEY', value: datasetConfigKey }
    { name: 'VITE_KA_DATASETS', value: datasets }
    { name: 'VITE_KA_FILTER_FIELDS', value: filterFields }
    { name: 'VITE_KA_DOCUMENT_URLS', value: documentUrls }
    // Bare bak innloggingen. Uten den kan nettleseren sende plattformens
    // hode selv, og da er det ikke en identitet. Se server/identity.ts.
    { name: 'KA_USER_ID_FROM', value: hasLogin ? 'platform' : '' }
    // Fasettene og utdragene fra Typesense (server/facets.ts og
    // server/excerpts.ts). Nøkkelen er i secretene.
    { name: 'TYPESENSE_URL', value: typesenseUrl }
    { name: 'KA_FACET_COLLECTIONS', value: facetCollections }
    { name: 'KA_CHUNK_COLLECTIONS', value: chunkCollections }
  ],
  entry => !empty(entry.value)
)
var hasTypesenseKey = !empty(typesenseApiKey)
var secretEnv = concat(
  hasKey ? [{ name: 'DIGDIR_API_KEY', secretRef: 'digdir-api-key' }] : [],
  hasAccessSecret ? [{ name: 'KA_ACCESS_SECRET', secretRef: 'ka-access-secret' }] : [],
  hasTypesenseKey ? [{ name: 'TYPESENSE_API_KEY', secretRef: 'typesense-api-key' }] : []
)
var secrets = concat(
  hasKey ? [{ name: 'digdir-api-key', value: apiKey }] : [],
  hasLogin ? [{ name: loginSecretName, value: loginSecret }] : [],
  hasAccessSecret ? [{ name: 'ka-access-secret', value: checkedAccessSecret }] : [],
  hasTypesenseKey ? [{ name: 'typesense-api-key', value: typesenseApiKey }] : [],
  useAdmin ? [{ name: registryPasswordSecret, value: registry.listCredentials().passwords[0].value }] : []
)

// Basic: 10 GiB inkludert, og hvert bilde legger bare til de ca. 2 MB som
// endrer seg (målt 28.09). Admin-brukeren følger `registryAdminUser` og ikke
// `registryAuth`: backenden henter med passordet uansett hvordan frontenden
// gjør det, og en kjøring med standardverdiene skal ikke ta det fra den.
//
// Rollemodusen står eksplisitt. Microsoft skal gjøre ABAC til standard for nye
// registre, og der gjelder ikke AcrPull og AcrPush, som er rollene
// docs/deploy.md gir. ABAC ville heller ikke gitt noe her: registeret har bare
// våre egne bilder, så det er ingen andre å skille ut.
resource registry 'Microsoft.ContainerRegistry/registries@2025-11-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: registryAdminUser
    roleAssignmentMode: 'LegacyRegistryPermissions'
  }
}

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

// Appens egen identitet: henter bildet fra vårt register (AcrPull), og
// ingenting annet. Med `registryAuth=admin` er den ubrukt, men står.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-id'
  location: location
}

// Identiteten GitHub Actions logger inn som. Egen, og ikke appens: den som
// kan rulle ut en ny versjon skal ikke være den samme som kjører den.
resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}-deploy'
  location: location
}

// OIDC: en kjøring i repoet får et kortlivet token fra GitHub, og Azure godtar
// det bare for dette subjektet. Ingen hemmelighet ligger i repoet. Bare `main`,
// så en gren eller en PR fra en fork kan ikke rulle ut.
resource github 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployer
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:ref:refs/heads/main'
    audiences: ['api://AzureADTokenExchange']
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = if (!empty(imageTag)) {
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
        // Standardverdien, skrevet ut: innloggingen skal bare brukes over
        // HTTPS, sier Microsoft.
        allowInsecure: false
        // Tom liste er ingen begrensning. Med adresser slipper bare de inn,
        // også til /healthz, så GitHub sin helsesjekk når ikke fram.
        ipSecurityRestrictions: ipRules
        // Ingen timeout satt her, fordi det ikke finnes noen å sette:
        // Container Apps' ingress har 240 sekunder som plattformverdi og
        // eksponerer den ikke i denne API-versjonen. Det holder for et svar
        // som strømmer i 30–90 sekunder, og det er verdt å vite når en tur
        // mot et tregt korpus nærmer seg grensa.
        stickySessions: { affinity: 'none' }
      }
      registries: [
        useAdmin
          ? {
              server: registry.properties.loginServer
              username: registry.listCredentials().username
              passwordSecretRef: registryPasswordSecret
            }
          : { server: registry.properties.loginServer, identity: identity.id }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: name
          image: '${registry.properties.loginServer}/${name}:${imageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(plainEnv, secretEnv)
          probes: [
            {
              type: 'Readiness'
              httpGet: { path: '/healthz', port: 8787 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      // Én replika står alltid oppe. Et testmiljø som skalerer til null
      // svarer først etter en kaldstart, og det er den som demonstrerer noe
      // som betaler for ventetiden.
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

// Plattformens innlogging med Entra, foran alt appen svarer på. Den kjører
// som en sidevogn i hver replika, og serveren ser bare forespørsler som har
// kommet gjennom den, med den innloggede brukeren i X-MS-CLIENT-PRINCIPAL-ID.
//
// Alltid med når appen er det, av eller på som `entraClientId` sier. Malen
// eier da hele tilstanden: en ny kjøring uten innloggingsparameterne slår den
// av, i stedet for å la en gammel klient-ID stå uten secret, fordi en
// inkrementell utrulling ikke sletter noe (KA CC på #169). Av er det samme
// som `az containerapp auth update --enabled false` lager. Ikke prøvd mot
// ARM at bare `platform.enabled: false` godtas.
resource login 'Microsoft.App/containerApps/authConfigs@2024-03-01' = if (!empty(imageTag)) {
  parent: app
  name: 'current'
  properties: hasLogin
    ? {
        platform: { enabled: true }
        globalValidation: {
          unauthenticatedClientAction: 'RedirectToLoginPage'
          // Helsesjekken i deploy.yml spør revisjonens adresse uten å være
          // innlogget, og ville ellers fått en omdirigering til Microsoft.
          // /healthz sier bare `ok` og modusen.
          excludedPaths: ['/healthz']
        }
        identityProviders: {
          azureActiveDirectory: {
            enabled: true
            registration: {
              clientId: entraClientId
              clientSecretSettingName: loginSecretName
              openIdIssuer: '${environment().authentication.loginEndpoint}${entraTenantId}/v2.0'
            }
          }
        }
        httpSettings: { requireHttps: true }
      }
    : { platform: { enabled: false } }
}

output fqdn string = empty(imageTag) ? '' : app!.properties.configuration.ingress.fqdn
@description('Redirect-URI-en app-registreringen må ha. Lik for alle revisjoner.')
output loginRedirectUri string = empty(imageTag)
  ? ''
  : 'https://${app!.properties.configuration.ingress.fqdn}/.auth/login/aad/callback'
@description('Settes som GitHub-variabelen KA_REGISTRY.')
output registryName string = registry.name
output principalId string = identity.properties.principalId
@description('Settes som GitHub-variabelen AZURE_CLIENT_ID.')
output deployClientId string = deployer.properties.clientId
output deployPrincipalId string = deployer.properties.principalId
output tenantId string = deployer.properties.tenantId
