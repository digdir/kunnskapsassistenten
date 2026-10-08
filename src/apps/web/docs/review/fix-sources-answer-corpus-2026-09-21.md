# PR #139, kildepanelet navngir korpuset svaret kom fra

Branch `fix/sources-answer-corpus`, sha `495a2ae`, anmeldt 2026-09-21.
Målt på sammenslåingen med `main` **og** #138 (`6d2fe79`): de to lukker saken
sammen, og det er den sammenslåingen som merges. Åtte filer, alle i
`src/views/sources/`.

Dette er den andre halvdelen av det jeg meldte som «bør» på #129:
fraskrivelsen navnga korpuset som sto **valgt**, ikke det svaret kom fra.
`AnswerSources.corpusKey` kom med #135, #138 skriver den, og her leses den.

## Portene

| Port            | Utfall              |
| --------------- | ------------------- |
| `build`         | exit 0              |
| `lint`          | exit 0              |
| `format:check`  | exit 0              |
| `tokens:verify` | exit 0              |
| `npm test`      | exit 0, 868 tester  |
| e2e (4173)      | exit 0, 151 bestått |

E2E-tallet er med `test.fixme`-en i `corpus-per-answer.spec.ts` snudd til
`test`. Den var skrevet for nettopp dette og hoppet over til nå.

## Reisen, målt i appen

Spurt i Kudos, byttet til Wikipedia (mock), åpnet Kudos-tråden igjen med
Wikipedia fortsatt valgt:

| Hva                      | Hva som sto der                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| fraskrivelsen            | «All tekst er sitater fra dokumentene **fra Kudos**. Ikke generert …»                                       |
| lenke i et utdrag        | «Les dokumentet **på Kudos**, utdrag 1, Årsrapport Nasjonal kommunikasjonsmyndighet 2025 (åpnes i ny fane)» |
| linja over svaret (#138) | «Avgrenset til: Kudos»                                                                                      |

På `main 3bbaf51` sto det «fra Wikipedia (mock)» på samme sted. Det er
tilfellet fra #129, og det er borte.

## Funn

### 1. Tomtilstanden navngir fortsatt Kudos, uansett korpus — **bør**

`src/views/sources/emptyStates.ts:21`:

> «Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat
> fra et dokument **på Kudos**, med samme nummer som markøren i svaret.»

`NO_ANSWER_YET` er det panelet viser når ingen svar er aktivt
(`SourcesView.tsx:140`) — altså på en uberørt forside, også med Wikipedia
(mock) valgt. Det er den samme påstanden som fraskrivelsen, i samme mappe, i
samme runde: hvor utdragene stammer fra, skrevet i ett korpus' navn.

Her finnes det ikke noe svar å lese nøkkelen fra, så det er det **valgte**
korpuset som er riktig kilde. `useActiveCorpus` er allerede i fila etter
denne PR-en.

### 2. `corpusKeyToName` returnerer en nøkkel, ikke et navn — **kan**

`origin.ts`. Kallstedet skriver `corpusDisplayNameFor(corpusKeyToName(…))`,
og fila si egen test kommenterer at navnet lages et annet sted.
`corpusKeyToShow` eller `corpusKeyFor` sier hva den gjør.

### 3. `KudosDisclaimer` heter fortsatt Kudos — **kan**

Komponenten og fila bærer navnet på ett korpus, mens setningen de tegner nå
navngir hvilket som helst. Det er det siste stedet ordet står fast i denne
mappa.

_Avgjort av dirigenten 21.09: døpes om til `CorpusDisclaimer` i samme runde._

## Riktig, og hvor jeg sjekket det

- **Skillet mellom en setning og en knapp er målt, ikke bare beskrevet.** Med
  en ukjent nøkkel sier fraskrivelsen «fra standardkorpuset» mens lenka sier
  bare «Les dokumentet» (`SourcesView.test.tsx`, «lar lenketeksten følge samme
  korpus som linja»). Fraskrivelsen er en påstand om hvor teksten kom fra og
  må si noe; et lenkenavn er ikke, og «Les dokumentet på standardkorpuset» er
  et klosset navn på en kontroll. Dirigentens avgjørelse 21.09, skrevet ned
  der den gjelder.
- **Unike lenkenavn holder.** E2E «ingen to lenker i panelet heter det samme»
  er grønn med de nye ordene, og de tilgjengelige navnene bærer fortsatt
  utdragsnummer og dokumenttittel etter den synlige teksten (WCAG 2.4.9, som
  var funnet mitt på #70).
- **Krokene står trygt.** `useActiveCorpus()` er lagt inn etter to vanlige
  funksjonsdefinisjoner (`changeQuery`, `stepToHit`), ikke etter en tidlig
  `return` — verdt å sjekke, for blokka ser ut som den ligger sent i
  komponenten.
- **Fallbacken er ærlig.** `answerKey ?? activeKey` gjetter bare der svaret
  ikke sier noe — en tråd fra før nøkkelen fulgte med — og gjetningen er
  riktig i det vanlige tilfellet der ingen har byttet. Tre tester i
  `origin.test.ts` dekker de tre utfallene.
- **`useSyncExternalStore` for hånd er borte**, og det er en forbedring jeg ba
  om på #129: viewet vet ikke lenger at butikken finnes, og monteres fortsatt
  utenfor en Router, `preview/` inkludert.
- 0 axe-brudd i lys og mørk på `/` og `/threads/nkom-maaloppnaaelse` som kan
  tilskrives PR-en.

## Til dirigenten

- Ingen blokkerende. Funn 1 er én setning.
- Ett axe-brudd står i kjøringen, men det er ikke denne PR-ens: `target-size`
  (serious, WCAG 2.5.8) på knappen «Vis mer om korpuset» i filterpanelet,
  målt 47 × 21 px. Høyden er linjehøyden i en linje med tekst, så unntaket for
  en kontroll i løpende tekst kan gjelde — men `.filters-view__corpus` er en
  flex-rad og ikke en setning, så axe melder den på alle fire kjøringene.
  Ligger i `src/views/filters/` og står likt på `main`.
