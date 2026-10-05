# Egen backend i testmiljøet

Testmiljøets frontend spør vår egen `digdir-headless-rag` i Azure Container
Apps, med samme bilde og samme korpus som lokalt: grenen
`fix/mcp-retrieve-filter-by`, tenant `kudos` og datasett `kudos-full` mot
Benjamins Typesense. Backenden har bare intern adresse, og databasen ligger i
Azure Database for PostgreSQL. Malen er `deploy/rag.bicep`.

**Rullet ut i `rg-ka-test` 28.09.** Backenden kjører på Postgres og svarer
gjennom frontenden. Hva som er målt der, står i
[Målt i Azure 28.09](#målt-i-azure-2809), og hva som ikke er det, i
[Det som ikke er målt](#det-som-ikke-er-målt). Oppsettet ble først prøvd
lokalt i samme form; se [Prøve det lokalt](#prøve-det-lokalt).

`test.rag.digdir.cloud` svarer ikke med agentene (`mode_not_allowed`) og tar
ikke imot filteret, og det er Benjamins oppsett og kode. Derfor en egen backend.

## Hva som lages

I `rg-ka-test`, i miljøet `ka-frontend-test-env` som `deploy/main.bicep` laget:

| Ressurs                     | Hva                                                                   |
| --------------------------- | --------------------------------------------------------------------- |
| `ka-rag-test-vxd2q2aj52lqw` | Postgres Flexible Server 16, Burstable B1ms, 32 GB. Databasen.        |
| `datahike`                  | Databasen og tabellen Datahike bruker.                                |
| `karagvxd2q2aj52lqw`        | Lagringskonto, Standard LRS, bare for delingen.                       |
| `ka-rag-db`                 | Azure Files-deling med seed-skriptet, montert i jobben på `/seed`.    |
| `ka-rag-test-seed`          | Container Apps-jobb, manuell. Seeder tenanten og datasettet.          |
| `ka-rag-test`               | Backenden. Intern ingress på port 8080, én replika, 2 vCPU og 4 GiB.  |
| `ka-rag-test:<commit>`      | Bildet, i registeret `kafrontendvxd2q2aj52lqw` som frontenden bruker. |

Navnene på serveren og lagringskontoen har det samme suffikset som registeret,
fordi alle tre er avledet av ressursgruppa. Delingen heter `ka-rag-db` fordi
databasen lå der først; se [Hvorfor Postgres](#hvorfor-postgres).

Utenfor Azure, som lokalt: Benjamins Typesense, Azure OpenAI (`gpt-5.6-terra`)
og ColBERT.

## Før du begynner

- **Grunnmuren fra `docs/deploy.md`** er rullet ut i `rg-ka-test`, med
  admin-brukeren i registeret slått på. Steg 0 sjekker det.
- **Innlogging eller IP-begrensning foran frontenden** før steg 7. Uten en av
  dem kan alle med adressen bruke tjenesten på vår modellkostnad.
- **Contributor på `rg-ka-test`** holder, og det trengs ingen
  rolletildelinger. Appen og jobben henter bildet med registerets
  admin-bruker, og malen henter passordet selv med `listCredentials()` ved
  utrulling. Delingen monteres med kontonøkkelen, som malen også henter selv.
  Ingen av dem står i oppskriften.
- **På maskinen:** headless-rag-checkouten i
  `~/projects/kunnskapsassistenten/digdir-headless-rag` med `.env`
  (Azure OpenAI-verdiene) og `.env.benjamin` (Typesense og ColBERT), og grenen
  pushet. `git`, `openssl` og `jq`.

**Hver kommando står alene.** Ingen variabel går fra én blokk til den neste.
Det som må følge med, ligger i to filer: commiten i
`~/.cache/ka-rag-test/commit` (steg 1) og verdiene i
`~/.config/ka-rag-test/parameters.json` (steg 2). Hver `az`-kommando begynner
med `--subscription Altinn-AI-Assistant`, og med `-g rg-ka-test` rett etter der
kommandoen tar en ressursgruppe. Kommandoene kjøres fra rota i dette repoet.

## Steg 0: sjekken

```sh
az account show --subscription Altinn-AI-Assistant --query name -o tsv
az provider show --subscription Altinn-AI-Assistant -n Microsoft.Storage --query registrationState -o tsv
az provider show --subscription Altinn-AI-Assistant -n Microsoft.DBforPostgreSQL --query registrationState -o tsv
az containerapp env show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test-env --query properties.provisioningState -o tsv
az acr show --subscription Altinn-AI-Assistant -g rg-ka-test -n kafrontendvxd2q2aj52lqw --query adminUserEnabled -o tsv | grep -qx true && echo "Admin-brukeren er på." || echo "STOPP: admin-brukeren i registeret er av. Ikke gå videre før main.bicep har slått den på."
```

Linjene skal vise `Altinn-AI-Assistant`, `Registered`, `Registered`,
`Succeeded` og «Admin-brukeren er på.». **Står det `STOPP`, går du ikke
videre**: da feiler steg 3 på `listCredentials()`, etter at det har laget
Postgres og lagringen. Linja gir også `STOPP` når `az` selv feiler.

## Steg 1: kildene og bildet

Commiten skrives til en fil, så bildet, seed-skriptet og utrullingene senere
bruker samme commit selv om grenen flytter seg i mellomtiden.

```sh
git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" fetch origin fix/mcp-retrieve-filter-by
mkdir -p "$HOME/.cache/ka-rag-test" && git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" rev-parse origin/fix/mcp-retrieve-filter-by > "$HOME/.cache/ka-rag-test/commit"
rm -rf "$HOME/.cache/ka-rag-test/src" && mkdir -p "$HOME/.cache/ka-rag-test/src" && git -C "$HOME/projects/kunnskapsassistenten/digdir-headless-rag" archive "$(cat "$HOME/.cache/ka-rag-test/commit")" | tar -x -C "$HOME/.cache/ka-rag-test/src"
cat "$HOME/.cache/ka-rag-test/commit"
```

```sh
(cd "$HOME/.cache/ka-rag-test/src" && az acr build --subscription Altinn-AI-Assistant --registry kafrontendvxd2q2aj52lqw --image "ka-rag-test:$(cat "$HOME/.cache/ka-rag-test/commit")" --file server.Dockerfile --build-arg VERSION="$(cat "$HOME/.cache/ka-rag-test/commit")" .)
```

`--file` leses fra mappa kommandoen kjøres i, ikke fra kilden, så kommandoen
går inn i kildemappa først og bygger `.`. Parentesene holder `cd` inne i
kommandoen, så skallet står i repo-rota etterpå, der steg 3 og 6 finner
`deploy/rag.bicep`. Denne formen er målt i Azure 28.09: bygget tok 6 minutter
og 59 sekunder.

Bildet bygges fra en `git archive` av commiten, ikke fra repo-mappa.
headless-rag har ingen `.dockerignore`, så `az acr build` fra mappa ville
lastet opp `.env` og `.env.benjamin` til byggetjenesten. Arkivet har bare det
som er committet (84 MB for `a836b91`).

`VERSION` er det samme headless-rags egen `deploy.yml` sender med, og gjør at
commiten står i serverens diagnosepanel. Lokalt tar bygget om lag ti minutter.

## Steg 2: parameterfila

Alle verdiene malen trenger utenom commiten, i én fil som bare du kan lese.
Steget har fire blokker: to som bare definerer en funksjon, og to som kjører
den. **Har du fila fra før**, uten Postgres-passordet, kjører du bare 2c og
2d.

### 2a: funksjonen som lager fila

`value` leser verdien etter `navn =` i `.env`-filene uten å skrive noe ut.
Navnene i `.env.benjamin` er backendens config-stier, som i
`scripts/kudos-full/seed.sh`; de nakne `url` og `key` er ColBERT.
`configMasterKey`, `jwtSecret` og `apiKey` lages nye, med mindre de er gitt
som `KA_CONFIG_MASTER_KEY`, `KA_JWT_SECRET` og `KA_API_KEY` (se
[Hvis parameterfila er borte](#hvis-parameterfila-er-borte)). API-nøkkelen har
formatet backenden lager selv: `rag_` og 64 heksadesimale tegn.

Funksjonen skriver ingenting når fila finnes, når en gitt verdi er tom, eller
når en verdi fra `.env`-filene mangler.

```sh
ka_rag_parameters() {
  local file="$HOME/.config/ka-rag-test/parameters.json"
  local rag="$HOME/projects/kunnskapsassistenten/digdir-headless-rag"
  [ -e "$file" ] && { echo "Finnes alt: $file. Ingenting er skrevet."; return 1; }
  for given in KA_CONFIG_MASTER_KEY KA_JWT_SECRET KA_API_KEY; do
    eval "[ -n \"\${$given+x}\" ] && [ -z \"\$$given\" ]" && { echo "$given er gitt, men tom. Ingenting er skrevet."; return 1; }
  done
  mkdir -p "$HOME/.config/ka-rag-test" && chmod 700 "$HOME/.config/ka-rag-test"
  (
    umask 077
    value() { sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*//p" "$1" | head -n 1 | sed 's/[[:space:]]*$//; s/^"\(.*\)"$/\1/'; }
    export typesenseHost="$(value "$rag/.env.benjamin" 'services\.typesense\.api-host')"
    export typesenseTls="$(value "$rag/.env.benjamin" 'services\.typesense\.api-tls')"
    export typesenseApiKeyAdmin="$(value "$rag/.env.benjamin" 'services\.typesense\.api-key-admin')"
    export collectionPrefix="$(value "$rag/.env.benjamin" 'pipeline\.storage\.collection-prefix')"
    export docsCollection="$(value "$rag/.env.benjamin" 'pipeline\.storage\.docs-collection')"
    export chunksCollection="$(value "$rag/.env.benjamin" 'pipeline\.storage\.chunks-collection')"
    export phrasesCollection="$(value "$rag/.env.benjamin" 'pipeline\.storage\.phrases-collection')"
    export colbertApiUrl="$(value "$rag/.env.benjamin" url)"
    export colbertApiKey="$(value "$rag/.env.benjamin" key)"
    export azureOpenAiEndpoint="$(value "$rag/.env" AZURE_OPENAI_API_ENDPOINT)"
    export azureOpenAiDeployment="$(value "$rag/.env" AZURE_OPENAI_DEPLOYMENT_NAME)"
    export azureOpenAiApiKey="$(value "$rag/.env" AZURE_OPENAI_API_KEY)"
    export configMasterKey="${KA_CONFIG_MASTER_KEY:-$(openssl rand -base64 32)}"
    export jwtSecret="${KA_JWT_SECRET:-$(openssl rand -base64 32)}"
    export apiKey="${KA_API_KEY:-rag_$(openssl rand -hex 32)}"
    missing=""
    for v in typesenseHost typesenseTls typesenseApiKeyAdmin collectionPrefix docsCollection chunksCollection phrasesCollection colbertApiUrl colbertApiKey azureOpenAiEndpoint azureOpenAiDeployment azureOpenAiApiKey configMasterKey jwtSecret apiKey; do
      eval "[ -n \"\$$v\" ]" || missing="$missing $v"
    done
    if [ -n "$missing" ]; then
      echo "Tomme verdier:$missing. Ingenting er skrevet."
      false
    else
      jq -n '{
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        contentVersion: "1.0.0.0",
        parameters: (env | {typesenseHost, typesenseTls, typesenseApiKeyAdmin, collectionPrefix, docsCollection, chunksCollection, phrasesCollection, colbertApiUrl, colbertApiKey, azureOpenAiEndpoint, azureOpenAiDeployment, azureOpenAiApiKey, configMasterKey, jwtSecret, apiKey} | map_values({value: .}))
      }' > "$file"
    fi
  ) || return 1
  jq -r '.parameters | to_entries[] | "\(.key) \(.value.value | length)"' "$file"
  for given in KA_CONFIG_MASTER_KEY:configMasterKey KA_JWT_SECRET:jwtSecret KA_API_KEY:apiKey; do
    eval "[ -n \"\${${given%%:*}+x}\" ]" && echo "${given#*:}: gitt" || echo "${given#*:}: ny"
  done
}
```

### 2b: fila, bare første gang

```sh
ka_rag_parameters
```

Den skriver navnet og lengden på hver verdi, aldri verdien, og til slutt om
`configMasterKey`, `jwtSecret` og `apiKey` er gitt eller nye. Første gang skal
alle tre være `ny`, og `apiKey` skal ha lengde 68.

**Fila er nøkkelen til databasen.** Tjenestenøklene i config-databasen er
kryptert med `configMasterKey`, og med en ny verdi kan de ikke leses igjen.
Derfor nekter funksjonen å skrive over en fil som finnes.

### 2c: funksjonen som legger til Postgres-passordet

Legger `postgresAdminPassword` til i fila som finnes, og nekter hvis det alt
står der. Passordet er `Ka1-` og 32 heksadesimale tegn: store og små
bokstaver, sifre og et annet tegn, altså alle fire gruppene Azure teller, og
ingen tegn som må kodes i en adresse.

```sh
ka_rag_postgres_password() {
  local file="$HOME/.config/ka-rag-test/parameters.json"
  [ -e "$file" ] || { echo "Finner ikke $file. Ta 2b først."; return 1; }
  jq -e '.parameters.postgresAdminPassword' "$file" > /dev/null && { echo "postgresAdminPassword finnes alt. Ingenting er endret."; return 1; }
  [ -n "${KA_POSTGRES_PASSWORD+x}" ] && [ -z "$KA_POSTGRES_PASSWORD" ] && { echo "KA_POSTGRES_PASSWORD er gitt, men tom. Ingenting er endret."; return 1; }
  (
    umask 077
    export postgresAdminPassword="${KA_POSTGRES_PASSWORD:-Ka1-$(openssl rand -hex 16)}"
    jq '.parameters.postgresAdminPassword = {value: env.postgresAdminPassword}' "$file" > "$file.ny" && mv "$file.ny" "$file"
  ) || return 1
  jq -r '.parameters.postgresAdminPassword.value | "postgresAdminPassword \(length)"' "$file"
  [ -n "${KA_POSTGRES_PASSWORD+x}" ] && echo "postgresAdminPassword: gitt" || echo "postgresAdminPassword: ny"
}
```

### 2d: passordet

```sh
ka_rag_postgres_password
```

Første gang skal den skrive `postgresAdminPassword 36` og `ny`.

## Steg 3: Postgres, lagringen og seed-jobben

```sh
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-grunnmur --template-file deploy/rag.bicep --parameters @"$HOME/.config/ka-rag-test/parameters.json" registryName=kafrontendvxd2q2aj52lqw imageTag="$(cat "$HOME/.cache/ka-rag-test/commit")" withApp=false --query properties.outputs -o json
```

Uten `withApp` lager malen Postgres-serveren med databasen, brannmurregelen og
kravet om TLS, lagringskontoen, delingen, miljøets kobling til den og jobben,
men ingen app. Jobben startes ikke av seg selv. Å opprette serveren tar
«typically 5-10 minutes» ifølge Microsofts
[hurtigstart for Flexible Server](https://learn.microsoft.com/azure/postgresql/flexible-server/quickstart-create-server);
selve opprettingen er ikke målt. I Azure tok steg 3 2 min 46 s med serveren
alt laget. Utdataene skal vise `postgresServer` og `storageAccountName` lik
`karagvxd2q2aj52lqw`.

`require_secure_transport` settes med `source: 'user-override'`. Med
`user-defined` stoppet steg 3 i Azure på `InvalidParameterValue`.

Verdiene går til ARM i parameterfila og ikke på kommandolinja. Malen tar dem
som `@secure()`, så de lagres ikke i utrullingshistorikken.

## Steg 4: seed-skriptet på delingen

`scripts/kudos-full/seed.clj` er ikke i bildet: `server.Dockerfile` kopierer
bare `server/`. Jobben kjører det fra delingen, fra samme commit som bildet.
Med `--auth-mode key` og uten nøkkel henter `az` kontonøkkelen selv. Målt i
Azure 28.09: `seed-kudos-full.clj` ble lastet opp med 4 372 byte.

```sh
az storage file upload --subscription Altinn-AI-Assistant --auth-mode key --account-name karagvxd2q2aj52lqw --share-name ka-rag-db --source "$HOME/.cache/ka-rag-test/src/scripts/kudos-full/seed.clj" --path seed-kudos-full.clj
```

## Steg 5: seeding

**Jobben kjøres bare når appen ikke finnes.** Datahike tåler én prosess som
skriver, og en seeding mens serveren har databasen åpen, melder suksess og
mister skrivingen (headless-rag #493). Første gang finnes ikke appen, fordi
steg 3 lot den være. Sjekk det likevel; linja skal ikke skrive ut noe:

```sh
az containerapp list --subscription Altinn-AI-Assistant -g rg-ka-test --query "[?name=='ka-rag-test'].name" -o tsv
```

Så jobben, som skriver ut navnet på kjøringen:

```sh
az containerapp job start --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --query name -o tsv
```

Og ventingen på den nyeste kjøringen. Den venter i inntil 30 minutter, like
lenge som jobbens `replicaTimeout`, og stopper når kjøringen er ferdig på den
ene eller andre måten:

```sh
for i in $(seq 1 90); do
  STATUS=$(az containerapp job execution list --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --query 'sort_by(@, &properties.startTime)[-1].properties.status' -o tsv)
  echo "$(date +%H:%M:%S) $STATUS"
  case "$STATUS" in
    Succeeded|Failed|Stopped|Degraded) break ;;
  esac
  sleep 20
done
```

**Gå videre til steg 6 bare når siste linje er `Succeeded`.** Skriptet
avslutter med 0 bare når frasesøket mot Kudos til slutt gir treff. Lokalt, mot
Postgres, tok jobben 33 sekunder mot en tom database og ga 20 treff. I Azure
var den `Succeeded` på om lag 1,5 minutter, og frasesøket «DFØ årsrapport
2024» ga 20 treff. Står den på noe annet, eller
fortsatt på `Running` etter 30 minutter, er databasen ikke klar; les loggen i
portalen, under jobben → **Execution history**.

**Vakta i jobben er en reserve, ikke en stopper.** Skriptet kjører bak
headless-rags `refuse-if-server-running!`, som avslutter med 1 hvis
`ka-rag-test:80` svarer 2xx på `/up` innen 500 ms. Den slipper gjennom på alt
annet:

- på en omdirigering, som ingressen gir hvis `allowInsecure` ikke virker slik
  malen antar;
- mens appen starter: skjema, agenter og nøkkel skrives før `/up` svarer, så
  appen har databasen åpen før vakta kan se den;
- når navnet ikke slås opp, eller svaret bruker mer enn 500 ms.

Derfor sikrer oppskriften at appen ikke finnes, og lar ikke vakta gjøre det.
Å skalere appen til 0 er ikke det samme: den vekkes av den første
forespørselen, også av vaktas egen.

## Steg 6: backenden

```sh
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-app --template-file deploy/rag.bicep --parameters @"$HOME/.config/ka-rag-test/parameters.json" registryName=kafrontendvxd2q2aj52lqw imageTag="$(cat "$HOME/.cache/ka-rag-test/commit")" withApp=true --query properties.outputs -o json
```

At oppstarten fant Postgres og la inn agentene og nøkkelen. Loggen har de
første åtte tegnene av nøkkelen i `:api-key-prefix`, og `sed` tar dem ut før
de vises, også om anførselstegnene kommer escapet:

```sh
az containerapp logs show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --format text --tail 100 | grep -E "init-db|e2e/seeded|Started oejs.Server" | sed -E 's/:api-key-prefix[^,}]*/:api-key-prefix skjult/'
```

Første gang skal `init-db` vise `backend=:jdbc`, og linja med `e2e/seeded`
skal vise `:agents-after 8` og `:api-key-existed? false`. Ved senere
oppstarter står det `true`.

Oppstartsproben venter i inntil 130 sekunder på `/up`. Lokalt, mot Postgres og
med 2 CPU og 4 GiB som her, svarte den etter 43 sekunder. I Azure tok
utrullingen 2 min 49 s, og appen sto som `Running` med bare intern ingress.

## Steg 7: frontenden peker på backenden

Først når innlogging eller IP-begrensning står foran frontenden. Nøkkelen blir
secret, og modus, adresse og korpus settes i en ny revisjon. `-o none` på
begge, så ingenting fra svaret kommer på skjermen:

```sh
az containerapp secret set --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --secrets digdir-api-key="$(jq -r .parameters.apiKey.value "$HOME/.config/ka-rag-test/parameters.json")" -o none
```

```sh
az containerapp update --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --set-env-vars KA_MODE=live DIGDIR_API_BASE=http://ka-rag-test DIGDIR_API_KEY=secretref:digdir-api-key VITE_KA_TENANT=kudos VITE_KA_DATASET_CONFIG_KEY=kudos-full "VITE_KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no" "VITE_KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer" --revision-suffix rag$(date +%H%M%S) -o none
```

```sh
az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --query properties.configuration.ingress.fqdn -o tsv
```

Verdien i `secret set` står i argumentene til `az` mens kommandoen kjører, og
kan ses med `ps` i det øyeblikket. I historikken står bare `$(jq …)`.

`http://ka-rag-test` er appens navn inne i miljøet; adressen finnes ikke
utenfra. Åpne frontendens adresse og still et spørsmål. Målt i Azure:
DFØ-spørsmålet med filteret Årsrapport svarte på 38 s, med 915 tegn og DFØs
årsrapport 2024 som kilde. Antallsspørsmålet: 19 s. I nettleseren svarte
«Hva skriver Statens vegvesen om trafikksikkerhet i årsrapporten for 2024?» på
19,8 s, med svar og kilde og 0 konsollfeil.

**Kjøres `main.bicep` på nytt, må den få de samme verdiene**, ellers setter den
frontenden tilbake til mock mot `test.rag.digdir.cloud`: `kaMode=live`,
`digdirApiBase=http://ka-rag-test`, `tenant=kudos`,
`datasetConfigKey=kudos-full`, `datasets` og `filterFields` som over, og
`digdirApiKey` fra parameterfila. `filterFields` må ha nøkkelen `kudos-full`,
ikke `kudos` som i standardverdien.

At tråden overlever en omstart av backenden. Det er ikke målt i Azure; lokalt
sto tråden der etter omstart.

```sh
az containerapp revision restart --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --revision "$(az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --query properties.latestRevisionName -o tsv)"
```

Last tråden på nytt når omstarten er ferdig. Spørsmålet og svaret står der;
kildene lagres ikke med samtalen, og det sier frontenden selv.

## Nøkkelen

Backenden lager ingen nøkkel av seg selv. Det finnes to veier i koden:
konsollet (`digdir.config.api-keys/create-api-key!`, bak admin-innlogging), og
oppstartskroken `digdir.e2e.seed/maybe-seed!`. Oppsettet her bruker kroken,
som er det lokal kjøring også gjør:

- Når `E2E_API_KEY` er satt, gjør hver oppstart tre ting: legger inn de
  innebygde agentene og to testagenter (8 i alt), lagrer akkurat denne verdien
  som API-nøkkel hvis den ikke finnes, og registrerer tenanten i `TENANT`. Uten
  variabelen gjør den ingenting.
- Nøkkelen lagres som SHA-256 av verdien, ikke som klartekst, med navnet
  `e2e-harness` og scope `query`. Loggen får de første åtte tegnene.
- **Hva den får:** alle kall under `/api/*` og `/v1/*` som krever en gyldig
  nøkkel. Den har ingen grense for tenant, datasett, agent eller modus, og for
  MCP betyr tom grense ingen grense (`digdir.mcp.tools`, merknaden om
  `:dataset-scopes`). Databasen her har bare tenanten `kudos`, så i praksis er
  det Kudos-korpuset. Den har verken `ingest` eller `admin`.
- **Hvem sine tråder:** nøkkelen er ikke knyttet til en bruker.
  `/api/conversations` skiller brukerne på `X-User-Id`, som den som har
  nøkkelen setter selv. Derfor må tynnserveren sette den fra innloggingen, ikke
  fra nettleseren, den dagen det er innlogging.
- **Den offentlige nøkkelen virker ikke her.** Standardverdien i
  `docker-compose.newcomer.yml` er ikke i denne databasen. Målt lokalt:
  `/api/conversations` gir 200 med den nye nøkkelen og 401 med den offentlige.
- **Bytte nøkkel:** ny verdi i begge secrets (`api-key` på backenden og
  `digdir-api-key` på frontenden), så en ny revisjon av begge. **Den gamle
  nøkkelen virker fortsatt**: kroken legger til, den trekker ikke tilbake.
  Tilbaketrekking går via konsollet, og det krever en admin-bruker, som dette
  oppsettet ikke har.

En nøkkel låst til `kudos/kudos-full` går an: `store-api-key` tar
`:dataset-scopes`. Det krever egen kode i seed-jobben i stedet for kroken, og
er ikke gjort.

## Databasen i Postgres

- **Én skriver.** Datahike tåler én prosess som skriver, også i Postgres.
  Derfor én replika, og seed-jobben bare når appen ikke finnes (steg 5).
- **Nye revisjoner overlapper.** En ny revisjon av `ka-rag-test` (nytt bilde,
  ny variabel, ny secret) startes før den gamle stoppes, så to JVM-er har
  databasen åpen en liten stund. Hva Datahike gjør da, er ikke målt. Om en
  omstart av samme revisjon også overlapper, er heller ikke målt.
- **Sikkerhetskopi:** Flexible Server tar dem selv, og malen beholder dem i sju
  dager (`backupRetentionDays`). Innenfor de sju dagene kan serveren
  gjenopprettes til et tidspunkt, som en ny server.
- **Tilgang:** offentlig adresse, fordi miljøet ikke er i et eget virtuelt
  nettverk, med brannmurregelen for tjenester i Azure. Den slipper inn fra hele
  Azure og ikke bare fra vårt miljø. Det som skiller, er passordet og TLS:
  serveren krever TLS (`require_secure_transport`), og adressen backenden
  bruker har `sslmode=require`. `sslmode=require` krypterer, men sjekker ikke
  serverens sertifikat. Det er ikke endret og ikke målt.
- **Hvem kobler til:** admin-brukeren `karagadmin`, med passordet fra
  parameterfila som secret i appen og jobben. Det står ikke i adressen.
- **Størrelse:** 12 MB i tabellen `datahike` etter seeding og én tråd (målt
  lokalt). Serveren har 32 GB, det minste som kan velges.

### Hvorfor Postgres

Først lå databasen som Datahike-filer på Azure Files. Seed-jobben feilet i
Azure etter 1 minutt og 33 sekunder med `AccessDeniedException` på
`<fil>.ksv.new -> <fil>.ksv` (målt av dirigenten 28.09): Datahikes
filbackend skriver en ny fil og gir den det gamle navnet, og SMB på Azure
Files nekter det. NFS ville krevd et miljø i eget virtuelt nettverk.
headless-rag har jdbc-backenden fra før: uten `DATAHIKE_FILE_PATH` og med
`ADH_POSTGRES_URL` bruker `load-bootstrap-config` Postgres.

Delingen har nå bare seed-skriptet. Filene fra forsøket kan ligge der; ingen
leser dem.

## Et nytt bilde

Steg 1 gir ny commit i `~/.cache/ka-rag-test/commit` og nytt bilde. Kjør så
utrullingen i steg 6. Jobben får det nye bildet samtidig.

En ny seeding over en tenant som alt er seedet, er ikke prøvd, verken lokalt
eller her. Skal det gjøres, må appen først slettes, så steg 5 og 6 gjelder som
første gang. Databasen står når appen slettes.

## Hvis parameterfila er borte

Verdiene som ble laget i steg 2, ligger som secrets på appen og jobben. Lim inn
de to funksjonene fra 2a og 2c, **uten** kallene i 2b og 2d, og kjør én av
variantene under. Funksjonene nekter hvis en verdi kommer tom tilbake, for
eksempel fordi `secret show` feilet, og skriver `gitt` ved hver verdi som kom
fra Azure. Står det `ny` ved `configMasterKey`, er noe galt: slett fila og
start på nytt.

Når appen finnes:

```sh
KA_CONFIG_MASTER_KEY="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name config-master-key --query value -o tsv)" KA_JWT_SECRET="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name jwt-secret --query value -o tsv)" KA_API_KEY="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name api-key --query value -o tsv)" ka_rag_parameters
KA_POSTGRES_PASSWORD="$(az containerapp secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test --secret-name postgres-password --query value -o tsv)" ka_rag_postgres_password
```

Når bare jobben finnes. Den har ikke API-nøkkelen, så den lages ny, og det er
riktig så lenge appen aldri har startet:

```sh
KA_CONFIG_MASTER_KEY="$(az containerapp job secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --secret-name config-master-key --query value -o tsv)" KA_JWT_SECRET="$(az containerapp job secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --secret-name jwt-secret --query value -o tsv)" ka_rag_parameters
KA_POSTGRES_PASSWORD="$(az containerapp job secret show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-rag-test-seed --secret-name postgres-password --query value -o tsv)" ka_rag_postgres_password
```

## Kostnad

Fra Azures offentlige prisliste for Norway East, 28.09:

- **Backenden** står alltid oppe med 2 vCPU og 4 GiB. vCPU koster 0,000024 USD
  per sekund aktiv og 0,000003 i tomgang, minne 0,000003 USD per GiB-sekund.
  Det er om lag 47 USD i måneden i tomgang og opp mot 156 USD hvis den regnet
  hele tiden, før abonnementets gratiskvote.
- **Postgres** B1ms koster 0,02189 USD i timen, om lag 16 USD i måneden, og
  32 GB lagring 0,151 USD per GB, om lag 5 USD i måneden.
- **Delingen** er ubetydelig med ett skript i seg.

## Prøve det lokalt

Samme bilde, samme kommando for jobben og samme variabler som i
`deploy/rag.bicep`, under Colima. En `postgres:16`-container med TLS på står
for Flexible Server, et docker-volum for delingen og et eget nettverk for
miljøet. Backenden har ingen publisert port, så den er intern som i Azure; bare
frontenden er åpen, på `127.0.0.1:8797`. Navnene og porten kolliderer ikke med
stacken på `:8080`.

Etter steg 1 og 2 over. Verdiene hentes fra parameterfila inn i miljøet, og
`-e NAVN` uten verdi tar dem derfra, så de står ikke på kommandolinja:

```sh
P="$HOME/.config/ka-rag-test/parameters.json"
SRC="$HOME/.cache/ka-rag-test/src"
IMG="ka-rag-test:$(cat "$HOME/.cache/ka-rag-test/commit")"
param() { jq -r ".parameters.$1.value" "$P"; }
export CONFIG_MASTER_KEY="$(param configMasterKey)" JWT_SECRET="$(param jwtSecret)" E2E_API_KEY="$(param apiKey)" DIGDIR_API_KEY="$(param apiKey)"
export ADH_POSTGRES_PWD="$(param postgresAdminPassword)" POSTGRES_PASSWORD="$(param postgresAdminPassword)"
export TYPESENSE_API_HOST="$(param typesenseHost)" TYPESENSE_API_TLS="$(param typesenseTls)" TYPESENSE_API_KEY_ADMIN="$(param typesenseApiKeyAdmin)"
export KUDOS_COLLECTION_PREFIX="$(param collectionPrefix)" TYPESENSE_COLLECTION_PREFIX="$(param collectionPrefix)" KUDOS_DOCS_COLLECTION="$(param docsCollection)" KUDOS_CHUNKS_COLLECTION="$(param chunksCollection)" KUDOS_PHRASES_COLLECTION="$(param phrasesCollection)"
export COLBERT_API_URL="$(param colbertApiUrl)" COLBERT_API_KEY="$(param colbertApiKey)"
export AZURE_OPENAI_API_ENDPOINT="$(param azureOpenAiEndpoint)" AZURE_OPENAI_DEPLOYMENT_NAME="$(param azureOpenAiDeployment)" AZURE_OPENAI_API_KEY="$(param azureOpenAiApiKey)"

docker build -t $IMG -f "$SRC/server.Dockerfile" --build-arg VERSION="$(cat "$HOME/.cache/ka-rag-test/commit")" "$SRC"
docker build -t ka-frontend-proeve:local .
docker network create ka-rag-proeve
docker volume create ka-rag-proeve-seed
docker volume create ka-rag-proeve-pg
docker run --rm -i -v ka-rag-proeve-seed:/seed alpine sh -c 'cat > /seed/seed-kudos-full.clj' < "$SRC/scripts/kudos-full/seed.clj"
docker run -d --name ka-rag-test-pg --network ka-rag-proeve -v ka-rag-proeve-pg:/var/lib/postgresql/data -e POSTGRES_USER=karagadmin -e POSTGRES_PASSWORD -e POSTGRES_DB=datahike postgres:16 -c ssl=on -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
until docker exec ka-rag-test-pg pg_isready -U karagadmin -d datahike; do sleep 1; done
```

Seed-jobben, med det samme som jobben i malen:

```sh
docker run --rm --network ka-rag-proeve --cpus 1 --memory 2g -v ka-rag-proeve-seed:/seed:ro \
  -e "ADH_POSTGRES_URL=jdbc:postgresql://ka-rag-test-pg:5432/datahike?sslmode=require" \
  -e ADH_POSTGRES_USER=karagadmin -e ADH_POSTGRES_PWD -e ADH_POSTGRES_TABLE=datahike \
  -e CONFIG_MASTER_KEY -e JWT_SECRET -e JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 \
  -e DIGDIR_SEED_GUARD_ADDRESSES=ka-rag-test:8080 \
  -e KUDOS_TENANT=kudos -e KUDOS_DATASET=kudos-full \
  -e KUDOS_COLLECTION_PREFIX -e KUDOS_DOCS_COLLECTION -e KUDOS_CHUNKS_COLLECTION -e KUDOS_PHRASES_COLLECTION \
  -e TYPESENSE_API_HOST -e TYPESENSE_API_TLS -e TYPESENSE_COLLECTION_PREFIX -e TYPESENSE_API_KEY_ADMIN \
  -e COLBERT_API_URL -e COLBERT_API_KEY \
  -e AZURE_OPENAI_USE_AZURE=true -e AZURE_OPENAI_API_ENDPOINT -e AZURE_OPENAI_DEPLOYMENT_NAME -e AZURE_OPENAI_API_KEY \
  --entrypoint java $IMG -cp /app/app.jar clojure.main \
  -e "(require 'digdir.setup.common) (digdir.setup.common/refuse-if-server-running! \"seed-kudos-full.clj\")" \
  /seed/seed-kudos-full.clj
```

Siste linje skal være `frasesøk «DFØ årsrapport 2024»: 20 treff`. Så backenden
og frontenden:

```sh
docker run -d --name ka-rag-test --network ka-rag-proeve --cpus 2 --memory 4g \
  -e "ADH_POSTGRES_URL=jdbc:postgresql://ka-rag-test-pg:5432/datahike?sslmode=require" \
  -e ADH_POSTGRES_USER=karagadmin -e ADH_POSTGRES_PWD -e ADH_POSTGRES_TABLE=datahike \
  -e CONFIG_MASTER_KEY -e JWT_SECRET -e JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75 \
  -e TENANT=kudos -e DATASET_CONFIG_KEY=kudos-full -e E2E_API_KEY \
  $IMG
until docker exec ka-rag-test curl -fsS -o /dev/null http://localhost:8080/up; do sleep 2; done

docker run -d --name ka-frontend-proeve --network ka-rag-proeve -p 127.0.0.1:8797:8787 \
  -e KA_MODE=live -e DIGDIR_API_BASE=http://ka-rag-test:8080 -e DIGDIR_API_KEY \
  -e VITE_KA_TENANT=kudos -e VITE_KA_DATASET_CONFIG_KEY=kudos-full \
  -e "VITE_KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no" \
  -e "VITE_KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer" \
  ka-frontend-proeve:local
```

Åpne `http://127.0.0.1:8797`. Lokalt er backendens adresse
`ka-rag-test:8080`, fordi det ikke er noen ingress foran; i Azure er den
`ka-rag-test` på port 80.

Omstart, og vakta:

```sh
docker restart ka-rag-test
until docker exec ka-rag-test curl -fsS -o /dev/null http://localhost:8080/up; do sleep 2; done
```

Kjøres seed-jobben over på nytt nå, skal den nekte med exit 1. Rydd etterpå,
også verdiene i skallet:

```sh
docker rm -f ka-frontend-proeve ka-rag-test ka-rag-test-pg
docker volume rm ka-rag-proeve-seed ka-rag-proeve-pg
docker network rm ka-rag-proeve
unset CONFIG_MASTER_KEY JWT_SECRET E2E_API_KEY DIGDIR_API_KEY ADH_POSTGRES_PWD POSTGRES_PASSWORD TYPESENSE_API_HOST TYPESENSE_API_TLS TYPESENSE_API_KEY_ADMIN KUDOS_COLLECTION_PREFIX TYPESENSE_COLLECTION_PREFIX KUDOS_DOCS_COLLECTION KUDOS_CHUNKS_COLLECTION KUDOS_PHRASES_COLLECTION COLBERT_API_URL COLBERT_API_KEY AZURE_OPENAI_API_ENDPOINT AZURE_OPENAI_DEPLOYMENT_NAME AZURE_OPENAI_API_KEY P SRC IMG
unset -f param
```

Lokalt henter containerne bildet fra maskinen og ikke fra registeret, så
admin-brukeren er ikke med i prøven.

### Målt 28.09

Med bildet `digdir-rag-server:newcomer`, som er bygget fra `a836b91`, grenens
hode: alle 222 kildefilene og de 11 ressursfilene i `app.jar` er like med
commiten. Frontenden bygget fra `main` (`553b061`). Colima, arm64.

Mot Postgres 16 med TLS, `sslmode=require`:

| Hva                                            | Resultat                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Seed-jobben mot tom database, ingen server før | exit 0 etter 33 s, frasesøket ga 20 treff                         |
| Backenden, 2 CPU og 4 GiB                      | `/up` etter 43 s, `backend=:jdbc`; 8 agenter og nøkkelen lagt inn |
| Tilkoblingene fra backenden                    | 3, alle over TLS 1.3                                              |
| Ny nøkkel / offentlig nøkkel / ingen           | 200 / 401 / 401 på `/api/conversations`                           |
| Spørsmål med årsfilter 2024 i nettleseren      | svar etter ca. 30 s, kilden er DFØs årsrapport for 2024           |
| Omstart av backenden                           | `/up` etter 44 s, tråden står der                                 |
| Databasen etterpå                              | 12 MB, 1 466 rader i `datahike`                                   |

Fra den første prøven samme dag, med databasen på et docker-volum: seed-jobben
mens backenden svarte, ble nektet med exit 1, og backenden brukte 1,4 GiB av
4 etter ett svar. Vakta er den samme med Postgres.

## Målt i Azure 28.09

Målt av dirigenten i `rg-ka-test`.

| Hva                                               | Målt                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backendbildet `ka-rag-test:a836b91` (amd64)       | bygget med `az acr build` fra kildemappa på 6 min 59 s; kjørte i jobben og appen                                                                                                                                                                           |
| Admin-passordet via `listCredentials()`           | begge appene og jobben hentet bildene sine med det                                                                                                                                                                                                         |
| Datahike på Azure Files                           | virket ikke: `AccessDeniedException` ved omdøping fra `.ksv.new` til `.ksv` etter 1 min 33 s                                                                                                                                                               |
| Postgres B1ms gjennom regelen for Azure-tjenester | jobben og appen koblet til (`init-db env=:remote backend=:jdbc`)                                                                                                                                                                                           |
| `require_secure_transport`                        | `user-defined` ga `InvalidParameterValue`, `user-override` virker; steg 3 tok 2 min 46 s med serveren alt laget                                                                                                                                            |
| Opplastingen av seed-skriptet (steg 4)            | `--auth-mode key` uten nøkkel hentet kontonøkkelen selv; `seed-kudos-full.clj` ble lastet opp med 4 372 byte                                                                                                                                               |
| Seedingen                                         | `Succeeded` på om lag 1,5 minutter; frasesøket «DFØ årsrapport 2024» ga 20 treff                                                                                                                                                                           |
| Backendappen (steg 6)                             | utrullingen tok 2 min 49 s; `Running`, bare intern ingress                                                                                                                                                                                                 |
| Intern DNS og `allowInsecure`                     | frontenden når `http://ka-rag-test`                                                                                                                                                                                                                        |
| Typesense og Azure OpenAI fra Container Apps      | svar med kilder kom fram                                                                                                                                                                                                                                   |
| Svartid gjennom frontenden                        | DFØ-spørsmålet med filteret Årsrapport: 38 s, 915 tegn, DFØs årsrapport 2024 som kilde. Antallsspørsmålet: 19 s. I nettleseren: «Hva skriver Statens vegvesen om trafikksikkerhet i årsrapporten for 2024?» på 19,8 s, med svar og kilde og 0 konsollfeil. |
| Korpuset                                          | agenten svarte «10 064 dokumenter» med fordeling per type, som stemmer med Typesense (10 064 dokumenter og 621 244 biter)                                                                                                                                  |

## Det som ikke er målt

Ikke målt i Azure 28.09:

- **ColBERT fra Container Apps.** Ikke sjekket for seg. Svarene kom, men loggen
  er ikke lest for reranking.
- **Tråden etter en omstart av backenden.** Lokalt sto den der.
- **Revisjoner som overlapper under en utrulling**, og hva Datahike gjør når to
  JVM-er har databasen åpen samtidig.
- **Sertifikatsjekk.** `sslmode=require` sjekker ikke serverens sertifikat, og
  det er ikke endret.
- **Vakta over ingressen.** At `refuse-if-server-running!` i jobben ser appen
  på `ka-rag-test:80`. Oppskriften lar uansett aldri vakta være det eneste som
  hindrer en seeding mens appen kjører.
- **Hvor lang tid det tar å opprette Postgres-serveren.** Steg 3 ble målt med
  serveren alt laget.
- **Miljøets kobling til delingen** når `main.bicep` kjøres på nytt. Ikke
  rent målt: etter steg 3 (17:49 UTC) ble `main.bicep` kjørt 17:50–17:51 og
  17:54–17:55. Seed-jobben på SMB (17:49–17:51) monterte delingen, men gikk
  samtidig med den første av dem, og siste steg 3 (18:20) kom etter siste
  `main.bicep`.
