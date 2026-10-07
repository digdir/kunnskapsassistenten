# Kunnskapsassistenten, applikasjonen

**Frontenden til Kunnskapsassistenten, bygd på `digdir-headless-rag`.**

Samme produkt, samme brukeropplevelse, ny teknologi og en annen backend. Den
skal kunne kjøres ved siden av den "gamle"
[Kunnskapsassistenten](https://test.kunnskap.digdir.cloud) og sammenlignes med
den. Selve poenget er byttet: hold frontenden konstant, bytt motoren under, og
finn ut hva den nye backenden faktisk klarer.

**Porten er gjennomført.** Klienten er skrevet om fra bunnen i Preact, snakker
med `digdir-headless-rag` over det offentlige API-et, og gir svar med kilder
mot Kudos-korpuset: tråder, strømmede svar med statusetiketter, kildepanel med
utdrag, filtre og innlogging. Underveis ga det elleve dokumenterte hull i
backendens offentlige kontrakt, og noe for [`../evals`](../evals) å kjøre mot.

## Utrullet

<https://qa.kunnskap.digdir.cloud>

Logg inn med Entra ID. Kontoer som finnes i tenanten slipper inn.

To ting er ikke på plass i det utrullede miljøet, og begge ligger i backenden,
ikke her:

- **Svar.** `test.rag.digdir.cloud` tilbyr bare `fact-checker` og
  `retrieve-only`, og avviser de agentiske RAG-modusene med `mode_not_allowed`.
  Appen er koblet opp og klar; den dagen agenten er slått på der, svarer den.
- **Filtre.** Den utrullede backenden tar ikke imot filteret fra klienten, så
  chipsene vises deaktivert med en forklaring. De slår seg på av seg selv når
  backenden begynner å ta imot dem, uten ny utrulling.

Mot en lokal backend med de foreslåtte endringene virker begge deler, og det
er der sammenligningen mot dagens Kunnskapsassistent gjøres.

```
apps/web           Vite + Preact + Designsystemet (-css / -web). Ingen hemmeligheter.
apps/server        Hono. Holder API-nøkkelen. Det eneste som snakker med backenden.
packages/contract  Typene som går mellom de to.
```

```
Preact SPA ──► apps/server ──► digdir-headless-rag
               (BFF-en)        /api/mcp     samtale + strømming
                               /v1/models   oppslag
                          ──► Typesense     fasetter, utdrag fra kilder
                                            (ingen av delene finnes i API-et)
```

Nettleseren får aldri API-nøkkelen. Det er et krav fra backenden, ikke en
preferanse: den autentiserer applikasjoner og ikke personer, og `X-User-Id`
godtas uten verifisering. Derfor må noe på serversiden _være_ identiteten. Se
[`decisions/0002`](decisions/0002-backend-for-frontend.md).

## Komme i gang

Fra en ny klone til appen på din maskin, med testene. Hver blokk kjøres for
seg, og alle kommandoene etter `cd` kjøres i `src/`. Målt 06.10 på macOS med
Node 24.21.0 og npm 11.19.0.

### 1. Klonen og Node 24

`mise.toml` låser Node-versjonen. Med [mise](https://mise.jdx.dev) aktivert i
skallet:

```sh
git clone https://github.com/digdir/kunnskapsassistenten.git
cd kunnskapsassistenten/src
mise trust
mise install
node --version
```

Den siste skal skrive `v24.21.0`. Har du Node 24.15 eller nyere fra før,
holder det: `engines` krever `>=24.15`, som jsdom i `apps/web-preact` gjør, og
`.npmrc` har `engine-strict`.

### 2. Avhengighetene

```sh
npm ci
```

Én låsefil for hele workspace-et: BFF-en i `apps/server`, klienten i
`apps/web` og typene mellom dem i `packages/contract`.

`npm ci` kjører `prepare` i `apps/web`, og den legger `pre-commit` og
`pre-push` i `.git/hooks` for hele repoet. `pre-commit` kjører lint-staged på
filene som committes, og `pre-push` typesjekker klienten. npm 11 kjører ikke
installasjonsskript fra avhengigheter som ikke er godkjent i `allowScripts`, og
sier på slutten fra om `simple-git-hooks` og `fsevents`. Krokene kommer likevel,
fra `prepare`, og resten av oppskriften virker uten de to skriptene.

### 3. BFF-en mot en backend

```sh
cp apps/server/.env.example apps/server/.env
```

Fyll inn `DIGDIR_API_BASE` og `DIGDIR_API_KEY` i `apps/server/.env`. Er
datasettet et annet enn standarden, også `DIGDIR_TENANT` og
`DIGDIR_DATASET_CONFIG_KEY`. `KA_FILTER_FIELDS` og `KA_DATASETS` gir klienten
feltene i filteret og navnet på korpuset. Typesense (`TYPESENSE_API_HOST`,
`TYPESENSE_API_KEY_ADMIN` og `KUDOS_DOCS_COLLECTION`) er valgfritt. Nøkkelen
blir i BFF-en og når aldri nettleseren.

```sh
npm run doctor
```

`npm run doctor` er den raske måten å finne ut hvorfor ingenting virker.
Den sjekker at nøkkelen autentiserer, at den gir tilgang til agenten som er
satt opp, at samtale-API-et svarer, og at Typesense er tilgjengelig. Feiler
noe, sier den hva du skal endre.

To backender, styrt av `DIGDIR_API_BASE`:

|                                 |                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `https://test.rag.digdir.cloud` | utrullet testmiljø. Ingenting å kjøre selv, men du trenger en nøkkel for det miljøet. |
| `http://localhost:8099`         | lokalt. Oppsett ligger i `digdir-headless-rag`.                                       |

Nøkler gjelder per miljø: en som er laget lokalt autentiserer ikke mot den
utrullede backenden. Typesense er valgfritt. Uten det kjører appen fint, men
filterraden skjules og kildekortene viser ingen utdrag.

### 4. BFF-en og klienten sammen

```sh
VITE_API_MODE=bff KA_BFF_URL=http://localhost:8787 npm run dev
```

BFF-en starter på `PORT` fra `.env` (8787), og klienten på
<http://localhost:5173>, med `/api` og `/auth` sendt videre til BFF-en.
`KA_BFF_URL` må med, for ellers ser klienten etter BFF-en på 8788. Er 5173
opptatt, velger Vite neste ledige port og skriver den ut.

### 5. Klienten alene, uten backend

```sh
npm run dev:web
```

Klienten i mock på <http://localhost:5173>: svarene er skrevet på forhånd, men
dokumentene er ekte, og filtrene virker. Den trenger verken `.env` eller
backend.

### 6. Testene

```sh
npm run format:check
npm run typecheck
npm test
npm run lint --workspace apps/web
npm run build
```

`npm test` kjører serverens tester med `node --test` og klientens med vitest.

End-to-end med Playwright. Suiten bygger klienten i mock og tester den på
port 4173, eller på den `KA_E2E_PORT` sier.

```sh
npx playwright install chromium
npm run test:e2e --workspace apps/web
```

### 7. Bildet

Det samme bildet som utrullingen bruker: BFF-en med den bygde klienten, fra
samme origin.

```sh
docker build --tag ka .
docker run --rm --detach --name ka --publish 8787:8787 -e AUTH_MODE=off -e APP_ORIGIN=http://localhost:8787 -e DIGDIR_API_KEY=unused ka
curl -fsS --retry 15 --retry-all-errors --retry-delay 1 http://localhost:8787/api/health
docker stop ka
```

`curl` skal skrive `{"ok":true}`.

Bildet har begge klientene. En nettleser uten cookien `ka_klient` får den
nåværende i `apps/web-preact`, eller den `KA_DEFAULT_CLIENT` sier (`ny` eller
`gammel`). `?klient=ny` og `?klient=gammel` bytter for én nettleser. Hver
klient spør sin egen versjon av API-et: `apps/web-preact` `/api/*` og
`apps/web` `/api/v2/*` (`decisions/0009`).

## Kommandoer

|                                         |                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                           | BFF-en og klienten, med watch. Klienten går i mock uten `VITE_API_MODE=bff`, se [Komme i gang](#komme-i-gang) |
| `npm run dev:web`                       | bare klienten, i mock                                                                                         |
| `npm run doctor`                        | sjekk forbindelsen til backenden                                                                              |
| `npm run build`                         | produksjonsbygg av klienten                                                                                   |
| `npm test`                              | server (node:test) og web (vitest)                                                                            |
| `npm run typecheck`                     | alle tre prosjektene                                                                                          |
| `npm run format`                        | prettier, skriver                                                                                             |
| `npm run format:check`                  | prettier, sjekker bare                                                                                        |
| `npm run lint --workspace apps/web`     | oxlint og stylelint i klienten                                                                                |
| `npm run test:e2e --workspace apps/web` | Playwright mot klienten i mock                                                                                |

## Status

Klienten virker ende til ende mot Kudos-korpuset gjennom BFF-en: tråder,
strømmede svar med agentens steg, og kilder med utdrag når Typesense er satt
opp.

Den samme builden kjører mot begge versjoner av backenden. Se [Hva backenden
støtter](#hva-backenden-støtter).

|                                                                   |                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Samtale gjennom BFF-en: strømmet svar og agentens steg            | ferdig. To visningsnivåer, Standard og Detaljert. Etter ny innlasting er stegene borte, for BFF-en tar ikke vare på dem |
| Trådliste: søk, endre navn, slett                                 | ferdig. Gruppert etter tid, spør før sletting, og tar endringen tilbake når BFF-en sier nei                             |
| Flere turer i samme tråd, startskjerm med forslag                 | ferdig                                                                                                                  |
| Adresser                                                          | `/threads/<id>` åpner tråden. Infosider, 404-side og egen sidetittel per rute                                           |
| Kilder: klikkbare `[n]`, utdrag per svar, «Kilder brukt i svaret» | ferdig, med søk i svaret og i kildene. Etter ny innlasting har bare siste svar kilder, fra BFF-ens minne                |
| Kopier svaret og lenken til tråden, nøkkelord fra søket           | ferdig                                                                                                                  |
| Lenke til tilbakemelding                                          | ikke med                                                                                                                |
| Valg av agent                                                     | ferdig, fra `/api/models`. Agentens modus kan ikke velges                                                               |
| Innlogging                                                        | i BFF-en, Entra ID, av lokalt. Se [Innlogging](#innlogging). Ved 401 tar klienten vare på utkastet før innloggingen     |
| Navn og «Logg ut»                                                 | fra `/api/me`. «Logg ut» tømmer også det klienten husker om svarene i nettleseren                                       |
| Bildet                                                            | BFF-en med klienten bygget i bff-modus, fra samme origin. Se [`deploy/`](deploy/README.md)                              |
| Filterpanel: fasetter med antall, låst per tråd                   | ferdig, med beskjed når filteret er låst. Felt og korpusnavn fra BFF-en                                                 |
| Filtre når backenden ikke tar imot dem                            | panelet sier «Filtrering er ikke tilgjengelig ennå»                                                                     |
| Genererte trådtitler                                              | faller tilbake på spørsmålet til backenden lager en                                                                     |
| Mapper                                                            | droppet. Backenden har tagger, ikke mapper                                                                              |
| Uten backend                                                      | mock med et utdrag av Kudos, til utvikling, demo og e2e                                                                 |
| Oppsett                                                           | paneler som endrer bredde, skuffer på smal skjerm, og lys og mørk modus                                                 |

## Hva backenden støtter

Serveren måler det ved oppstart i stedet for å anta det, og eksponerer
resultatet på `/api/capabilities`. Da virker den samme builden mot begge
versjoner av backenden, og filtrene slår seg på uten ny utrulling den dagen
endringene er inne.

Filtermålingen er en faktisk test, ikke en erklæring: den sender et filter som
ikke kan treffe noe, og sammenligner med samme søk uten filter. Kommer det
treff uten filter og null med, kom filteret fram. Uten den kontrollen ville en
backend som er nede sett ut som en som støtter filtre.

Tvinges med `KA_CAPABILITIES="filters"` eller `"no-filters"`.

## Innlogging

`AUTH_MODE` velger mekanisme.

|         |                                                                 |
| ------- | --------------------------------------------------------------- |
| `entra` | Entra ID. Det som kjører på `qa.kunnskap.digdir.cloud`.         |
| `off`   | Kun lokalt. Usignert id, hvem som helst kan bli hvem som helst. |

Utelater du `AUTH_MODE` utledes den: `entra` hvis Azure-variablene er satt,
ellers `off`. Serveren skriver hvilken modus den kjører i ved hver oppstart.

Ingen token når nettleseren, bare en signert informasjonskapsel. `/api/*`
svarer 401 uten innlogging, og `/api/health` er åpen. Hvem som slipper inn,
bestemmes av Entra ID og ikke av appen. `AUTH_MODE=off` nekter å starte hvis
`APP_ORIGIN` ikke er localhost. Oppsett i [`deploy/README.md`](deploy/README.md).

## Dokumentasjon

[`decisions/`](decisions/) er på engelsk, som resten av koden og som
`digdir-headless-rag`: hvorfor Preact, hvorfor en BFF, hvorfor `/api/mcp`
framfor `/v1`. 0004–0008 kom med klienten i `apps/web`: hvor kunnskapen om et
korpus skal bo, klienten bak BFF-en, filterfelt og korpusnavn fra BFF-en,
visningsnivået, og teksten i utdragene og kildene etter ny innlasting. 0009 er
API-et i to versjoner: `/api/*` i formatet fra main for klienten i
`apps/web-preact`, og `/api/v2/*` for klienten i `apps/web`.

[`deploy/README.md`](deploy/README.md) dekker utrulling til Azure og
innlogging.

## Hvor ting ligger

| Hvor                         | Hva                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/`                       | **Dette.** Applikasjonen: SPA, server og kontrakt.                                             |
| [`../docs/`](../docs)        | Designarbeid, akseptansekriterier, innsikt.                                                    |
| [`../evals/`](../evals)      | Evalueringene, som denne gir noe å kjøre mot.                                                  |
| `digdir/digdir-headless-rag` | **Backenden.** Brukes kun over HTTP.                                                           |
| `digdir/digdir-rag`          | **Arkivert.** Den opprinnelige Clojure-monolitten. Kilde til norsk tekst, ikke en avhengighet. |
| `digdir/digdir-rag-frontend` | **Egen alfa-demo.** Uten sammenheng med dette, tross navnet.                                   |

Arbeidsmateriale som hører til prosjektet men ikke til repoet, som den
opprinnelige planen, presentasjonene og det fangede stilarket, ligger utenfor i
`_notes/` ved siden av utsjekkene.
