# Funksjonssjekk

Hva ende-til-ende-testene i `tests/e2e/` dekker, hva som er merget men
udekket, og hva som er ventet men ikke bygget. Anmelderens fil, oppdatert i
takt med det dirigenten merger.

Kjøres med `npx playwright test` fra rota. Testene bygger appen og kjører mot
`vite preview` på port 4173 i mock-modus, headless Chromium, 1440 × 900,
`lang="nb"`. Hver testet tilstand kontrolleres med axe mot `wcag2a` og
`wcag2aa`; et brudd feiler testen.

**1440 × 900 er sant fra 2026-09-15.** Fram til da sto tallet i denne fila og
i kommentarene, og suiten kjørte i 1280 × 720: `devices['Desktop Chrome']` i
`projects` bærer sin egen viewport, og en prosjekt-`use` slås over den øverste.
Funnet av #2 i PR #55. Se «Suiten løy» nedenfor.

**111 tester, alle grønne** mot `main` `3c0b8bd`, og grønne i **1440 × 900**,
som er første gang det er målt der. Åtte av dem kom med #49 i
`feilmeldinger.spec.ts` og er #3 sine; fjorten er bølge 3, skrevet mot det som
ble merget 15.09: filteret som når spørringen,
tidsstempel på trådradene, korpuslinja, «Generer på nytt», oppsamlingsruta,
ukjent tråd, husket panel- og filtertilstand, samtalen som overlever en
reload, snarveien til skrivefeltet, hopp-lenke nummer to, kilder per svar, og
veien tilbake fra et utdrag til svaret.

**Én kjøring per port om gangen.** `KA_E2E_PORT=4174` flytter den, og det
trengs når suiten kjøres fra to arbeidstrær på denne maskinen samtidig.
Portfordelingen i natt: KA CC 4173, #2 4174, #3 4175, #4 4176, #5 4177.

Suiten **gjenbruker aldri** en preview-server som alt står på porten. En
server der tilhører noen andre, og å henge seg på den er hvordan en kjøring
ender med å teste et `dist` den ikke bygde selv. Kollisjon feiler nå med
portnummeret i meldinga, før første test, i stedet for å bli en spredning av
røde tester lenger inne.

De 22 testene for de tre viewene ble skrevet mot en lokal montering i
arbeidstreet mens monterings-PR-en ble laget, og **de passerte uendret mot den
ekte monteringen**. Det er i seg selv et resultat: skallet monterer viewene
slik de ble anmeldt.

## Dekket nå

