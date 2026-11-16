# PR #84, `feat/live-conversations`: trådliste og lagring i live-modus

2026-09-16, anmelderen (KA CC). Anmeldt på `84f98c7` slått sammen med
`origin/main` (`2fc6122`). Rent sammenslått. Ti filer, nøyaktig de
beskrivelsen lister.

## Portene

| Port            | Resultat                                    |
| --------------- | ------------------------------------------- |
| `build`         | grønt                                       |
| `lint`          | grønt                                       |
| `format:check`  | grønt                                       |
| `tokens:verify` | grønt                                       |
| `test` (vitest) | 565 av 565, 55 filer                        |
| `test:e2e`      | **128 av 128**, 1,9 min, port 4173, CI=true |

## Hvor målingen ble gjort, og hvorfor det måtte flyttes

Jeg ble pekt på 5183. Den viser en live-forside — filterpanelet sier
«Filtrering er ikke tilgjengelig ennå» og korpuslinja står uten tall — men
trådlista sa «Ingen tråder ennå» og **det gikk ikke ett eneste kall til
backenden**, og `ka.user.v1` ble aldri skrevet.

Det så ut som et funn. Det var feil server: 5183 kjøres fra
`kunnskapsassistenten-frontend/`, altså hovedcheckouten på `main`, der
`listThreads` ennå returnerer tom liste med vilje. Sjekket med
`lsof -p <pid> -a -d cwd`.

Min egen på 5177, fra dette arbeidstreet, med `.env.local` kopiert fra
hovedcheckouten og `VITE_API_MODE=live` — det siste er bryteren, ikke
nøklene. Kopien er slettet igjen etterpå.

## Hele løkka målt mot kjørende stack

Ett spørsmål brukt av de to tillatte, resten `GET`:

```
→ POST /api/conversations                          ← 201
→ POST /api/mcp                                    ← 200
   adressen blir /threads/01478f55-…

etter reload, samme nettleser:
→ GET  /api/conversations?page_size=100            ← 200
→ GET  /api/conversations/4gJH8zomBFFf826l8I44_    ← 200
```

- **Eierskapet holder.** Tråden ligger i **min** liste, under «I dag», 10:23,
  med spørsmålet som tittel. Det er hele poenget med å opprette samtalen selv,
  og det stemmer.
- **`ka.user.v1`** skrives ved første kall, ikke ved oppstart.
- **Systemledeteksten er borte.** Den gjenopprettede samtalen har bare
  spørsmålet og svaret.
- **Den utledede agent-id-en ble godtatt** — `POST` svarte 201.
- **Ingen utdrag lagres**, som beskrevet: panelet er tomt selv om svaret viser
  til to.

## Funn

### 1. Den nye tomtilstanden er ikke nåbar, heller ikke i tilfellet den er skrevet for — bør

**Live-modus, 1440.** `blikk3/pr84-06-live-gjenopprettet-1440-light.png`

Den gjenopprettede tråden:

```
svaret         «… Bryggen i Bergen, som står på UNESCOs verdensarvliste
                siden 1979. [1] … anslagsvis 7 000 innbyggere før
                svartedauden … [2]»
kildepanelet   «Ingen kilder til dette svaret
                Svaret viser ikke til noen utdrag fra dokumentene.»
```

Det er setningen leseren kan motbevise ved å se på svaret ved siden av — den
PR-en er skrevet for å fjerne. `citationCount` er `undefined`, så
`emptyStateFor` faller tilbake på `BY_STATUS.complete` og `NOT_STORED` tegnes
aldri.

Beskrivelsen sier det selv («feltet er valgfritt til chatviewet begynner å
telle»), så det er ingen overraskelse. Men PR-en leser som om forbedringen er
levert, og i live er den det ikke — og live er der problemet er.

Den trenger heller ikke vente på #3: `messagesFromApi`
(`src/api/live/conversations.ts:193`) har `message.text` i hånda når den
bygger meldinga. Å telle `[n]` der gjør tilstanden nåbar i dag, i nettopp det
tilfellet den ble skrevet for, uten å røre `src/views/chat/`.

Ordlyden selv er riktig etter #4 sin runde. «Still spørsmålet på nytt for å få
et svar med kilder du kan åpne» lover ikke det den avbrutte lover, og det er
den rette forskjellen: et avbrutt svar finnes ikke ennå, mens dette svaret
står der og et nytt vil bygge på noe annet.

