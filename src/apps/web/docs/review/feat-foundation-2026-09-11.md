# Review: `feat/foundation`, PR #1

**Commit:** `9247a09` «Grunnmur PR 1: domenetyper og mock-klient»
**Dato:** 2026-09-11 · **Anmelder:** KA CC
**Omfang:** 15 nye filer, 880 linjer. Delte typer i `src/model/`,
`ChatClient`-grensesnittet, `MockChatClient` og fixtures. Ingen UI, ingen CSS,
ingen JSX.

## Porter

| Port                    | Resultat |
| ----------------------- | -------- |
| `npm run build`         | grønn    |
| `npm run lint`          | grønn    |
| `npm run format:check`  | grønn    |
| `npm run tokens:verify` | grønn    |

WCAG-sjekken er ikke kjørt: PR-en har ingen markup å måle. Fokusrekkefølge og
kontrast kommer når viewene monteres.

## Det som er riktig, og som jeg sjekket mot fasiten

Jeg slo opp hver fixtureverdi i spesifikasjonene i stedet for å tro på
PR-beskrivelsen. Dette stemmer:

- **Fasettverdier og tellere er identiske med
  `omraader/molecules/skjermer/filter.md:99-101`**, alle tre dimensjoner, alle
  18 verdier, alle tellere (`Evaluering (779)`, `Tildelingsbrev (2042)`,
  `Årsrapport (1032)`, `2024 (854)` …). Der Figma har to tall for samme verdi
  (`Evaluering` 519 mot 779, se `molecules/README.md:107`) er den vertikale
  brukt, som er den filtervisningen som faktisk skal bygges.
- **Trådlista følger gruppene i
  `september-2026/venstre-sidepanel/skjermer/traader.md:108-118`.** «I dag» får
  to tråder, «Siste 7 dager» fire, «Siste 30 dager» tre, og titlene er ordrette.
- **Svarteksten er bygget av spesifikasjonens egne avsnitt.** Sluttsetningen er
  ordrett fra `hva-skjer/skjermer/svaret-som-vises-1560-56137.md:105`, og
  underoverskriftene «Internkontroll og risikovurdering», «Ressursbruk og
  måloppnåelse», «Fokus på digital transformasjon», «5G-utvikling» er
  spesifikasjonens.
- **`relevanceLabels`** treffer de tre merkelappene i
  `svaret-som-vises-1549-46119.md:166` ordrett.
- **Dokumenttitlene** har spesifikasjonens fulle form, «Årsrapport Nasjonal
  kommunikasjonsmyndighet 2022», ikke Figmas avkortede «Årsrapport Nkom 2022».
- **Navnereglene holder.** Ingen treff på `venstre`, `høyre`, `left` eller
  `right` i `src/`. Kommentarene er engelske med KA-begrepene sitert på norsk,
  som regel 13 sier etter endringen i dag. Ingen `any`, ingen `@ts-ignore`,
  ingen `console.`.
- **Ingenting er hardkodet som burde vært token.** PR-en har ingen farger,
  størrelser eller fonter. De eneste tallene er data (`page: 41`,
  `count: 1032`) og kunstige nettverksforsinkelser i `defaultMockDelays`.
  Verdiene med `px` og `1px` i `src/styles/global.css` er fra Trinn 1 på
  `main`, ikke fra denne PR-en; de står i `main-2026-09-11.md`.
- **`tokenize()` gjør det kommentaren lover.** Jeg kjørte rundturen på
  fixturen: `markdown.match(/\S+\s*/g).join('')` er identisk med inndata.

Det er uvanlig grundig arbeid. Funnene under er derfor mest av typen «to filer
i samme PR er uenige med hverandre», ikke slurv.

---

## Blokkerer

### 1. `MessageStatus` kan ikke uttrykke «brukeren trykket stopp»

`src/model/message.ts:11` · `src/model/stream.ts:5-8`

`MessageStatus` er `'streaming' | 'complete' | 'error'`, og kommentaren sier
at `error` betyr at turen feilet. `stream.ts` sier det motsatte om samme
hendelse: «`aborted` is the user pressing stop (answer 34) and **is not an
error state in the UI**».

