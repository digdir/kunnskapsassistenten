# PR #138, hovedkolonnen bærer korpuset per tur

Branch `feat/chat-corpus-per-turn`, sha `869193a`, anmeldt 2026-09-21.
Målt på sammenslåingen med `main 17f9935`, ikke på branchen alene.
Fire filer, alle i `src/views/chat/`.

Den andre halvdelen av runden #135 startet: modellen fikk `Message.corpusKey`
der, og her er det noen som skriver den. `useChat` tar nøkkelen fra ramma som
avslutter strømmen, `ChatView` sender den videre til kildepanelet, og linja
over svaret navngir korpuset når svaret kom fra et annet enn det som står
valgt.

## Portene

| Port            | Utfall                              |
| --------------- | ----------------------------------- |
| `build`         | exit 0                              |
| `lint`          | exit 0                              |
| `format:check`  | exit 0                              |
| `tokens:verify` | exit 0                              |
| `npm test`      | exit 0, 859 tester                  |
| e2e (4173)      | exit 0, 150 bestått + 1 hoppet over |

Den hoppede er min egen `test.fixme` i `corpus-per-answer.spec.ts`, som venter
på #139.

## Reisen, målt i appen

På sammenslåingen av #138, #139 og `main`: spurt i Kudos, byttet til Wikipedia
(mock), åpnet Kudos-tråden igjen med Wikipedia fortsatt valgt.

| Hva                               | Hva som sto der        |
| --------------------------------- | ---------------------- |
| ferskt svar i det valgte korpuset | ingen linje            |
| eldre tråd, annet korpus valgt    | «Avgrenset til: Kudos» |
| fraskrivelsen over Nkom-kortet    | «… fra Kudos»          |

Ingen linje på det ferske svaret er det riktige: et ord som aldri varierer er
et ord uten opplysning i seg, og i en installasjon med ett korpus ville det
stått over hvert eneste svar.

## Funn

### 1. Ukjent korpusnøkkel gir «Avgrenset til: standardkorpuset» — **bør**

`ChatView.tsx:114–116` navngir enhver nøkkel som avviker fra valget, også en
denne installasjonen ikke kjenner. `corpusDisplayNameFor` slår den opp i
`corpusOptions`, finner ingenting, og gir stedfortrederen.

Målt med en tråd hvis svar bærer nøkkelen, «Kudos» valgt:

| Svarets nøkkel     | Linja over svaret                 |
| ------------------ | --------------------------------- |
| `et-annet-korpus`  | «Avgrenset til: standardkorpuset» |
| `norquad-mock`     | «Avgrenset til: Wikipedia (mock)» |
| `mock`, det valgte | ingen linje                       |

Nåbar i live: `corpusKeyFromTags` (`src/api/live/conversations.ts:114`)
stempler `corpus:`-taggen slik den står på en tilbakelest tråd, uten å sjekke
den mot lista over konfigurerte korpus. En tagg fra en annen installasjon,
eller et datasett som har byttet nøkkel, lander der.