| Det brukeren gjør                                          | Spec                        |
| ---------------------------------------------------------- | --------------------------- |
| Åpner `/` og `/threads/:id` med landemerker og én `h1`     | `shell.spec.ts`             |
| Tabber til hopp-lenka og hopper                            | `shell.spec.ts`, to tester  |
| Skjuler og viser navigasjonspanelet                        | `shell.spec.ts`             |
| Bytter fargemodus fra konsollen, uten reload               | `shell.spec.ts`             |
| Møter filtreringen som førstegangsbruker                   | `primary-sidebar.spec.ts`   |
| Velger en verdi og får en chip pluss «1 av 6 valgt»        | `primary-sidebar.spec.ts`   |
| «Velg alle» og «Tøm» uten å miste tastaturet               | `primary-sidebar.spec.ts`   |
| Veksler mellom filter og tråder                            | `primary-sidebar.spec.ts`   |
| Ser trådene gruppert på tidsrom                            | `primary-sidebar.spec.ts`   |
| Søker i tråder og får en treffteller                       | `primary-sidebar.spec.ts`   |
| Åpner en tråd og ser den merket med `aria-current`         | `primary-sidebar.spec.ts`   |
| Møter hilsenen og de tre kickstarterne                     | `chat.spec.ts`              |
| Fyller feltet fra en kickstarter uten å sende              | `chat.spec.ts`              |
| Stiller et spørsmål og får et strømmet svar med `[n]`      | `chat.spec.ts`              |
| Avbryter, og beholder teksten som kom                      | `chat.spec.ts`              |
| Kopierer svaret og får kvittering                          | `chat.spec.ts`              |
| Trykker en oppfølgingschip                                 | `chat.spec.ts`              |
| Åpner kildepanelet med en markør                           | `sources.spec.ts`           |
| Klikker `[n]` og havner i riktig utdrag, to ganger på rad  | `sources.spec.ts`           |
| Ser utdragene gruppert per dokument                        | `sources.spec.ts`           |
| Går fra en kilde under svaret til utdraget og tilbake      | `sources.spec.ts`           |
| Søker i utdragene og stepper mellom treff                  | `sources.spec.ts`           |
| Tabber gjennom hvert view i lys og mørk                    | alle fire spec-ene          |
| Beholder filtervalget gjennom veksling filter ↔ tråder     | `primary-sidebar.spec.ts`   |
| Beholder filtervalget gjennom et ruteskifte til en tråd    | `primary-sidebar.spec.ts`   |
| Måler layouten på 1280, 1440 og 1536 i lys og mørk         | `layout.spec.ts`            |
| Ser skrivefeltet i bunnen av vinduet på fem flater         | `layout.spec.ts`            |
| Åpner og kollapser sidekolonnene i hver kombinasjon        | `layout.spec.ts`            |
| Velger et filter og ser det nå spørringen                  | `samtale.spec.ts`           |
| Får «Generer på nytt» etter et avbrudd, og et helt svar    | `samtale.spec.ts`           |
| Starter en samtale på `/` og finner den igjen etter reload | `samtale.spec.ts`           |
| Skriver en adresse som ikke finnes                         | `shell.spec.ts`             |
| Får «Noe gikk galt», ikke hvit skjerm, ved oversettelse    | `feilgrense.spec.ts`        |
| Åpner en tråd-lenke som er blitt gammel                    | `shell.spec.ts`             |
| Finner panelet og filteret slik hen forlot dem             | `shell.spec.ts`             |
| Hopper til skrivefeltet med Ctrl+/                         | `chat.spec.ts`              |
| Lukker menyen i en samtale uten at den monteres på nytt    | `chat.spec.ts`              |
| Ser når hver tråd sist ble rørt                            | `primary-sidebar.spec.ts`   |
| Ser hva korpuset dekker, i én linje                        | `primary-sidebar.spec.ts`   |
| Ser en ny tråd dukke opp i lista mens den står åpen        | `traadliste.spec.ts`        |
| Ser en eldre tråd flytte seg til «I dag» etter et svar     | `traadliste.spec.ts`        |
| Sletter den siste tråden midt i et søk og ser den neste    | `traadliste.spec.ts`        |
| Ser at tenketiden er målt og ikke summert                  | `chat.spec.ts`              |
| Går tilbake til svaret fra et utdrag, med Escape og knapp  | `sources.spec.ts`           |
| En lang filterchip holder seg i feltet, 1440 og i skuffa   | `filter-chip.spec.ts`       |
| Når alle kontrollene i panelraden med peker                | `panel-head.spec.ts`        |
| Ser at et svar navngir korpuset det kom fra                | `corpus-per-answer.spec.ts` |
| Går til de tre sidene fra lenkene i foten                  | `shell.spec.ts`             |
| Skriver midt i en tråd uten at kolonnen flytter seg        | `chat.spec.ts`              |
| Åpner kildepanelet fra skinna med tastaturet, uten rulling | `layout.spec.ts`            |
| Ser spørsmålet i en boks mot slutten av linja              | `chat.spec.ts`              |

## Merget, men ikke dekket

| Sak                                           | Hvorfor ikke                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-modus mot den ekte backenden             | Testene kjører i mock-modus med vilje. Se raden under                                                                                                                       |
| Den ekte klienten                             | Testene kjører i mock-modus med vilje. Live krever nøkkel, en kjørende backend, og koster en agentkjøring per spørsmål. Proxyen er målt for hånd i `main-2026-09-11-pr8.md` |
| Lastetilstanden i kildepanelet                | Vises bare mens `documents` er `undefined`, og monteringen gir dem med én gang. Trenger enten en treg mock eller en egen rute                                               |
| Opplasting, «Vis flere dokumenter», topplinje | Ikke bygget. Se `skal-dette-implementeres.md`                                                                                                                               |

Feiltilstandene står ikke lenger her. Det er nå **seks** nøkkelord i det
bygde appet — `simuler feil`, `simuler feil modell`, `simuler feil korpus`,
`simuler tidsavbrudd`, `simuler ingen treff` og `simuler avvist nøkkel` — pluss
`simuler avklaring`, og `feilmeldinger.spec.ts` dekker dem.

Verdt å merke seg for den som skriver flere: et utløserord er et **eksakt**
treff på hele spørsmålet, så `simuler feil modell` er sitt eget spørsmål og
ikke et prefiks på det korte.

## Skjermbilder

`screenshots.spec.ts` lagrer hvert view i lys og mørk under faste navn i
`design/skjermbilder-frontend/e2e/`. Ingen av dem er en assert. Gjennomgangen
mot Figma står i [`visuell-2026-09-11.md`](visuell-2026-09-11.md).