Når brukeren trykker «Stopp generering» (svar 34) har viewet bare to valg, og
begge er gale: `complete` lyver om at svaret er ferdig, `error` lyver om at
noe gikk i stas. #3 bygger stoppknappen nå, og vil måtte velge en av dem.

**Fikk:** legg til `'aborted'` i `MessageStatus`. Da er én kodesti per
utfall, som er hele poenget med at avbrudd er et `error`-event og ikke et
kastet unntak.

### 2. `Excerpt.citationNumber` er påkrevd, men fixturen har utdrag som ikke er sitert

`src/model/source.ts:50` · `src/model/retrieval.ts:12` ·
`src/api/mock/fixtures.ts:177`

`nkomRetrieval.hitCount` er `10` og `documentCount` er `3`, som er Figmas
merkelapp «10 treff i 3 dokumenter»
(`molecules/skjermer/blackbox.md:57`). `nkomSources` inneholder **5** utdrag.
Samtidig sier kommentaren på `hitCount` at det er «Number of relevant
excerpts found. One hit is one chunk (answer 12)».

De to kan ikke begge være sanne. Fixturens egne tenkesteg avslører hva som er
ment: steg 2 sier «10 beholdt etter rangering», steg 3 sier «5 utdrag fra 3
dokumenter». `hitCount` teller altså det søket hentet, `excerpts` er det
svaret brukte. #4 bygger kildepanelet mot dette og får en merkelapp som sier
10 over en liste med 5, og melder det som feil.

Konsekvensen for typen: et hentet utdrag som svaret ikke siterte må kunne
finnes, og da har det ikke noe `citationNumber`.

**Fikk:** gjør `citationNumber` valgfri, og skriv i `hitCount` at den teller
hentede utdrag, ikke siterte. Skriv i fixturen hvorfor 10 ≠ 5, ellers blir
det «rettet» til 10 utdrag av neste leser.

---

## Bør

### 3. `[n]`-markørene er en tredje henvisningskonvensjon, og september-2026 er fasit

`src/api/mock/fixtures.ts:45-89` · `src/model/citation.ts`

Svarteksten bruker `[1]`…`[5]`. Det er ikke det september-2026 tegner.
`svaret-som-vises-1549-46119.md:139` sier: «Kildehenvisninger i teksten:
`(Årsrapport Nkom 2022)`, `(Årsrapport Nkom 2023)`» — altså
parentes med dokumenttittel. Nummer finnes i spesifikasjonen bare i
sekundærkolonnens «Snarveier til dokumentene», der de er **per dokument**
(1–4), ikke per utdrag.

Valget er ikke feil: `visjon-og-beslutninger.md` peker selv på «nummererte
markører i svaret → nummererte utdrag i sekundærkolonnen» som
løsningsretning, og det er nettopp det `citationNumber` på `Excerpt` gir.
Men byggereglene sier `omraader/september-2026/` er fasit, tre konvensjoner
er i spill, og fixtureoverskriften dokumenterer to andre avvik fra Figma uten
å nevne dette. Resultatet blir at #3 rendrer `[3]` i svaret mens #4 nummererer
dokumenter 1–4 i kildepanelet, og de to lister ikke det samme.

**Fikk:** skriv i `citation.ts` at nummeret er per utdrag, at det er valgt
framfor spesifikasjonens parentes-form, og hvorfor. Jeg har meldt til
dirigenten at dette trenger en avgjørelse før #3 og #4 rendrer noe.

### 4. `Citation` er ett per utdrag, men dokumentert som ett per markør

`src/model/citation.ts:1-23`

Kommentaren sier «A `[n]` marker in an answer, resolved», og `Message.citations`
sier «The `[n]` markers found in `content`, resolved». Jeg telte markørene i
fixturen: **7 forekomster, 5 unike numre**, fordi `[3]` og `[4]` står to
steder hver. `nkomCitations` har 5 elementer, ett per utdrag.

Det betyr at `span?: { start; end }` ikke kan gjøre jobben den er tegnet for:
ett tallpar kan ikke peke på to forekomster av `[3]`.