«standardkorpuset» er skrevet for ett tilfelle: velgeren vet ingenting, fordi
verken `VITE_KA_DATASETS` eller `VITE_KA_DATASET_CONFIG_KEY` er satt og
backend velger selv (KA CC på #106). Det er ikke det samme som «dette svaret
kom fra et korpus jeg ikke kan navngi», og over ett enkelt svar er det nettopp
et ord uten opplysning i seg — det linja finnes for å unngå.

#139 vokter det samme stedet med én linje:
`corpusOption(corpusKey) === undefined ? undefined : corpusName`. Uten den
sjekken her sier kildepanelets lenke «Les dokumentet» mens linja rett over
sier «Avgrenset til: standardkorpuset», om det samme svaret.

### 2. Regelen PR-en finnes for har ingen test — **bør**

`corpusPerTurn.test.ts` måler to ting: at nøkkelen fra `done`-ramma havner på
meldinga (fire tester mot `useChat`), og at `answerScopeText` setter sammen
navnet og fasettene riktig (to tester mot den rene funksjonen). Begge er
verdt å ha.

Sammenligningen som avgjør om korpuset navngis i det hele tatt —
`answer.corpusKey !== corpusKey`, `ChatView.tsx:115` — er ikke dekket noe
sted. Min e2e-vakt måler fraskrivelsen i kildepanelet, ikke denne linja, så
ingenting fanger det om den glir. `ChatView.corpus.test.tsx` monterer alt
viewet med et korpus under seg; tabellen i funn 1 er tre slike tester.

### 3. Seremoni i `ChatView.tsx:118` — **kan**

`isEmptySelection(applied) ? emptyFilterSelection : applied` gir samme svar
som `applied` alene: `filterSummaryText` returnerer allerede `undefined` for
en tom markering, og `FilterSelection` har nøyaktig de tre dimensjonene
`DIMENSION_ORDER` går gjennom, så de to funksjonene kan ikke være uenige.

### 4. Korpus og fasetter deler skilletegn — **kan**

«Avgrenset til: Kudos · Årsrapport · 2023» leses som tre fasettvalg, og
korpuset er det ene av dem leseren ikke finner igjen som en chip i
filterpanelet.

_Avgjort av dirigenten 21.09: korpuset flyttes bak fasettene som «…, fra
Kudos»._

## Riktig, og hvor jeg sjekket det

- **Nøkkelen følger alle rammene som avslutter en tur**, ikke bare `done`.
  `askedOf` spres på `error`, `aborted` og `no-hits` i begge klientene
  (`LiveChatClient.ts:270–308, 420–507`, `MockChatClient.ts:452–752`, begge
  fra #135), og `settleAnswer(answerId, …, event)` tar imot alle fire veiene.
  Et avbrutt svar og et svar uten treff blir stående på skjermen som turer en
  leser kan spørre «fra hvilket korpus» om, så det er ikke pynt.
- **Ingen renderløkke av den utvidede `sourcesSignature`.** Kommentaren over
  funksjonen beskriver akkurat den løkka — et view som melder noe skallet
  ikke lagrer, melder det igjen ved neste render — så den var verdt å måle:
  `setAnswerSources` (`LayoutProvider.tsx:263`) lagrer posten slik den kommer,
  `corpusKey` inkludert, så `held.corpusKey` er den samme verdien neste
  sammenligning leser.
- **`undefined` betyr «ikke kjent» der det teller.** Feltet utelates i stedet
  for å settes til `undefined` (`useChat.ts:388`), så en nøkkel som ble lest
  tilbake med tråden ikke nulles av en tur som ikke sa noe. Testen «beholder
  nøkkelen som ble lest tilbake med tråden» måler det med to svar fra hvert
  sitt korpus i samme tråd.
- **`messages` i avhengighetslista koster ingenting.** `MessageList` er ikke
  memoisert, og `messages` skifter uansett per token, så den nye identiteten
  på `filterSummary` river ikke ned noe som sto.
- Ingen heksfarger, `px`/`rem`/`em`, `any` eller `@ts-ignore` i de fire
  filene. «left»/«right» bare som vanlig engelsk i kommentarer.
- Ingen nye kontroller eller landemerker, så axe-bildet er uendret: 0 brudd
  som kan tilskrives PR-en, i lys og mørk, på `/` og
  `/threads/nkom-maaloppnaaelse`.

## Til dirigenten

- Funn 1 og 2 er begge små og hører hjemme i denne PR-en. Ingen blokkerende.
- En tråd kan fortsatt få svar fra to korpus: å åpne en eldre tråd flytter
  ikke velgeren, så neste spørsmål i den tråden går til det valgte korpuset.
  #133 sperrer den andre veien (et bytte tømmer skjermen), men ikke denne.
  Etter denne PR-en er det i det minste synlig — de gamle svarene navngir sitt
  korpus — men det er en produktavgjørelse og ikke en kodeendring: skal det å
  åpne en tråd sette velgeren til trådens korpus?