**Bildene skrives bare når du ber om det** (fra 29.09), med
`KA_E2E_SCREENSHOTS`:

- uten variabel: ingen bilder. Det gjelder alle kjøringer fra en gren, en
  arbeiders arbeidstre og en klone av monorepoet.
- `KA_E2E_SCREENSHOTS=design`: referansebildene i
  `design/skjermbilder-frontend/e2e/`. Kjøringen stopper hvis den ikke finner
  `design/INDEX.md` oppover.
- `KA_E2E_SCREENSHOTS=/en/absolutt/sti`: bildene havner der, for eksempel for å
  se på poden uten å røre referansene.

Referansebildene tas fra `main` etter en merge, med
`KA_E2E_SCREENSHOTS=design KA_E2E_PORT=4173 CI=true npx playwright test screenshots.spec.ts`.

## Mot en ekte backend

Fra 29.09 kan suiten kjøres mot en server som alt kjører, for eksempel poden
bak BFF-en på 8791, i stedet for mock-bygget:

- `KA_E2E_BASE_URL`: adressen. Suiten bygger og starter da ingen server selv.
- `KA_E2E_ANSWER_TIMEOUT`: hvor mange sekunder en test venter på et ferdig
  svar. Standard er 30, som holder for mocken. En ekte modell brukte 66 s på
  ett svar 29.09. Tida for hele testen blir fire ganger så lang.
- Taggen `@mock` står på de 54 testene som bare passer mocken: fikstur-tråder,
  `simuler …`-spørsmål, mockens tall og mockens eget svar. `@ekte-svar` står på
  de 30 som trenger et ferdig svar. De 67 andre har ingen tagg.

Inndelingen er #5 sin fra 29.09 (`design/_briefs/bygg/e2e-inndeling-bff.txt`).
«En markør peker på et utdrag som finnes» er flyttet fra ekte svar til mock,
fordi spørsmålet fikk et motspørsmål fra en ekte modell.

```sh
KA_E2E_BASE_URL=http://localhost:8791 CI=true npx playwright test --grep-invert @mock
KA_E2E_BASE_URL=http://localhost:8791 KA_E2E_ANSWER_TIMEOUT=240 CI=true npx playwright test --grep @ekte-svar --workers 1
```

Én worker for de med ekte svar, fordi alle testene har samme identitet når
BFF-en kjører med `AUTH_MODE=off`, og fordi hvert svar koster.

**Ett ord er plattformavhengig — men ikke i denne suiten.** Hintet ved
skrivefeltet (`shortcutHint()` i `src/views/chat/text.ts`) og hurtigtasten i
hopplenka (`shortcutModifier()` i `src/layout/shortcutModifier.ts`) leser
begge `navigator.userAgent` og sier «Cmd» på en Mac, «Ctrl» ellers.

I e2e-suiten er ordet **alltid «Ctrl»**, uansett hvilken maskin den kjøres på:
`devices['Desktop Chrome']` i `playwright.config.ts` setter sin egen user
agent, og den er Windows. Målt 21.09 i suiten på en Mac:
`Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/153`, hint «Trykk Ctrl + /
for å hoppe hit», hopplenke «Hopp til skrivefeltet (Ctrl + /)». En påstand i
klartekst på «Ctrl» er derfor portabel her, og bildene fra denne maskinen og
fra CI er like på det ordet.

Fram til 21.09 sto det motsatte i denne fila. Det gjelder `a11y.sh`, som
kjører playwright-cli uten enhetsbeskrivelse og derfor ser maskinens ekte user
agent: der står det «Cmd» på en Mac. Samme app, to verktøy, to ord — og
forskjellen ligger i verktøyet, ikke i appen. Snarveistesten låser formen
`/^Trykk (Ctrl|Cmd) \+ \/ …$/`, som holder i begge.

## Det som måtte måles før det kunne påstås

**Kontrasten i en åpen fasettliste.** En påstand om 4,05:1 på option-teksten
sto åpen i to dager. #2 og jeg målte den uavhengig — 14,11:1 i lys, 12,6:1 i
mørk, over 275 options — men begge målingene leste `getComputedStyle`, og en
framheving tegnet med et pseudoelement eller en `box-shadow` ville ingen av
oss sett. Derfor er tilstanden nå en test: lista åpnet med tastaturet, en rad
framhevet, axe på hele siden, i begge moduser. **Null brudd.** Posten er
lukket som ikke reprodusert, og den kan ikke komme tilbake ubemerket.