**Fikk:** `spans?: Array<{ start: number; end: number }>`, og skriv at
`Citation` er én per nummer, ikke én per forekomst. Feltet er merket
`backend: mangler`, så ingen bruker det ennå; det er billig nå.

### 5. `emptyFilterSelection` er et delt, muterbart objekt

`src/model/filter.ts:37-41`

```ts
export const emptyFilterSelection: FilterSelection = {
  documentType: [],
  organisation: [],
  year: [],
};
```

Navnet inviterer til `useState(emptyFilterSelection)`. Første `push` i en
reducer, eller en `.sort()` på plass, endrer objektet for hele prosessen, og
«tom» blir aldri tom igjen. Det er en feil som ikke gir noe utslag i
typesjekken og som er vond å finne når tre paneler leser samme verdi.

**Fikk:** `export function createEmptySelection(): FilterSelection` som
returnerer et nytt objekt. Behold gjerne konstanten i tillegg, men frys den
da (`Object.freeze` på objektet og på hver array).

### 6. Mock-klienten deler ut fixturene sine ved referanse

`src/api/mock/MockChatClient.ts:119,129` · `src/api/mock/fixtures.ts:168,332`

`listThreads()` returnerer `threads`, `listFacets()` returnerer `facets`, og
`nkomSources` deles ut i hvert `sources`-event. Samme objekt, hver gang, til
alle tre viewene. Sorterer #2 trådlista på plass, har #3 og #4 fått den
sortert også, og ingen ser sammenhengen.

**Fikk:** `structuredClone(threads)` i klienten. Det er én linje per metode
og gjør mocken lik en ekte klient, som alltid gir nye objekter.

### 7. `catch {}` i `ask()` svelger årsaken

`src/api/mock/MockChatClient.ts:107-114`

Alt som kaster inne i generatoren blir «Noe gikk galt. Prøv igjen.» uten kode,
uten stakk og uten konsollutskrift. Et skrivefeil i en fixture ser da ut som
en backendfeil.

Én kodesti for «svaret stoppet» er riktig valg, og skal ikke gjøres om.
Men årsaken må ikke forsvinne.

**Fikk:** `catch (cause)`, legg `cause?: unknown` på `ChatError`, og logg i
`import.meta.env.DEV`.

### 8. Norsk brukertekst ligger i `src/api/`, mens tilsvarende tekst ligger i `src/model/`

`src/api/mock/MockChatClient.ts:111-112` · `src/model/source.ts:14-18`

`relevanceLabels` ble bevisst lagt i `src/model/` «so the sources panel, the
answer and any future filtering agree on the wording». Feilmeldingene
«Svaret ble avbrutt.» og «Noe gikk galt. Prøv igjen.» er samme slags streng,
men er skrevet inn i mock-klienten. Den ekte klienten får da sin egen ordlyd,
og et view som vil endre teksten må røre en mappe det ikke eier.

**Fikk:** `errorMessages: Record<ChatErrorCode, string>` i `src/model/`, og
la klientene fylle `ChatError.message` fra den.

### 9. Fire bevisste avvik fra Figma er ikke dokumentert der de tre andre er

`src/api/mock/fixtures.ts:20-27`

Overskriften lister to avvik. Disse fire er like bevisste, og jeg måtte
verifisere hvert av dem mot spesifikasjonen for å se at de var riktige:

1. **Seksjon 4–6 i trådlista.** Figma gjentar de samme fire radene tre ganger
   (`traader.md:116-118`); fixturen har tre egne tråder i stedet. Riktig, og
   nødvendig for å teste månedsgruppene.
2. **«22. juli-senteret» med mellomrom.** `filter.md:100` skriver
   `22.juli-senteret`, uten. Fixturen har mellomrom, som er korrekt norsk og
   institusjonens eget navn. Figma har to skrivemåter, og
   `filter-horisontalt.md:77` påpeker det selv.
3. **Digdir (96) og Nasjonal kommunikasjonsmyndighet (42)** finnes ikke i
   spesifikasjonens fire virksomheter. De er lagt til, og må være det for at
   NKOM-historien skal henge sammen.
