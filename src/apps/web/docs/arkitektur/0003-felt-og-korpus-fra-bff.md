# 0003 — Filterfelt og korpusnavn fra BFF-en

**Status:** valgt · **Dato:** 2026-09-29

## Kontekst

Filterpanelet trenger å vite tre ting om korpuset. Det må vite hvilket felt i
Typesense hver dimensjon er, altså at dokumenttyper er `type` og år er
`concerned_years`. Det må vite verditypen, altså at et år er `integer`. Og det
må vite hva korpuset heter. I live og mock leser klienten dette fra
`VITE_KA_FILTER_FIELDS` og `VITE_KA_DATASETS`, enten bakt inn i bygget eller
fra `/config.js` fra tynnserveren vår (`src/api/runtimeConfig.ts`).

Bak Nikolais BFF finnes ikke `/config.js`. Poden, som er monorepoet med
klienten vår i `src/apps/web`, fikk derfor et dødt filterpanel. Det sto
«Filtrering er ikke tilgjengelig», selv om `/api/facets` svarte med data (målt
29.09, #3 og #5). Dette er D16 i `design/plan-monorepo-2026-09-29.md`.

BFF-en hadde også feltene i koden (`FIELDS` i `apps/server/src/facets.ts`).
Den virket altså bare mot Kudos, og klienten måtte bygges med samme liste.

Dette er målt mot hele Kudos 29.09, med samme opptelling direkte i Typesense:

- BFF-en ga 200 av 457 virksomheter og 22 av 46 år. Grunnene var
  `max_facet_values` 200 og et tak på 300.
- Et år uten `value-type: integer` ga 0 biter. Med den ga det 4.
- Mer enn 100 valgte verdier i ett felt ble kuttet til 100 uten beskjed.

## Beslutning

BFF-en eier oppsettet om sitt eget datasett, og klienten henter det derfra.
BFF-en leser `KA_FILTER_FIELDS` og `KA_DATASETS`, med samme grammatikk som
klientens variabler. `/api/facets` gir `id`, `field`, `valueType`, `label` og
alle verdiene med tall for hvert felt. `/api/capabilities` gir `dataset`, som
er nøkkel, navn og beskrivelse. I bff-modus bruker klienten dette i stedet for
byggets oppsett. Live og mock er som før.

Grunnen er at BFF-en allerede er den som bestemmer hvilket datasett som
spørres (`DIGDIR_DATASET_CONFIG_KEY`), og den som teller fasettene. Da hører
feltnavnene og navnet til det samme datasettet hjemme på samme sted. Hvis
klienten sa det selv, ville den gjentatt noe den ikke kan vite, og sagt feil i
det øyeblikket noen byttet datasett i BFF-en og ikke bygde klienten på nytt.

## Konsekvenser

- Ett bilde av klienten virker mot et hvilket som helst datasett BFF-en er
  satt opp for. Et nytt korpus er en endring i oppsettet til BFF-en, ikke et
  nytt bygg.
- Korpusnavnet kommer etter første tegning. Korpuslageret (`src/api/corpus.ts`)
  tar det inn med `adoptServerCorpus`, og `useActiveCorpus` tegner på nytt.
  Før svaret kommer, viser panelet byggets navn eller nøkkelen.
- Trådens filter (`ThreadDetail.filter`) oversettes fra BFF-ens feltnavn til
  dimensjoner med de samme feltene. Et felt klienten ikke kjenner, blir ikke
  vist.
- Mot en BFF uten `id` på fasettene, som den på `8639267`, bruker klienten
  fortsatt byggets `VITE_KA_FILTER_FIELDS`.
- Taket på 100 verdier håndheves to steder, som holder hver for seg. Klienten
  sender ikke et felt der alle verdiene er valgt, og sier fra i panelet over
  100 (#2). BFF-en stryker også et felt der alle kjente verdier er valgt, og
  den svarer 400 med `filter-too-many-values` eller `filter-invalid-value` i
  stedet for å kutte. Klienten viser det med koden `filter-refused`: en egen
  tekst om hva som må endres i filteret, og uten «Prøv igjen», som bare ville
  sendt det samme filteret en gang til.
- Proben i BFF-en prøver på nytt i om lag ni minutter før den avgjør. Panelet
  spør først med korte pauser, og så hvert 15. sekund så lenge BFF-en svarer
  at proben ikke er ferdig. Mens det venter, står det «Henter filtre». En BFF
  som ikke svarer, gir en feil med «Prøv igjen» i stedet.

## Hva som ville endret beslutningen

- **headless-rag gjør filtermetadataen tilgjengelig.** `inspect_filters` lager
  allerede `available-fields` med `value-type` og `facet-options` med tall.
  Kan den som kaller API-et få dette, kan BFF-en slutte å ha feltene i
  oppsettet og bare sende videre det backenden sier, for hvert korpus. Et
  utkast til issue ligger i `design/_briefs/bygg/`.
- **BFF-en skal kunne velge mellom flere datasett** (0002, endring 4). Da må
  `dataset` bli en liste, og feltene må komme per datasett.