### 2. Klassekommentaren sier fortsatt at `listThreads` ikke gjør noe — kan

`src/api/live/LiveChatClient.ts:80`:

> `listThreads`, `getThread` and `listFacets` return nothing on purpose: the
> backend has neither thread history a frontend can read back nor facet counts.

To av de tre gjør nå nettopp det. Kommentaren er uendret i denne PR-en, og
bare `listFacets` er igjen. Det var dessuten den som fikk meg til å tro at
5183 var riktig server lenger enn jeg burde.

## Notert, ikke et funn

- **`main sup` er 0** i den gjenopprettede tråden: `[1]` og `[2]` er ren
  tekst, ikke markører, siden det ikke finnes kilder å peke på. Ingen døde
  lenker — de er inerte, og README sier det.
- **Bruker-id-en er ingen identitet**, og det står tre steder: modulkommentar,
  README og PR-beskrivelse. Det er den typen forbehold som pleier å forsvinne.
  Kvitterer på at det står.

## Til dirigenten

Ingen blokkerende. Ett bør, ett kan.

Avgjørelsen er hvem som lukker funn 1: fire linjer i `conversations.ts` her,
eller #3 sin oppfølger. Velges det siste, bør det stå et sted at live fortsatt
sier feil setning til den er inne.

---

## Etterrevisjon på `2799e90`: funn 1 er lukket

Anmeldt på nytt etter at #5 la tellingen inn i samme PR, slått sammen med
`main`. Målt i live på 5177 med **bare `GET`** på den tråden som alt lå i
basen — ingen nye spørsmål brukt.

```
GET /api/conversations?page_size=100          ← 200
GET /api/conversations/4gJH8zomBFFf826l8I44_  ← 200

svaret         «… verdensarvliste siden 1979. [1] … før svartedauden … [2]»
markører       2 i teksten, 2 unike, 0 <sup>
kildepanelet   «Kildene er ikke lagret for denne samtalen
                Svaret viser til utdrag, men de ble ikke lagret sammen med
                samtalen. Still spørsmålet på nytt for å få et svar med
                kilder du kan åpne.»
```

Likt i lys og mørk. `blikk3/pr84b-01-tomtilstand-1440-dark.png`. Panelet og
svaret står nå side om side og sier det samme.

To valg i tellingen er verdt å skrive ned, fordi begge kunne gått galt uten at
noen unit-test merket det:

- **Den teller på teksten, ikke på elementene.** `<sup>` er 0 i en
  gjenopprettet tråd — markørene er ren tekst når det ikke finnes kilder å
  peke på. En telling som lette etter markør-elementer ville endt på 0 og latt
  den gamle setningen stå, og alt ville sett grønt ut.
- **Den teller distinkt.** `[2]` to ganger er én kilde. Det spiller ingen
  rolle for terskelen `> 0`, men tallet står i modellen og blir lest som
  «antall kilder».

`citationCountIn` bruker `/\[\d+\]/g`, så et `[404]` i prosa eller et `[1]` i
en kodeblokk teller også med. Bergen-svaret har ingen av delene, så det er
utestet heller enn dekket. Smalt: det slår bare ut på et svar med tall i
klammer og ingen ekte markører.

**Portene på denne shaen**, kjørt i sin helhet fordi `ChatView` er rørt:
`build`, `lint`, `format:check`, `tokens:verify` grønne, unit **574 av 574**,
e2e **128 av 128** (port 4173, `CI=true`).

### Funn 2 står igjen

Klassekommentaren i `LiveChatClient.ts:80` sier fortsatt at `listThreads` og
`getThread` ikke gjør noe. Fortsatt et «kan».

### Meldt, og ikke om koden

Fillista var 13 filer på denne shaen, og beskrivelsen nevnte ikke
`src/model/message.ts`, `src/views/chat/ChatView.tsx` eller
`src/views/chat/ChatView.test.tsx`. Den sa også fortsatt at ordene var
uendret til chatviewet begynte å telle, at #3 gjorde det i en egen PR etter
merge, og at ingen e2e var kjørt — alle tre utdatert. Meldt i PR-en før merge.