4. **Virksomhetslista er sortert på norsk.** Figma har «AS Vinmonopolet» før
   «Advokattilsynet», som er ASCII-sortering. Fixturen har riktig
   nb-sortering.

**Fikk:** tre linjer til i overskriften. Uten dem blir dette «rettet» tilbake
til Figma av neste leser, og punkt 2 og 4 blir da feil norsk.

### 10. `daysAgo(7)` ligger nøyaktig på gruppegrensen, uten at noen vet at det er meningen

`src/api/mock/fixtures.ts:251-254`

«Tilgang til årsrapporter» er satt til 7 dager siden. Spesifikasjonen
(`traader.md:111-112`) plasserer den i «Siste 7 dager». En naiv
`diffDager < 7` legger den i «Siste 30 dager» i stedet, siden 7 dager og 30
minutter er mer enn 7 døgn.

Som prøvedata er det bra: det tvinger #2 til å velge en regel. Som udokumentert
prøvedata er det en felle.

**Fikk:** skriv i fixturen at raden ligger på grensen med vilje, og hvilken
regel som er fasit. Min anbefaling: grupper på kalenderdøgn, ikke på
multipler av 24 timer, og la dag 7 høre til «Siste 7 dager», som
spesifikasjonen viser.

---

## Kan

### 11. Rekkefølgen på lister er ikke en del av kontrakten

`src/api/chatClient.ts:26,33` · `src/model/filter.ts:28`

`listThreads`, `listFacets` og `SourceDocument[]` er alle sortert i fixturen
(nyeste tråd først, nb-sortert virksomhetsliste), men ingenting sier om det er
klientens ansvar eller backendens. Sorterer et view selv, må det bruke
`localeCompare('nb')`; standard sortering setter «Årsrapport» før
«Evaluering».

### 12. En skrivefeil i `VITE_API_MODE` faller stille tilbake til mock

`src/api/index.ts:14-18` · `src/env.d.ts:7`

Typen er `'mock' | 'live'`, men miljøvariabler er strenger ved kjøretid.
`VITE_API_MODE=liv` gir ingen feil, bare mock. Kast på alt som ikke er de to
kjente verdiene, ikke bare på `live`.

### 13. Meldingen som strømmer har ingen id før `done`

`src/model/stream.ts:38`

`messageId` kommer først i `done`. Mens svaret bygges må #3 finne på en
midlertidig id til React-nøkler og til «Kopier svar» (svar 15). Et
`message-start`-event, eller `messageId` på `token`, ville spart det.

### 14. `mockAnswerMarkdown` er et andre navn på `NKOM_ANSWER`

`src/api/mock/fixtures.ts:45,371`

De andre eksportene heter `nkomSources`, `nkomCitations`, `nkomRetrieval`,
`nkomThinkingSteps`. `nkomAnswerMarkdown` ville fulgt mønsteret og fjernet
aliaset.

---

## Til dirigenten

- **Funn 3 trenger en avgjørelse, ikke en kodeendring.** Tre
  henvisningskonvensjoner er i spill: parentes med dokumenttittel (det
  september-2026 faktisk tegner), nummer per dokument («Snarveier til
  dokumentene», 1–4) og nummer per utdrag (`citationNumber`, teamets
  løsningsretning). #3 og #4 rendrer hver sin ende av samme kobling og må
  bygge mot den samme. Dette hører til spørsmål 19 og 31, som står åpne.
- **`ChatClient` har ingen trådoperasjoner.** Ingen opprett, gi nytt navn
  eller slett, mens kommentaren sier «Everything the frontend needs from a
  backend». «Ny tråd» klarer seg med navigasjon til `/`, men
  `behov-til-komponent.md` har «Nytt navn på tråden» som eksempel, og
  CRUD-hullet står i møtenotatene. Er det utenfor PR 1 med vilje, bør
  kommentaren si det.
- **Jeg trenger `@axe-core/playwright` fra #5** hvis WCAG-sjekken skal bo i
  repoet. Inntil da laster `docs/review/tools/a11y.sh` ned axe-core til
  `~/.cache/ka-review/`, siden bare grunnmuren legger til avhengigheter.
  Verktøyet virker slik det er; dette er et ønske, ikke en blokker.
