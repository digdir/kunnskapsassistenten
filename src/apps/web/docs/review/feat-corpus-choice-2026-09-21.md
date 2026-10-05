# PR #103, `feat/corpus-choice`: korpus som kjøretidsvalg

Anmeldt 2026-09-21. Hode `56866a6`, base `main` (`6b6ecb2`).
`git merge-tree --write-tree origin/main 56866a6` går rent. 16 filer.

**Ingen blokkerende funn. Ingen «bør». To «kan», og én sak til dirigenten om
rekkefølge.**

## Målingene

| Port                                        | Resultat           |
| ------------------------------------------- | ------------------ |
| `npm run build`                             | grønn              |
| `npm run lint`                              | grønn              |
| `npm run format:check`                      | grønn              |
| `npm run tokens:verify`                     | grønn              |
| `npm test`                                  | 656/656            |
| `KA_E2E_PORT=4173 CI=true npm run test:e2e` | 141/141 på 2,3 min |

#5 sine tall stemmer.

### Live: hva jeg faktisk fikk målt, og hva jeg ikke fikk

**5183 og 5184 serverte `main`, ikke denne branchen** — jeg hentet
`/src/api/corpus.ts` fra begge og fikk index.html tilbake, altså ingen
korpusmodul. Så jeg satte opp live selv i mitt eget arbeidstre på 5177, mot
den kjørende stacken på 8080, med begge korpusene i `VITE_KA_DATASETS`.

**Nøkkelen reiser, målt på tråden.** Ett spørsmål, og de to utgående kallene
bar dette:

```
POST /api/conversations
  {"title":"Hva sier rapporten om måloppnåelse?",
   "agent-id":"builtin/agent-rag-agent",
   "tags":["corpus:norquad-docs"]}

POST /api/mcp   (tools/call)
  "arguments":{"query":"…","tenant":"demo","dataset_config_key":"norquad-docs"}
```

Begge påstandene i beskrivelsen er altså sanne på ekte wire: nøkkelen følger
`tools/call`, og tråden får korpuset sitt i `tags` med prefiks.

**Begge svarte 401.** Nøkkelen jeg har lokalt (`E2E_API_KEY` fra
`docker-compose.newcomer.yml`) blir avvist av denne stacken på både
`/api/conversations` og `/api/mcp`. Jeg fikk derfor **ikke** bekreftet at de to
korpusene gir forskjellige svar — det er #5 sin måling med to spørringer, og
den står ubestridt her. Det jeg kan si er at forespørslene er riktige; ikke hva
de får tilbake.

Ett spørsmål stilt, som avtalt. De øvrige målingene under er gjort uten å
spørre om noe.

### Butikken, målt i den kjørende appen

| Tilstand i `ka.corpus.v1` | Aktiv nøkkel   | Etikett             |
| ------------------------- | -------------- | ------------------- |
| tom                       | `norquad-docs` | Wikipedia (NorQuAD) |
| `kudos-pilot`             | `kudos-pilot`  | Kudos-pilot         |
| `finnes-ikke`             | `norquad-docs` | Wikipedia (NorQuAD) |

Og et bytte i løpet, uten omlasting: `setActiveCorpusKey('kudos-pilot')` ga
**ett** varsel til abonnentene, skrev til `localStorage`, og et påfølgende
forsøk på en nøkkel som ikke finnes ble avvist uten å endre noe.

Lista ble lest nøyaktig som skrevet, parenteser og beskrivelser intakt:
`norquad-docs | Wikipedia (NorQuAD) | 351 artikler` og
`kudos-pilot | Kudos-pilot | 5 årsrapporter`.

Den tredje raden er den som betyr noe: en lagret nøkkel som ikke lenger finnes
i lista faller tilbake i stedet for å sende et dødt datasett til backenden.

## Det som er riktig

1. **`useSyncExternalStore` er brukt på den ene måten som ikke kan løkke.**
   Snapshotet er en streng (`activeCorpusKey`), ikke et objekt, og objektet
   views får bygges etterpå i `useMemo`. Et getSnapshot som lager et nytt
   objekt per kall er den klassiske «The result of getSnapshot should be
   cached»-krasjen; den er unngått.
2. **Nøkkelen leses ved kalltid, ikke i konstruktøren.**
   `datasetConfigKey` tar en funksjon, og `LiveChatClient` kaller den når den
   bygger forespørselen. Det er det som gjør at et bytte når backenden uten
   omlasting, og begrunnelsen står i koden.
3. **Én lesestasjon for miljøet.** `VITE_KA_DATASETS` og
   `VITE_KA_DATASET_CONFIG_KEY` leses bare i `corpus.ts` (og i tester som
   stubber dem). Ingen andre steder å glemme.
4. **Parseren dropper i stedet for å kaste**, og sier fra i konsollen med
   formatet i meldinga. En oppføring uten nøkkel eller uten navn er den
   innstillinga som er feil, ikke appen.
5. **`corpus:`-prefikset på `tags`** er riktig vurdert: feltet er backendens
   eget og deles, så en bar `kudos-pilot` ville vært tvetydig begge veier.
6. **Tittelfiksen er reell.** `chunkTitle` leser `title`, `doc_title` og
   `docTitle` og behandler blanke som manglende — en tittel på `'   '` ville
   ellers tegnet en tom linje i kildepanelet, som leses som en feil og ikke som
   et dokument uten navn.

## Kan

### 1. To faner kan stå på hvert sitt korpus uten å vite om det

Valget skrives til `localStorage`, men ingenting lytter på `storage`-hendelsen
— verken her eller noe annet sted i `src/` (sjekket). Har leseren to faner
åpne og bytter korpus i den ene, spør den andre fortsatt det gamle, og begge
mener de har rett.

Det er samme oppførsel som layout-lageret har i dag, så det er husets stil og
ikke et avvik. Men korpus er et tyngre valg enn en panelbredde: konsekvensen er
svar fra feil dokumentsamling, ikke en kolonne på feil bredde. Verdt en linje i
beskrivelsen av hva `ka.corpus.v1` lover, eller en `storage`-lytter når noen
likevel er i fila.

### 2. `subscribeToCorpus` returnerer en `boolean`

`return () => listeners.delete(listener)` gir en funksjon som returnerer
`true`/`false`. React bryr seg ikke, og TypeScript godtar det mot en
`() => void`. Rent kosmetisk, men `{ listeners.delete(listener); }` sier
tydeligere at returverdien ikke betyr noe.

## Til dirigenten: rekkefølgen mot #2 sin del 2

Målt i live med `norquad-docs` aktivt: korpuslinja i filterpanelet sier
fortsatt **«Dokumenter fra Kudos»**. Den er #2 sin del 2, og #5 skriver det
selv — men verdien av å si det her er at fra det øyeblikket #103 er på `main`,
kan appen søke i NorQuAD mens panelet påstår Kudos.

Det er ingen grunn til å holde igjen #103; det er en grunn til at #2 sin
`feat/corpus-select` ikke bør bli liggende, og til at ingen demonstrerer
korpusbytte for Lars i mellomtida.

## Til dirigenten, praktisk

- **5183 og 5184 serverte `main`.** Om de var ment å vise denne branchen, ble
  de aldri byttet over. Jeg målte på min egen 5177 i stedet.
- **Live-nøkkelen min blir avvist (401).** Det finnes ingen `.env.local` i
  hovedsjekkouten eller i noe arbeidstre lenger, så jeg bygde en selv fra
  compose-standarden. Skal jeg kunne måle svar og ikke bare forespørsler i
  live, trenger jeg den nøkkelen som faktisk virker mot stacken.