**Den samme samtalen sier to forskjellige tenketider.** Live står det «Tenkte
i 2 sekunder», etter en reload «Tenkte i 4 sekunder» — målt 15.09 på samme
svar. Det ene er klokketid mens svaret ble til, det andre er summen av
stegenes egne `durationMs` slik de ble lagret. Ingen av dem er feil hver for
seg, men en leser som laster på nytt ser et nytt tall på noe som ikke har
endret seg. Testen for reload sammenligner derfor svarteksten og ikke hele
meldinga. Til brukerblikk runde 2.

**Hopp-lenka lander to forskjellige steder, og begge er riktige.**
`#main-content` er en `<main>`, som ikke er fokuserbar i seg selv. På
trådruta har hovedkolonnen fokuserbart innhold, og nettleseren setter fokus
på `main`; neste Tab lander inne i hovedinnholdet. På `/` har hovedkolonnen
ingenting fokuserbart, så vandringen fortsetter forbi main. Derfor er det to
tester: den sterke påstanden på trådruta, den svake på forsida.

**Filterfeltet er ikke en combobox før noen har rørt det.** Målt på det bygde
appen, 2,5 sekunder etter last, med alle tilpassede elementer oppgradert:
`u-datalist` er en `listbox` med sju valg, veksleknappen har
`aria-expanded="false"` — og selve inputen har verken `role`, `aria-controls`
eller `aria-expanded`. De kommer først ved første klikk. En rollebasert
låsning finner derfor ingenting på en side ingen har tatt på, og testene
låser på `<label for>` i stedet. Det er en feil i Designsystemet 1.21.0, ikke
i filterpanelet, og den står i `funn-tverrgaaende.md`.

**Et bygg som ikke er ferdig, lyver.** Første måling av lastetilstanden viste
at kildepanelet sto og hentet i det uendelige på en tom forside. Det var en
gammel `dist` som ble servert av en preview-server jeg hadde startet for hånd,
og som Playwright gjenbrukte. Mot et ferskt bygg er tilstanden riktig: tom
forside gir «Ingen kilder ennå», og «Henter kilder …» kommer først når et svar
faktisk er underveis. Verdt å vite for neste måling: drep preview-serveren før
du konkluderer.

**Mål aldri tekstoppsett før fonten er lastet.** Inter hentes fra en CDN, og
fallback-fonten har andre metrikker. Testen for kollapsknappens etikett
passerte først, fordi «Vis kilder» får plass på én linje i fallbacken og
brytes i Inter. `await page.evaluate(() => document.fonts.ready)` er hekta, og
den står nå både i den testen og i `saveScreenshot`. Referansebildene var
utilsiktet trygge fordi de tas etter mye annet arbeid, men det var flaks.

**Et helt mock-svar tar rundt 7,5 sekunder.** Fire tenkesteg à 500 ms, så
svaret token for token à 18 ms. Ventingene i testene poller, så en test
koster det svaret koster. Hele suiten går på under 20 sekunder fordi testene
kjører i parallell.

## Suiten løy, og det var min feil

**Den målte i 1280 × 720 mens den sa 1440 × 900.** I fire dager.
`playwright.config.ts` hadde `viewport: { width: 1440, height: 900 }` i
topp-`use`, og `projects: [{ use: { ...devices['Desktop Chrome'] } }]` under —
og en prosjekt-`use` slås over den øverste. `Desktop Chrome` har 1280 × 720 i
seg, så tallet over ble byttet ut i stillhet.

Målt etter rettingen: **111 av 111 grønne i 1440 × 900**, altså ingen påstand
som faktisk hang på bredden. Det er den gode nyheten og den dårlige på én
gang: ingenting var galt, og ingenting ville ha sagt fra hvis det var det.
`layout.spec.ts` og `resize.spec.ts` setter sin egen viewport per test og har
alltid målt det de sier.

Lærdommen er den samme som under: en påstand om et oppsett er en påstand som
må måles, ikke leses. En kasteklar spec som skriver ut `window.innerWidth` tok
tre sekunder å skrive og fire dager å komme på.

**Fra 13 til 49 av 58 «feil» hadde ingenting med produktet å gjøre.** Målt
2026-09-15 da N6-testene ble skrevet: kjøringer ga mellom 42 og 56 grønne, med
et nytt utvalg røde hver gang. Ingen av dem var en påstand som slo feil. To
delte ressurser, begge mine:

