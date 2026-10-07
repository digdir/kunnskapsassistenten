# Utrulling av testmiljøet

Én container: serveren holder API-nøkkelen, snakker med `digdir-headless-rag`
og serverer den bygde klienten fra samme origin. Samme origin er ikke
kosmetikk — backenden svarer på en CORS-preflight med 401 og sender ingen
CORS-hoder, så en nettleser kan ikke kalle den direkte uansett, og nøkkelen
skal uansett aldri dit.

**Ikke rullet ut ennå.** Alt under er skrevet og prøvd lokalt. Engangsoppsettet
under [Første gang](#første-gang) gjør et menneske med rettigheter i Azure;
etter det ruller hver merge til `main` ut av seg selv. Bakgrunn og
avgjørelser: `design/plan-testmiljo-2026-09-22.md`.

Klienten i bildet er bygget for **live** (`VITE_API_MODE=live` i `Dockerfile`).
Hvilken backend klienten bruker, avgjøres når bildet bygges. `KA_MODE` avgjør
bare om serveren sender kallene videre. Se
[Bytte mellom mock og live](#bytte-mellom-mock-og-live).

## Hva som finnes

| Fil                            | Hva                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `server/`                      | Serveren. Node uten rammeverk og uten avhengigheter.                               |
| `Dockerfile`                   | To steg: bygg med devDependencies, kjøretid uten node_modules.                     |
| `deploy/main.bicep`            | Register, Container App, miljø, logganalyse, to identiteter og innloggingen        |
| `deploy/test.bicepparam`       | Live-oppsettet for [Live for én person](#live-for-én-person). Ingen hemmeligheter. |
| `.github/workflows/deploy.yml` | Bygger, pusher og ruller ut ved hver push til `main`.                              |
| `.github/workflows/ci.yml`     | Bygger og starter bildet på hver PR, uten å pushe.                                 |

Serveren gjør fire ting: proxyer klientens kall under `/api/` til backenden med
`X-API-Key` påsatt (bare i live; i mock svarer `/api/*` 404). Det er
`POST /api/mcp`, `GET` og `POST /api/conversations` og
`GET /api/conversations/:id`. Alt annet under `/api/` svarer 404. Den
serverer `dist/` med SPA-fallback, svarer på `/healthz`, og skriver
`/config.js` med de variablene klienten skal lese. Bak innloggingen setter den
også `X-User-Id` fra plattformen; se [Innlogging](#innlogging).

## Slik rulles det ut

Merge til `main`, og `Deploy`-workflowen gjør resten:

1. bygger bildet og pusher det som `ka-frontend-test:<commit>` til vårt eget
   register;
2. peker appen på det med `az containerapp update`, som gir en ny revisjon
   `ka-frontend-test--sha<7 tegn>-<kjøring>-<forsøk>`;
3. spør `/healthz` på **den nye revisjonens** egen adresse, og feiler hvis den
   ikke svarer innen fem minutter;
4. skriver adressen i kjøringens sammendrag og under **Deployments → test** på
   repoets forside.

Den gamle revisjonen svarer til den nye er frisk, så et dårlig bilde tar ikke
miljøet ned. To merger rett etter hverandre ruller ut én om gangen, i rekkefølge
(`concurrency` i workflowen).

Hvor lang tid det tar: bildet bygges på ca. 30 sekunder (målt i CI på PR #166).
Pushing, ny revisjon og helsesjekk er ikke målt før første utrulling; regn med
noen minutter.

For hånd, uten ny commit: **Actions → Deploy → Run workflow**, eller
`gh workflow run deploy.yml`.

Før engangsoppsettet er gjort, hopper workflowen over med meldingen «Ingen
utrulling» og står grønn, så `main` ikke blir rød av et miljø som ikke finnes.

## Live for én person

Hele appen i live, før Entra: bak [den delte hemmeligheten](#delt-hemmelighet)
eller en adresseliste, uten roller og uten GitHub. Contributor på `rg-ka-test`
holder. Appen henter bildet med registerets eget passord i stedet for AcrPull,
og nøkkelen står bak hemmeligheten eller lista. Oppsettet står i `deploy/test.bicepparam`: `KA_MODE=live`,
backenden på `http://ka-rag-test` (den interne fra `docs/deploy-backend.md`),
tenant `kudos`, datasett `kudos-full` og feltnavna for det. Nøkkelen, bildet
og adressene leses fra miljøvariabler når malen kjøres, så fila har ingen
hemmeligheter, og en ny kjøring setter ikke appen tilbake til mock.

Kommandoene her har abonnement og ressursgruppe skrevet ut, i denne
rekkefølgen, så de kan kjøres som de står.

**Rullet ut av dirigenten 28.09**, bak adresselista: bildet hentet med
registerets passord, innloggingen av, og 403 fra andre adresser (se steg 4).
Den delte hemmeligheten er ikke prøvd i Azure ennå.

**Bygg ikke parameterfila selv mens nøkkelen står i miljøet.**
`az bicep build-params` uten `--stdout` skriver `deploy/test.json`, med
nøkkelen i klartekst. `deploy/*.json` er i `.gitignore`, men fila blir
liggende på disken. `az deployment group create` bygger den i minnet.

### 1. Grunnmuren

I et nytt skall, fra repo-rota. Uten `KA_IMAGE_TAG` lager malen bare register,
miljø, logger og identiteter, med admin-brukeren på registeret. Den andre
linja henter registerets navn; kjør den igjen i hvert nytt skall senere.

```sh
az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-grunnmur --parameters deploy/test.bicepparam
ACR=$(az deployment group show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-grunnmur --query properties.outputs.registryName.value -o tsv)
```

### 2. Backenden

Etter `docs/deploy-backend.md`, i miljøet steg 1 laget. Frontenden når den på
`http://ka-rag-test`.

### 3. Bildet

`az acr build` laster opp arbeidstreet og bygger i registeret. Funksjonen
stopper hvis arbeidstreet har endringer som ikke er committet, fordi taggen
er commiten.

```sh
build_image() {
  git diff --quiet HEAD || { echo "Ucommittede endringer. Commit først."; return 1; }
  KA_IMAGE_TAG=$(git rev-parse HEAD)
  az acr build --subscription Altinn-AI-Assistant --registry "$ACR" --image "ka-frontend-test:$KA_IMAGE_TAG" .
}
build_image
```

### 4. Appen, i live

`read -rs` leser nøkkelen uten å vise den.

Finnes hemmelighetsfila fra [Delt hemmelighet](#delt-hemmelighet), står appen
bak den og virker fra hvor som helst; da settes ingen adresseliste. Ellers
slipper bare adressen maskinen går ut på inn. Bak en VPN eller en exit-node er
det dens adresse.

Funksjonen stopper hvis taggen fra steg 3 mangler, som den gjør i et nytt
skall; uten den ville malen bare laget grunnmuren. Lista settes bare når
`curl` virker. Feiler den, blir lista tom, og da stopper malen i stedet for å
slippe nøkkelen gjennom bak en liste med bare `/32` (KA CC på #169). Er
verken lista, hemmeligheten eller Entra satt, stopper funksjonen selv før den
ber om nøkkelen. Malen stopper også på et element uten adresse og på et nett
bredere enn /8.

```sh
deploy_live() {
  [ -n "$KA_IMAGE_TAG" ] || { echo "KA_IMAGE_TAG er tom. Kjør steg 3, eller sett den til taggen som kjører."; return 1; }
  KA_ALLOWED_IPS=""
  KA_ACCESS_SECRET=""
  if [ -r ~/.config/ka-rag-test/access-secret ]; then
    KA_ACCESS_SECRET=$(cat ~/.config/ka-rag-test/access-secret)
    echo "Delt hemmelighet: ${#KA_ACCESS_SECRET} tegn, ingen adresseliste"
  else
    IP=$(curl -fsS https://api.ipify.org) && KA_ALLOWED_IPS="$IP/32"
    echo "Adresseliste: ${KA_ALLOWED_IPS:-tom}"
  fi
  [ -n "$KA_ALLOWED_IPS" ] || [ -n "${KA_ACCESS_SECRET//[[:space:]]/}" ] || [ -n "$KA_ENTRA_CLIENT_ID" ] || { echo "Verken adresseliste, hemmelighet eller Entra er satt. Ingenting er rullet ut."; return 1; }
  read -rs DIGDIR_API_KEY
  export KA_IMAGE_TAG DIGDIR_API_KEY KA_ALLOWED_IPS KA_ACCESS_SECRET
  az deployment group create --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-app --parameters deploy/test.bicepparam --query properties.outputs.fqdn.value -o tsv
  unset DIGDIR_API_KEY KA_ACCESS_SECRET TYPESENSE_API_KEY
}
deploy_live
```

Siste linje fra `az` er adressen. Sjekk den:

```sh
FQDN=$(az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --query properties.configuration.ingress.fqdn -o tsv)
curl -fsS "https://$FQDN/healthz"
```

Den skal svare `{"ok":true,"mode":"live"}`.

Med adresseliste, fra en annen adresse, for eksempel en mobil delt tilkobling,
skal ingen av disse gi `200`. De tre siste prøver om ingressen stoler på et
hode klienten har satt selv, med `IP` fra steg 4.

```sh
curl -sS -o /dev/null -w '%{http_code}\n' "https://$FQDN/healthz"
curl -sS -o /dev/null -w '%{http_code}\n' -H "X-Forwarded-For: $IP" "https://$FQDN/healthz"
curl -sS -o /dev/null -w '%{http_code}\n' -H "X-Real-IP: $IP" "https://$FQDN/healthz"
curl -sS -o /dev/null -w '%{http_code}\n' -H "Forwarded: for=$IP" "https://$FQDN/healthz"
```

Målt av dirigenten i Azure 28.09, med lista satt til en annen adresse enn
maskinens: `403` med «RBAC: access denied» for alle fire, også med begge
adressene i `X-Forwarded-For`. Med maskinens egen adresse i lista svarte
`/healthz` `{"ok":true,"mode":"live"}`. Ingressen stoler altså ikke på hoder
klienten har satt, og en liste med bare `Allow` stenger alle andre.

Ny adresse, for eksempel hjemmefra: kjør steg 4 på nytt med den nye. Kjøres
steg 4 uten nøkkel, står appen i live uten nøkkel, og backenden svarer 401.

### Fasettene i filterpanelet

Uten Typesense-variablene sier panelet at filtrering ikke er tilgjengelig, og
utdragene at teksten ikke kunne hentes; se
[Fasettene i filterpanelet](#fasettene-i-filterpanelet) og
[Teksten i utdragene](#teksten-i-utdragene). Med dem: sett de fire under og
kjør steg 4 igjen. Nøkkelen leses med `read -rs`, og `deploy_live` fjerner den
fra skallet etterpå. Det skal være en nøkkel som bare kan søke i dokument- og
bitsamlingen, **ikke adminnøkkelen**; se
[Fasettene i filterpanelet](#fasettene-i-filterpanelet).

```sh
read -rs TYPESENSE_API_KEY
TYPESENSE_URL="lim-inn-typesense-adressen-her"
KA_FACET_COLLECTIONS="kudos-full=lim-inn-dokumentsamlingen-her"
KA_CHUNK_COLLECTIONS="kudos-full=lim-inn-bitsamlingen-her"
export TYPESENSE_URL TYPESENSE_API_KEY KA_FACET_COLLECTIONS KA_CHUNK_COLLECTIONS
```

### Ny versjon

```sh
build_image
az containerapp update --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test \
  --image "$ACR.azurecr.io/ka-frontend-test:$KA_IMAGE_TAG" --revision-suffix hand${KA_IMAGE_TAG:0:7}
```

`update` tar med seg nøkkelen, modusen og adresselista fra revisjonen før. Å
kjøre steg 4 igjen gjør det samme, og setter i tillegg alt fra fila.

### Samme passord for backenden

Backenden henter bildet med det samme passordet; se `deploy/rag.bicep`.
Admin-brukeren følger `registryAdminUser` i `main.bicep`, som er på som
standard. En kjøring av `main.bicep` uten `test.bicepparam`, som i «Slå den
på» eller «Første gang», slår den derfor ikke av. Sett `registryAdminUser=false`
bare når ingenting i ressursgruppa henter med passordet.

## Delt hemmelighet

Til Entra er koblet på: én lenke med en hemmelighet, som deles for hånd, og
som virker fra hvor som helst. Koden er `server/access.ts`.

- `?secret=` på en hvilken som helst adresse sammenlignes i konstant tid.
  Stemmer den, setter serveren en informasjonskapsel og sender til samme
  adresse **uten** hemmeligheten, med `Referrer-Policy: no-referrer`.
- Uten gyldig kapsel gir alt 401: sidene med en kort norsk tekst, `/api/*`
  med JSON. `/config.js` og filene i `dist/` også. `/healthz` er åpen, fordi
  utrullingen sjekker den. Feil hemmelighet gir samme 401 som ingen.
- Kapselen er ikke hemmeligheten, men en HMAC av en fast streng med
  hemmeligheten som nøkkel. `HttpOnly`, `SameSite=Lax`, `Secure` utenfor
  localhost, og 30 dager: lenge nok til at ingen trenger lenken hver dag, kort
  nok til at en mistet maskin går ut av seg selv. Byttes hemmeligheten, virker
  ingen gamle kapsler.
- Kortere enn 24 tegn stopper både malen og serveren. Tom er av.

Hemmeligheten skrives aldri ut i terminalen. Den lages rett inn i en fil bare
du kan lese, leses derfra når malen kjøres, og lenken går rett til
utklippstavla. Den står i lenken du deler, så den er ikke hemmeligere enn
stedet du deler den. Om nettleserens historikk tar vare på den første
adressen, er ikke målt.

### Lage den

URL-trygg, 43 tegn, i `~/.config/ka-rag-test/`. Den siste linja skriver
lengden, ikke verdien.

```sh
mkdir -p ~/.config/ka-rag-test
chmod 700 ~/.config/ka-rag-test
(umask 077; openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n' > ~/.config/ka-rag-test/access-secret)
wc -c < ~/.config/ka-rag-test/access-secret
```

### Rulle den ut

Steg 4 i [Live for én person](#live-for-én-person). `deploy_live` finner fila
selv.

### Dele lenken

Lenken bygges og legges på utklippstavla med `pbcopy` (macOS), uten å vises.
Lim den inn der du deler den.

```sh
FQDN=$(az containerapp show --subscription Altinn-AI-Assistant -g rg-ka-test -n ka-frontend-test --query properties.configuration.ingress.fqdn -o tsv)
printf 'https://%s/?secret=%s' "$FQDN" "$(cat ~/.config/ka-rag-test/access-secret)" | pbcopy
curl -sS -o /dev/null -w '%{http_code}\n' "https://$FQDN/"
curl -fsS "https://$FQDN/healthz"
```

Forsiden uten lenken skal gi `401`, og `/healthz` skal svare
`{"ok":true,"mode":"live"}`.

### Bytte den

Lag fila på nytt med blokka under «Lage den», kjør steg 4, og del den nye
lenken. Gamle kapsler slutter å virke når den nye revisjonen svarer; til da
svarer den gamle, med den gamle hemmeligheten.

## Første gang

Oppskriften kjøres ovenfra og ned, i ett skall, fra repo-rota. Alt havner i
`rg-ka-test`, også registeret bildene ligger i; se
[Hvorfor eget register](#hvorfor-eget-register). Ressursgruppa finnes
(`norwayeast`, taggene `prosjekt=kunnskapsassistenten` og `miljo=test`), så
oppskriften lager den ikke. `rg-ka-app` hører til en annen app og brukes ikke her. Bytt
verdiene i steg 0 hvis det blir andre.

### Rettigheter du trenger først

| Hva                                                                                                             | Hvor                       | Steg |
| --------------------------------------------------------------------------------------------------------------- | -------------------------- | ---- |
| Contributor (eller Owner)                                                                                       | ressursgruppa `rg-ka-test` | 1, 5 |
| Owner, User Access Administrator eller Role Based Access Control Administrator                                  | ressursgruppa `rg-ka-test` | 2, 6 |
| Admin i repoet (for variablene)                                                                                 | GitHub                     | 3    |
| `Microsoft.App`, `Microsoft.OperationalInsights` og `Microsoft.ContainerRegistry` registrert (sjekkes i steg 0) | abonnementet               | 0    |

Ingen rettigheter i `altinnaicontainers` eller andre steder utenfor
ressursgruppa. Steg 2 og 6 er de eneste som krever rett til å gi roller. Uten
den og uten GitHub: [Live for én person](#live-for-én-person). Har du
den ikke, kan noen som har den kjøre akkurat de to stegene; kommandoene står
ferdige. Er Contributor bak PIM, aktiver den før du begynner.

Står ikke `Altinn-AI-Assistant` i `az account list --refresh -o table`, har du
ingen rolle i abonnementet ennå, og den første kommandoen i steg 0 feiler. Da
må noen med tilgang gi deg Contributor på `rg-ka-test`, eller kjøre
oppskriften.

### Steg 0: verdiene, og en sjekk

**Hver `az`-kommando i dokumentet har `--subscription "$SUB"`.**
Standardabonnementet på maskinen kan være et helt annet teams. Målt 28.09 sto
det på `dis-core-prod`, og uten parameteren ville kommandoene skrevet dit.
Oppskriften bruker ikke `az account set`, fordi den endrer standardvalget for
alle skall på maskinen.

Kommandoblokkene har heller ingen kommentarer. zsh på macOS tolker ikke `#`
som kommentar i et interaktivt skall, så en kommentar bak en kommando blir
argumenter til den.

```sh
SUB=Altinn-AI-Assistant
RG=rg-ka-test
APP=ka-frontend-test
REPO=larsekhansen/kunnskapsassistenten-frontend

az account show --subscription "$SUB" --query '{abonnement:name, id:id}' -o table
az extension add --name containerapp --upgrade --only-show-errors
for provider in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry; do
  echo "$provider $(az provider show --subscription "$SUB" -n $provider --query registrationState -o tsv)"
done
az group show --subscription "$SUB" -n $RG --query location -o tsv
```

Den første linja skal vise `Altinn-AI-Assistant`. Gir den en feil, har du ikke
tilgang, og da stopper du her. Alle tre providerne skal stå som `Registered`.
Den siste linja skal vise regionen til `rg-ka-test`.

Steg 4 og 7 starter `Deploy` og venter på den. Denne funksjonen gjør det, og den
venter på **akkurat den kjøringen den startet**. `gh run list -L 1` rett etter
`gh workflow run` kan ellers treffe forrige kjøring, som etter hver merge er en
som hoppet over og står grønn. Den sammenligner kjøringens ID og ikke
tidspunkt: GitHub gir kjøringer stigende ID-er, så klokka på maskinen spiller
ingen rolle.

```sh
deploy_and_watch() {
  before=$(gh run list -R $REPO -w deploy.yml --event workflow_dispatch -L 1 --json databaseId -q '.[0].databaseId // 0')
  gh workflow run deploy.yml -R $REPO --ref main
  RUN=$before
  for _ in $(seq 1 40); do
    sleep 3
    RUN=$(gh run list -R $REPO -w deploy.yml --event workflow_dispatch -L 1 --json databaseId -q '.[0].databaseId // 0')
    [ "$RUN" -gt "$before" ] && break
  done
  [ "$RUN" -gt "$before" ] || { echo "Fant ingen ny Deploy-kjøring etter 40 forsøk."; return 1; }
  gh run watch -R $REPO "$RUN" --exit-status
}
```

### Steg 1: grunnmuren

Uten `imageTag` lager malen registeret, miljøet, loggene og de to
identitetene, men ingen app. Da kan rollene gis før appen prøver å hente et
bilde.

```sh
az deployment group create --subscription "$SUB" -g $RG -n ka-frontend-grunnmur \
  --template-file deploy/main.bicep --parameters name=$APP githubRepository=$REPO

ACR=$(az deployment group show --subscription "$SUB" -g $RG -n ka-frontend-grunnmur --query properties.outputs.registryName.value -o tsv)
ACR_ID=$(az acr show --subscription "$SUB" -n $ACR -g $RG --query id -o tsv)
RUNTIME_ID=$(az identity show --subscription "$SUB" -n $APP-id -g $RG --query principalId -o tsv)
DEPLOY_ID=$(az identity show --subscription "$SUB" -n $APP-deploy -g $RG --query principalId -o tsv)
DEPLOY_CLIENT_ID=$(az identity show --subscription "$SUB" -n $APP-deploy -g $RG --query clientId -o tsv)
```

`$APP-deploy` har en federert legitimasjon for
`repo:$REPO:ref:refs/heads/main`: bare en kjøring fra `main` i dette repoet kan
logge inn som den, og det ligger ingen hemmelighet noe sted.

### Steg 2: roller i registeret (krever rett til å gi roller)

Registeret er vårt eget, så begge rollene gjelder bare våre bilder. Appen
henter bildet med `AcrPull`, og GitHub pusher det med `AcrPush`.

```sh
az role assignment create --subscription "$SUB" --role AcrPull --scope "$ACR_ID" \
  --assignee-object-id "$RUNTIME_ID" --assignee-principal-type ServicePrincipal
az role assignment create --subscription "$SUB" --role AcrPush --scope "$ACR_ID" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal
```

En rolle kan bruke noen minutter på å slå inn. Vent litt før steg 4.

### Steg 3: variablene i GitHub

Ingen av dem er hemmelige, derfor variabler og ikke secrets.

```sh
gh variable set AZURE_CLIENT_ID       -R $REPO --body "$DEPLOY_CLIENT_ID"
gh variable set AZURE_TENANT_ID       -R $REPO --body "$(az account show --subscription "$SUB" --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID -R $REPO --body "$(az account show --subscription "$SUB" --query id -o tsv)"
gh variable set KA_REGISTRY           -R $REPO --body "$ACR"
```

Bare hvis du brukte andre navn i steg 0 (standardverdiene står i workflowen):

```sh
gh variable set KA_RESOURCE_GROUP -R $REPO --body "$RG"
gh variable set KA_APP_NAME       -R $REPO --body "$APP"
```

### Steg 4: første bilde, fra GitHub

```sh
deploy_and_watch
```

Denne kjøringen **blir rød, og det er ventet**: bildet pushes, men appen finnes
ikke ennå. Feilmeldingen «Appen finnes ikke» sier hvilken tagg den pushet.
Taggen er commiten akkurat denne kjøringen bygde, ikke din lokale `main`, som
kan være eldre:

```sh
TAG=$(gh run view -R $REPO "$RUN" --json headSha -q .headSha)
```

### Steg 5: appen

```sh
az deployment group create --subscription "$SUB" -g $RG -n ka-frontend-app \
  --template-file deploy/main.bicep --parameters name=$APP githubRepository=$REPO imageTag=$TAG \
  --query properties.outputs.fqdn.value -o tsv
```

Siste linje er adressen. Mock, ingen nøkkel.

### Steg 6: roller på appen (krever rett til å gi roller)

GitHub får oppdatere appen, og bare den. En oppdatering av en app med egen
identitet krever også rett til å «tildele» den identiteten, selv når den ikke
endres. Derfor trengs den andre rollen.

```sh
az role assignment create --subscription "$SUB" --role Contributor \
  --scope "$(az containerapp show --subscription "$SUB" -n $APP -g $RG --query id -o tsv)" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal
az role assignment create --subscription "$SUB" --role "Managed Identity Operator" \
  --scope "$(az identity show --subscription "$SUB" -n $APP-id -g $RG --query id -o tsv)" \
  --assignee-object-id "$DEPLOY_ID" --assignee-principal-type ServicePrincipal
```

Contributor på appen og ikke på ressursgruppa: `rg-ka-test` kan få andre ting i
seg, for eksempel en egen backend, og utrullingen trenger ikke røre dem.

### Steg 7: en ekte utrulling, og adressen på forsiden

```sh
deploy_and_watch
gh repo edit $REPO --homepage "https://$(az containerapp show --subscription "$SUB" -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)"
```

Kjøringen blir grønn, og adressen står i sammendraget og under **Deployments →
test**. Den andre linja legger den også øverst på repoets forside, under
«About», der `docs/kom-i-gang.md` sier at den står.

### Når repoet flyttes til digdir

Den federerte legitimasjonen gjelder bare `repo:larsekhansen/kunnskapsassistenten-frontend:ref:refs/heads/main`.
Den dagen repoet flyttes, slutter utrullingen å kunne logge inn. Kjør steg 1 på
nytt med det nye navnet (`REPO=digdir/<navn>`), og sett variablene i steg 3 i
det nye repoet. Resten står.

## Hvorfor eget register

Bildene ligger i et register malen lager i `rg-ka-test`, og ikke i det delte
`altinnaicontainers`. Der bygger også `ka-app` i digdir/kunnskapsassistenten, og
`AcrPush` gjelder hele registeret den gis på: en kjøring fra `main` her kunne
da ha overskrevet bildene der. Utrullingen skal bare kunne skrive til sine egne.

Alternativene, og hvorfor de ikke ble valgt:

- **Rettigheter per repository i `altinnaicontainers`** (ABAC, rollen
  `Container Registry Repository Writer` med en betingelse på
  `ka-frontend-test`). Da må registeret slås over til ABAC-modus, og i den
  modusen gjelder ikke `AcrPull` og `AcrPush`
  ([Microsofts dokumentasjon](https://learn.microsoft.com/azure/container-registry/container-registry-rbac-abac-repository-permissions)).
  `ka-app` ville mistet rollen den henter bildene sine med, til noen ga den nye.
- **Token med scope map.** Kan begrenses til ett repository, men er et passord,
  og det måtte ligget som hemmelighet i GitHub. Hele utrullingen er bygget for
  å klare seg uten.

Prisen, fra Azures offentlige prisliste for Norway East 28.09: Basic koster
0,1666 USD per dag, altså ca. 5 USD i måneden, med 10 GiB lagring inkludert og
0,10 USD per GB i måneden utover det. Basic har Entra-innlogging, som er alt
utrullingen bruker ([SKU-oversikten](https://learn.microsoft.com/azure/container-registry/container-registry-skus)).
Hvert nytt bilde legger bare til de lagene som endrer seg, målt til ca. 2 MB
(klienten og serveren; Node-laget på ca. 60 MB lagres én gang), så 10 GiB
holder lenge.

Malen låser registeret til den klassiske rollemodusen. Microsoft skal gjøre
ABAC til standard for nye registre, og da ville `AcrPull` og `AcrPush` i steg 2
ikke virket. ABAC gir heller ikke noe her, der registeret bare har våre egne
bilder.

Registerets navn er `kafrontend` pluss en verdi avledet av ressursgruppa, fordi
navnet må være unikt i hele Azure. Det står i utdataene fra steg 1 og i
GitHub-variabelen `KA_REGISTRY`.

## Verdiene i et nytt skall

Kommandoene fra og med her bruker de samme variablene som oppskriften. I et
skall der den ikke er kjørt, hentes de slik; registernavnet ligger i
GitHub-variabelen fra steg 3.

```sh
SUB=Altinn-AI-Assistant
RG=rg-ka-test
APP=ka-frontend-test
REPO=larsekhansen/kunnskapsassistenten-frontend
ACR=$(gh variable get KA_REGISTRY -R $REPO)
```

## Innlogging

Container Apps' egen innlogging («Easy Auth»), med Entra som leverandør. Den
står foran alt appen svarer på, unntatt `/healthz`, og sender den som ikke er
logget inn til Microsofts innloggingsside. Malen slår den på når den får
`entraClientId`. Uten er appen åpen, eller bare åpen for adresselista.

Entra venter til etter lanseringen. Til da er det
[Live for én person](#live-for-én-person) som gjelder.

**Ikke prøvd mot Azure.** Malen bygger uten advarsler, og serveren er testet
med plattformens hode satt for hånd. Selve innloggingen kan ikke prøves før
registreringen finnes og malen er kjørt.

### Hvem brukeren er

Bak innloggingen tar serveren brukeren fra plattformen og ikke fra nettleseren.
`X-User-Id` til backenden blir verdien i `X-MS-CLIENT-PRINCIPAL-ID`, og det
nettleseren sendte, kastes. Mangler hodet, svarer `/api/*` 401. Da kan ingen
bak innloggingen lese andres tråder ved å sende deres id.

Microsoft om hodene: «External requests aren't allowed to set these headers, so
they're present only if set by Container Apps»
([Container Apps](https://learn.microsoft.com/azure/container-apps/authentication#access-user-claims-in-application-code);
samme setning for [App Service](https://learn.microsoft.com/azure/app-service/configure-authentication-user-identities)).
Det gjelder bare med innloggingen foran. Uten kan hvem som helst sende hodet
selv, og derfor setter malen `KA_USER_ID_FROM=platform` sammen med innloggingen
og ellers aldri. Sett den ikke for hånd.

Alle i tenanten kan logge inn, også gjester. Skal bare noen slippe inn, slås
«Tilordning påkrevd» på for registreringen under **Bedriftsapper**, og brukerne
tildeles der
([Microsoft](https://learn.microsoft.com/entra/identity-platform/howto-restrict-your-app-to-a-set-of-users)).

### App-registreringen

Uansett vei trenger registreringen dette:

- plattformen **Web** med redirect-URI-en
  `https://<adressen>/.auth/login/aad/callback` (malen skriver den ut som
  `loginRedirectUri`);
- **ID-tokens** slått på, under **Autentisering**: «ID-tokens (brukes for
  implisitte og hybride flyter)». Microsoft krever det for plattformens
  innlogging;
- en **client secret** til oss. Den utløper, og da feiler innloggingen til en ny
  er lagt inn med malen.

Adressen, når appen finnes (steg 5):

```sh
FQDN=$(az containerapp show --subscription "$SUB" -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv)
echo "https://$FQDN/.auth/login/aad/callback"
```

**Anbefalt: den eksisterende registreringen.** `altinn-ai-assistant-ka-sso` har
admin-samtykke. Legges vår redirect-URI og en egen secret til der, trengs ikke
nytt samtykke. Det må eieren av registreringen eller en admin gjøre. Microsoft
anbefaler egen registrering per app og miljø; delt er valgt fordi en ny trenger
admin-samtykke vi ikke har.

**Alternativ: en ny registrering.** Vanlige brukere kan lage registreringer i
tenanten, så den kan lages i Entra-portalen: **App-registreringer → Ny
registrering**, «Bare kontoer i denne organisasjonskatalogen», plattform
**Web** med redirect-URI-en over. Slå så på ID-tokens og lag en client secret.
Men brukere kan ikke samtykke selv i tenanten, så ingen kan logge inn før en
admin har gitt samtykke under **API-tillatelser**.

Den som skal inn, må finnes i tenanten, som medlem eller gjest. Gjester
inviteres i Entra-portalen under **Brukere → Ny bruker → Inviter ekstern
bruker**; alle i tenanten kan invitere.

### Slå den på

Malen kjøres med registreringens klient-ID og secret, og med taggen som kjører
nå (se [Bytte mellom mock og live](#bytte-mellom-mock-og-live) om hvorfor).
`read -rs` leser secreten uten å vise den. Tenanten er abonnementets; ligger
registreringen et annet sted, gi også `entraTenantId`.

```sh
CLIENT_ID="lim-inn-klient-id-her"
read -rs CLIENT_SECRET
TAG=$(az containerapp show --subscription "$SUB" -n $APP -g $RG --query 'properties.template.containers[0].image' -o tsv | cut -d: -f2)
az deployment group create --subscription "$SUB" -g $RG -n ka-frontend-innlogging \
  --template-file deploy/main.bicep \
  --parameters name=$APP githubRepository=$REPO imageTag=$TAG entraClientId="$CLIENT_ID" entraClientSecret="$CLIENT_SECRET" \
  --query properties.outputs.loginRedirectUri.value -o tsv
```

Kom appen fra [Live for én person](#live-for-én-person), kjøres ikke blokka
over. Der settes `KA_ENTRA_CLIENT_ID` og `KA_ENTRA_CLIENT_SECRET` (den siste
med `read -rs`), eksporteres sammen med de andre, og steg 4 kjøres på nytt.
Ellers ville frontenden gått tilbake til AcrPull, som ingen har gitt.
Admin-brukeren blir stående uansett, så backenden henter som før.

Klient-ID uten secret stopper utrullingen med en melding i stedet for å falle
tilbake til implisitt flyt, som Microsoft fraråder. Det er bygd, ikke prøvd
mot ARM.

Malen setter appen slik parameterne sier, også modus og nøkkel. Var live slått
på for hånd, slås den på igjen etterpå. Kjøres malen senere uten
innloggingsparameterne, slår den innloggingen av, fordi den alltid tar med
innloggingsoppsettet og da med `enabled: false`. Målt i Azure 28.09: et
oppsett med bare det godtas.

Sjekk etterpå. `/healthz` svarer uten innlogging, forsiden sender videre til
Microsoft, og et API-kall med plattformens hode satt av klienten slipper ikke
forbi innloggingen:

```sh
curl -fsS "https://$FQDN/healthz"
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://$FQDN/"
curl -sS -o /dev/null -w '%{http_code}\n' -H 'X-MS-CLIENT-PRINCIPAL-ID: noen-andre' "https://$FQDN/api/conversations"
```

Den første skal svare `{"ok":true,"mode":"mock"}`, den andre med en
omdirigering til `login.microsoftonline.com`, og den tredje med en
omdirigering og ikke `200`. Serverens oppstartslinje i loggen sier «bruker-id
fra plattformens innlogging».

### Slå den av

Rekkefølgen er poenget. Serveren går først over til mock uten nøkkel og uten
`KA_USER_ID_FROM`, og innloggingen slås av først når den revisjonen er den
som svarer. Omvendt ville serveren stått uten noe foran seg og stolt på
plattformens hode fra hvem som helst, med nøkkelen på (KA CC på #169). I mock
sender den ingenting til backenden.

```sh
az containerapp update --subscription "$SUB" -n $APP -g $RG \
  --set-env-vars KA_MODE=mock --remove-env-vars DIGDIR_API_KEY KA_USER_ID_FROM \
  --revision-suffix open$(date +%H%M%S)
az containerapp show --subscription "$SUB" -n $APP -g $RG --query '{klar:properties.latestReadyRevisionName, siste:properties.latestRevisionName}' -o table
```

Kjør den siste linja til begge kolonnene viser samme revisjon. `--set-env-vars`
og `--remove-env-vars` i samme kall brukes etter hverandre, ifølge kildekoden
til `containerapp`-utvidelsen; det er ikke kjørt. Så:

```sh
az containerapp auth update --subscription "$SUB" -n $APP -g $RG --enabled false
```

Da er adressen åpen, og serveren sender ingenting til backenden. Klienten i
bildet er bygget for live, så spørsmål får en feil til et bilde bygget for mock
er rullet ut (se [Bytte mellom mock og live](#bytte-mellom-mock-og-live)).

## Rulle tilbake

- **Enklest, og uten Azure:** åpne den mergede PR-en på GitHub og trykk
  **Revert**. Det gir en ny PR som angrer endringen; merge den, så rulles den
  gamle versjonen ut som en hvilken som helst annen.
- **Raskere, uten ny PR:** åpne en eldre, grønn kjøring under **Actions →
  Deploy** og velg **Re-run all jobs**. En omkjøring bygger den commiten den
  gjaldt, og ruller den ut. Neste merge ruller ut `main` igjen.
- **Fra kommandolinja:** et eldre bilde, med en ny revisjon. Bytt ut verdien
  av `COMMIT` med hele commit-sha-en fra en eldre, grønn kjøring.

  ```sh
  COMMIT="lim-inn-commit-sha-her"
  az containerapp update --subscription "$SUB" -n $APP -g $RG \
    --image "$ACR.azurecr.io/$APP:$COMMIT" --revision-suffix rollback$(date +%H%M%S)
  ```

Ikke tilbake forbi #169 med innloggingen på: et eldre bilde leser ikke
`KA_USER_ID_FROM`, og da gjelder nettleserens `X-User-Id` igjen bak
innloggingen. Det sender heller ikke `/api/*` bort i mock.

## Logger

Serverens egne linjer, så plattformens (henting av bildet, oppstart og
prober), og til slutt hvilke revisjoner som finnes og kjører:

```sh
az containerapp logs show --subscription "$SUB" -n $APP -g $RG --follow --tail 100
az containerapp logs show --subscription "$SUB" -n $APP -g $RG --type system
az containerapp revision list --subscription "$SUB" -n $APP -g $RG -o table
```

I portalen: appen → **Log stream**. Utrullingens egen logg er kjøringen under
**Actions → Deploy**.

## Modus og korpus uten å bygge på nytt

`vite build` baker `VITE_*` inn i bundelen, så et bilde ville ellers vært låst
til modusen det ble bygget i. Serveren skriver derfor `window.__KA_CONFIG__` i
`/config.js`, som klienten leser før bundelen kjører (`src/api/runtimeConfig.ts`).
Ett bilde, og modusen og korpuset er miljøvariabler.

| Variabel                     | Hva                                                                                       | Standard                |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------- |
| `PORT`                       | Porten serveren lytter på.                                                                | `8787`                  |
| `KA_MODE`                    | `mock` eller `live`: om serveren sender kall videre. Alt annet enn `live` er mock.        | `mock`                  |
| `DIGDIR_API_BASE`            | Backenden `/api/*` går til.                                                               | `http://localhost:8080` |
| `DIGDIR_API_KEY`             | Nøkkelen. Container Apps-secret, aldri i repoet.                                          | tom                     |
| `KA_USER_ID_FROM`            | `browser` eller `platform`, se [Innlogging](#innlogging). Annet stopper serveren.         | `browser`               |
| `KA_ACCESS_SECRET`           | Den delte hemmeligheten, se [Delt hemmelighet](#delt-hemmelighet). Container Apps-secret. | tom                     |
| `VITE_KA_TENANT`             | Tenant. Begge eller ingen, se under.                                                      | tom                     |
| `VITE_KA_DATASET_CONFIG_KEY` | Datasettnøkkel. `kudos` hostet, `default` lokalt.                                         | tom                     |
| `VITE_KA_DATASETS`           | Korpusene velgeren tilbyr: `nøkkel=Navn\|beskrivelse;…`.                                  | tom                     |
| `VITE_KA_FILTER_FIELDS`      | Feltnavn per datasett: `datasett=dimensjon:felt:type\|…`.                                 | tom                     |
| `VITE_KA_DOCUMENT_URLS`      | Lenke til dokumentet per datasett: `datasett=mal for tall\|mal for UUID;…`.               | tom                     |
| `TYPESENSE_URL`              | Typesense for fasettene og utdragene, med skjema og port.                                 | tom                     |
| `TYPESENSE_API_KEY`          | Nøkkelen til den. Container Apps-secret, aldri i repoet.                                  | tom                     |
| `KA_FACET_COLLECTIONS`       | Dokumentsamlingen per datasett: `datasett=samling;…`.                                     | tom                     |
| `KA_CHUNK_COLLECTIONS`       | Bitsamlingen per datasett, for teksten i utdragene: `datasett=samling;…`.                 | tom                     |

`VITE_KA_FILTER_FIELDS` sier hva hvert korpus kaller filterdimensjonene
`documentType`, `organisation` og `year`, så feltnavna ikke står i koden. En
dimensjon uten oppføring filtreres det ikke på. Se README, «Hva korpuset
kaller filterdimensjonene».

`VITE_KA_DOCUMENT_URLS` sier hvor et dokument kan leses. Bitene fra
backenden har dokumentnummeret (`doc_num`), men ingen adresse, så klienten
setter nummeret inn i malen for datasettet. Det er to maler, delt med `|`:
først for et nummer med bare sifre, så for en UUID. Kudos har begge, på hver
sin adresse, og API-et deres gir nå bare UUID:
`kudos-full=https://kudos.dfo.no/documents/{doc_num}|https://kudos.dfo.no/dokument/{doc_num}`.
Et nummer i en annen form, eller et datasett uten oppføring, gir ingen lenke,
og da viser kildepanelet at dokumentet ikke har noen offentlig lenke. Koden
er `src/api/documentUrls.ts`.

`VITE_KA_TENANT` og `VITE_KA_DATASET_CONFIG_KEY` er **begge eller ingen**.
Backenden bygger datasett-scopet bare når den har begge, så én alene blir
forkastet der og svaret kommer fra standardkorpuset likevel — et halvt
oppsett ser ut som om det peker på pilotkorpuset og svarer fra demodataene.

## Fasettene i filterpanelet

Backenden har ikke noe fasett-API, så serveren teller fasettene selv fra
Typesense og svarer på `GET /api/facets?dataset=…` uten å sende den videre.
Det er broen i `src/decisions/0004-corpus-knowledge-and-facets.md`, og
formatet er det samme som BFF-en bruker. Den dagen backenden kan telle, byttes
kilden bak ruta og klienten endres ikke. Koden er `server/facets.ts`.

- **Feltene** er de i `VITE_KA_FILTER_FIELDS` for datasettet, og ingen andre.
- **Policyen:** år bare fra 1990 til inneværende år i Norge, nyeste først, resten etter
  antall. Tomme verdier og felt uten verdier er ute. Typesense bes om opptil
  2000 verdier per felt, så det er policyen og ikke grensen som velger.
- **Tallene** gjelder hele korpuset. Klienten viser dem ikke når en annen
  dimensjon er avgrenset, som for BFF-en. Derfor går ingen verdi fra
  nettleseren inn i spørringen; datasettnøkkelen slås bare opp i
  `KA_FACET_COLLECTIONS`.
- **Svaret** lagres i ti minutter per datasett, så panelet ikke spør Typesense
  ved hvert klikk.
- **Uten** `TYPESENSE_URL`, `TYPESENSE_API_KEY` og samlingen for datasettet
  svarer ruta tom liste, og panelet sier som før at filtrering ikke er
  tilgjengelig. Svarer Typesense med feil, blir det 502, og panelet tilbyr å
  prøve igjen.

**Adminnøkkelen til Typesense skal ikke til Azure.** Den kan slette
samlinger, og frontenden står mot internett; i dag ligger den bare i
backenden, som har intern adresse. Rutene gjør bare søk, så frontenden trenger
en nøkkel som bare kan søke (`documents:search`) i dokumentsamlingen og i
bitsamlingen, og ikke i noe annet. Hvordan den skaffes, er ikke avgjort. Lokalt
kan adminnøkkelen fra `.env.benjamin` brukes, som i
`docs/kjoremiljo-og-korpus.md`.

I mock svarer ruta 404 og spør ikke Typesense, som resten av `/api/`.
Dev-serveren svarer på den samme ruta med de samme variablene fra
`.env.local`, unntatt i bff-modus.

## Teksten i utdragene

Svaret fra backenden sier hvilke biter det bygger på, men ikke hva som står i
dem. Serveren slår derfor opp teksten selv i bitsamlingen i Typesense og
svarer på `GET /api/excerpts?dataset=…&ids=…` uten å sende den videre. Det er
broen i `src/decisions/0008-excerpt-text-and-sources-after-reload.md`.
Koden er `server/excerpts.ts`.

- **Samme** `TYPESENSE_URL` og `TYPESENSE_API_KEY` som fasettene, og
  bitsamlingen for datasettet i `KA_CHUNK_COLLECTIONS`. Nøkkelen må kunne søke
  i bitsamlingen også.
- **Id-ene** kommer fra nettleseren. Ruta tar bare id-er av bokstavene a–z og
  A–Z, sifre, `.`, `_`, `:` og `-`, og høyst 20 om gangen. Alt annet gir 400,
  og da blir ikke Typesense spurt.
- **Uten** variablene, eller for et datasett uten bitsamling, svarer ruta
  tomt, og utdragene sier at teksten ikke kunne hentes. Svarer Typesense med
  feil, blir det 502, og utdragene sier det samme. Svaret og lenkene til
  dokumentene kommer uansett.
- **Etter ny innlasting** slår klienten opp teksten på nytt med den samme
  ruta. Hvilke biter hvert svar bygger på, ligger i nettleseren
  (`ka.sources.v1`), for backenden lagrer dem ikke (headless-rag #21).

## Bytte mellom mock og live

**Ikke slå på live uten noe foran** ([Innlogging](#innlogging), eller
adresselista i [Live for én person](#live-for-én-person)). I live setter
serveren nøkkelen på hvert kall, for hvem som helst som kommer til adressen.
I mock sender serveren ingenting til backenden, heller ikke med nøkkelen satt.

Modusen har to deler. `KA_MODE` er serverens, og byttes med en ny revisjon som
under. Klientens modus er bygget inn i bildet (`src/api/apiMode.ts`), og
`/config.js` kan ikke endre den. Bildet fra `Deploy` er bygget for live. Et
miljø der klienten svarer fra mocken, trenger et bilde bygget med
`docker build --build-arg VITE_API_MODE=mock` i tillegg til `KA_MODE=mock`.

Nøkkelen legges inn som secret. Første gang lager dette
secreten. `read -rs` leser den uten å vise den og uten å legge den i
historikken. Deretter settes modus og nøkkel inn i en ny revisjon:

```sh
read -rs KEY
az containerapp secret set --subscription "$SUB" -n $APP -g $RG --secrets digdir-api-key="$KEY"
az containerapp update --subscription "$SUB" -n $APP -g $RG \
  --set-env-vars KA_MODE=live DIGDIR_API_KEY=secretref:digdir-api-key \
  --revision-suffix live$(date +%H%M%S)
```

Tilbake til mock:

```sh
az containerapp update --subscription "$SUB" -n $APP -g $RG \
  --set-env-vars KA_MODE=mock --remove-env-vars DIGDIR_API_KEY \
  --revision-suffix mock$(date +%H%M%S)
```

Nøkkelen tas bort også, selv om serveren ikke bruker den i mock: en variabel
som står, blir med til neste gang noen setter modusen til live.

`secret set` alene endrer ingenting som kjører: verdien plukkes opp av en ny
revisjon, som `update` tvinger fram. `KA_MODE` trenger ingen ny bygging, men
klientens modus gjør det (se over).

**Kjør ikke malen på nytt med en gammel `imageTag` for å bytte modus.** Den
setter bildet til den taggen, og da ruller du tilbake til den versjonen. Må den
kjøres igjen, gi den taggen som kjører nå:

```sh
TAG=$(az containerapp show --subscription "$SUB" -n $APP -g $RG --query 'properties.template.containers[0].image' -o tsv | cut -d: -f2)
```

Uten `imageTag` rører malen ikke appen i det hele tatt, bare grunnmuren.

Uten `digdirApiKey` utelater malen både secreten og variabelen. Det er ikke
målt om Container Apps godtar en secret med tom verdi; utelatt virker uansett.

## Bygge og rulle ut for hånd

For når GitHub ikke er et alternativ. `az acr build` laster opp arbeidstreet
og bygger i registeret, så ingenting må pushes først. Contributor på
ressursgruppa holder, siden registeret ligger der.

Funksjonen stopper hvis arbeidstreet har endringer som ikke er committet. Den
bruker `return` og ikke `exit`, for `exit` i et interaktivt skall lukker
terminalen.

```sh
deploy_by_hand() {
  git diff --quiet HEAD || { echo "Ucommittede endringer. Commit først."; return 1; }
  SHA=$(git rev-parse HEAD)
  az acr build --subscription "$SUB" --registry $ACR --image $APP:$SHA . || return 1
  az containerapp update --subscription "$SUB" -n $APP -g $RG \
    --image $ACR.azurecr.io/$APP:$SHA --revision-suffix hand${SHA:0:7}
}
deploy_by_hand
```

## Prøve det lokalt før Azure

Nøkkelen leses med `read -rs`, som over:

```sh
read -rs KEY
VITE_API_MODE=live npm run build
KA_MODE=live DIGDIR_API_BASE=http://localhost:8080 DIGDIR_API_KEY="$KEY" npm start
```

Eller i container. I mock, med klienten bygget for mock:

```sh
docker build --build-arg VITE_API_MODE=mock -t ka-frontend-test:mock .
docker run --rm -p 8787:8787 -e KA_MODE=mock ka-frontend-test:mock
curl -fsS localhost:8787/healthz
```

Den siste linja skal svare `{"ok":true,"mode":"mock"}`.

Mot stacken på maskinen, med bildet bygget for live som i testmiljøet:

```sh
docker build -t ka-frontend-test:local .
docker run --rm -p 8787:8787 \
  -e KA_MODE=live \
  -e DIGDIR_API_BASE=http://host.docker.internal:8080 \
  -e DIGDIR_API_KEY="$KEY" \
  -e VITE_KA_TENANT=demo -e VITE_KA_DATASET_CONFIG_KEY=norquad-docs \
  ka-frontend-test:local
```

`host.docker.internal` er hvordan containeren når stacken på maskinen, og den
virker under Colima — målt 22.09: containeren fikk svar med kilder fra
`localhost:8080` gjennom den. `localhost` inne i containeren er containeren
selv og treffer ingenting.

## Kjente grenser

**Spørsmål svarer ikke mot den hostede backenden.**
`test.rag.digdir.cloud` avviser `agent-rag-graph-bundled` med
`mode_not_allowed`, og det er agenten klienten spør. Målt med to
nøkler, så det er backendens oppsett og ikke et nøkkelomfang. Til backenden
åpner den, er et bilde bygget for mock det som gir et miljø der noen kan se produktet;
alt annet enn selve svaret virker også i live: tråder, filter, korpusvelger og
opplasting i ærlig utilgjengelig-tilstand.

**Datasettnøkkelen er `kudos` hostet, ikke `default`.** Feil verdi feiler hvert
kall med «API key is not allowed to access the requested dataset», som leser
som et rettighetsproblem.

**Innloggingen er ikke prøvd mot Azure**, og uten den er adressen åpen, eller
bare åpen for adresselista. Se [Innlogging](#innlogging) for hva som trengs.

**Ikke prøvd mot ARM:** at `fail()` stopper utrullingen. Målt av dirigenten i
Azure 28.09: appen henter bildet med registerets passord, og et
innloggingsoppsett med bare `enabled: false` godtas, slik at appen svarer uten
innlogging.

**Med adresseliste når ikke GitHub fram.** Helsesjekken i `deploy.yml` kommer
fra GitHubs maskiner, og de står ikke i lista. [Live for én
person](#live-for-én-person) bruker ikke GitHub, og uten repo-variablene hopper
workflowen over.

**Ikke målt: en økt som går ut midt i bruk.** Plattformen sender da API-kallet
videre til Microsofts innloggingsside, på et annet domene, og et `fetch`-kall
ventes å feile på det. En omlasting av siden logger inn på nytt.

**Hvem som helst med skrivetilgang til `main` ruller ut.** Det er poenget, men
det betyr også at en PR som er merget uten grønn CI, går rett ut. Den gamle
revisjonen står til den nye svarer på `/healthz`, men `/healthz` vet ikke om
siden ser riktig ut.