1. **Én fast `outputDir`.** Playwright tømmer den når en kjøring starter, og
   skriver en trace for hver test mens den går. To kjøringer i samme mappe
   betyr at den andre sletter filer den første fortsatt skriver, og den første
   faller i `browserContext.close` med `ENOENT` på en `.trace`-fil. Testen har
   da allerede passert; det er oppryddingen som kaster. Rettet:
   `RUN_ARTIFACTS` gir hver kjøring sin egen mappe, og mapper eldre enn et
   døgn ryddes bort.
2. **Én fast port.** `reuseExistingServer` lar kjøring to henge seg på
   preview-serveren til kjøring én, og når kjøring én er ferdig tar den
   serveren ned under kjøring to, som melder `ERR_CONNECTION_REFUSED` på alt
   som gjenstår. 49 av 58 i den kjøringen som startet sist. Rettet med
   `KA_E2E_PORT`, og regelen skrevet ned: én kjøring per port.

Verifisert etterpå med to samtidige kjøringer på 4173 og 4174: **58 grønne i
begge**.

Verdt å si høyt: en suite som melder rødt av grunner i sitt eget stell er
verre enn ingen suite, fordi det første den koster er tilliten til den. Alle
funnene i reviewene 14.09 ble tatt før dette, med sekvensielle kjøringer, og
er ikke berørt.

**Fonten er en egen risiko, ikke denne.** #5 påpekte at to tester måler
tekstbredde etter `document.fonts.ready`, og at Inter hentes fra
`altinncdn.no` ved hver kjøring. Målt her: 200 OK på tre forespørsler,
`fonts.ready` etter 166–187 ms, likt over kjøringer. Den er altså ikke årsaken
til det over, men står igjen som den mest sannsynlige årsaken til flakiness i
CI, der cachen er kald og nettet er noen andres.

## Det som ikke er en test

**Skjermbildene sammenlignes ikke automatisk.** De lagres under faste navn og
ses på av et menneske mot Figma-bildene. En pikselsammenligning ville feilet
på hver forskjell i fontrendering mellom to maskiner, og avvikene som betyr
noe er ikke piksler.

**Bare Chromium.** Suiten tester produktet, ikke nettleserkompatibilitet.

## Åpent

- **`tests/` typesjekkes ikke av `npm run build`.** `tsconfig.node.json`
  inkluderer bare `vite.config.ts`. Playwright typesjekker selv når testene
  kjører, så feil oppdages, men senere enn de kunne.
- **Første overskrift i DOM er fortsatt en `h2`**, fordi skallet tegner
  panelene før `<main>`. Ingen axe-regel fanger det, og ingen test heller:
  det er en avgjørelse om rekkefølge, ikke en feil i et view.

## To målinger av det samme kravet, som aldri ble sammenlignet

Lagt til 2026-09-21, etter #142.

`docs/review/tools/a11y.sh` har siden den ble skrevet kjørt axe med taggene
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`. `tests/e2e/a11y.ts` kjørte
`wcag2a, wcag2aa`. Begge to kaller det de måler «WCAG AA», begge to er mine,
og forskjellen mellom dem er to versjoner av standarden.

Det ble synlig på en knapp. Verktøyet meldte `target-size` (serious, WCAG
2.5.8) på «Vis mer om korpuset» i filterpanelet, målt 47 × 21 px, på hver rute
i både lys og mørk modus — mens 149 e2e-tester var grønne, fordi
`target-size` er `wcag22aa` og suiten ikke spurte etter den. #2 fant grunnen i
`RULE_SETS`.

Målt på `main` den dagen regelsettet ble utvidet:

| Regelsett                           | Røde | Grønne |
| ----------------------------------- | ---- | ------ |
| `wcag2a, wcag2aa` (slik det sto)    | 0    | 150    |
| pluss `wcag21a, wcag21aa, wcag22aa` | 29   | 121    |

Alle 29 er `target-size`, og alle 29 er den samme knappen. WCAG 2.1 legger
til null røde: det settet var allerede rent. Hele kostnaden ved å måle mot
2.2 i dette repoet var én kontroll, og #142 betalte den.

**Det som er verdt å ta med videre er ikke regelen, men formen.** Ingen skrev
feil tall noe sted. To verktøy målte det samme kravet hver for seg, begge
rapporterte grønt om sitt eget spørsmål, og ingen stilte dem opp mot
hverandre før et enkelttilfelle sprakk. Et krav som måles to steder trenger
ett sted der de to tallene står ved siden av hverandre — og etter denne PR-en
er `RULE_SETS` det stedet, med `a11y.sh` som den andre halvdelen navngitt i
kommentaren.
