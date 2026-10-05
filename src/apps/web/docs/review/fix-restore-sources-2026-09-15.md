# PR #57, `fix/restore-sources`: funn 5, 6 og 7 er rettet, og funn 1 var min feilmåling

2026-09-15, anmelderen (KA CC). Gren `2274f6d` slått sammen med `main`
`7f7147f` til `9251b78`; `git merge-tree` ga ingen konflikt. Alt måles på
sammenslåingen, i bygget app på `vite preview` 4173, 1440 × 900, mock-modus.

Kort: **ingen blokkerende.** Tre av de fire funnene er rettet og målt. Det
fjerde, funn 1, lar seg ikke reprodusere noe sted — heller ikke på den
`main`-en jeg skrev det opp fra. Det er min feil, ikke #3 sin, og resten av
rapporten forklarer hvorfor.

## Portene

| Port            | Resultat                                               |
| --------------- | ------------------------------------------------------ |
| `build`         | grønn                                                  |
| `lint`          | grønn                                                  |
| `format:check`  | grønn                                                  |
| `tokens:verify` | grønn                                                  |
| `npm test`      | grønn, **427 tester i 42 filer** på sammenslåingen     |
| axe, fire ruter | 1 brudd, `region` — står likt på `main`, se «Riktig» 5 |

PR-en oppgir 379 unit; sammenslåingen har 427, fordi `main` har flyttet seg
sytten commits siden grenpunktet.

---

## Funn 1: ikke reprodusert, verken på grenen, på `main` eller der jeg fant den

**Ikke et funn mot denne PR-en. En retting av min egen rapport.**

Dirigenten ba meg måle min egen reise om igjen. Jeg har kjørt den i fem
varianter, på tre commits: `5be38f1` (der brukerblikk runde 2 ble skrevet),
`7f7147f` (`main` nå) og `9251b78` (sammenslåingen).

| Variant                                  | 5be38f1          | 7f7147f          | 9251b78          |
| ---------------------------------------- | ---------------- | ---------------- | ---------------- |
| Ett spørsmål, ferdig, reload             | ikke reprodusert | ikke reprodusert | ikke reprodusert |
| To spørsmål, begge ferdige, reload       | ikke reprodusert | ikke reprodusert | ikke reprodusert |
| Panelet parkert på svar 1, så reload     | ikke reprodusert | –                | –                |
| Reload mens svar 2 strømmer              | ikke reprodusert | –                | –                |
| Reload straks etter at svar 2 ble ferdig | ikke reprodusert | –                | –                |

På sammenslåingen, to svar og reload: 3 kildekort før, 3 etter; «Kilder til
svar 2 av 2» før og etter; «Fra Kudos» med 3 rader før og etter; 14 markører
før og etter; klikk på `[1]` åpner utdraget. Null «Ingen kilder ennå».
(`pr57/reload-foer.png`, `pr57/reload-etter.png`.)

### Hva som faktisk finnes

Et **vindu på rundt 320 ms** rett etter reload. Prøvd hver 150 ms:

| ms etter reload | svarmeldinger | kildekort | «Ingen kilder ennå» |
| --------------- | ------------- | --------- | ------------------- |
| 0               | 0             | 0         | 0                   |
| 171             | 0             | 0         | **1**               |
| 329             | 0             | 0         | **1**               |
| 487             | 2             | 3         | 0                   |

Målt **likt på `5be38f1` og på `9251b78`**, ned til prøvetakingen: PR-en gjør
verken fra eller til her. Og legg merke til den første kolonnen: mens panelet
er tomt, er samtalen ikke på skjermen heller. Ingen leser ser et ferdig,
sitert svar ved siden av et panel som sier at hen ikke har spurt om noe. Det
er en tom app som fyller seg, ikke to paneler som lyver.

### Hvorfor rapporten min sa noe annet

Rådataene mine (`blikk2/maalinger-2.json`, sak B) sier «Kilder til svar **1**
av 2» før reload og `fraKudos: 0`. Begge deler betyr at svar 2 fortsatt
strømmet, og at jeg hadde klikket meg til svar 1. Jeg gjenskapte akkurat den
tilstanden — variant D, `pr57/variant-D-foer.png` — og fikk «før»-tallene
mine på nikk. Etterpå fikk jeg 3 kildekort der målingen min hadde 0.

Forskjellen er tidspunktet. Jeg leste panelet **én gang**, inne i vinduet
over, og skrev det ned som en tilstand. Det var et øyeblikksbilde av en app
under gjenoppbygging, presentert som noe som ble stående. #3 sine fem forsøk
var riktige, og de fem timene de kostet er på min konto.

Jeg retter `brukerblikk-2-2026-09-15.md` og legger «les én gang, konkluder
med tilstand» i fellene i `docs/review/README.md`, i egen PR.

---

## Bør

### 1. Testen som skulle vokte funn 1 er grønn på `main` uten fiksen

`tests/e2e/samtale.spec.ts:134`, «en markør i et gjenopprettet svar åpner
utdraget sitt». Jeg la testfila fra PR-en på `main` `7f7147f` uten
kildeendringene og kjørte de to nye testene:

```
1 passed   en markør i et gjenopprettet svar åpner utdraget sitt
1 failed   en samtale startet på forsida overlever en reload
           samtale.spec.ts:107  .ka-thinking__summary  (tenketiden)
```

Den første passerer uendret uten fiksen, altså låser den ingenting. Den andre
feiler, men på **tenketiden** — funn 5 — og de nye kilde-påstandene på linje
113–114 ble aldri nådd, fordi linje 107 stoppet testen først.

Det er ikke galt å ha testene; de beskriver oppførsel vi vil ha. Men de bør
ikke stå med kommentarer som sier at de vokter funn 1, for det gjør de ikke,
og neste anmelder vil tro det. Forslag: behold dem, skriv om kommentarene til
det de faktisk måler, og la funn 1-historikken bo i denne rapporten. Fila er
min; jeg tar den endringen når PR-en er merget, med mindre #3 heller vil.

### 2. To mapper utenfor #3 sitt eierskap

`tests/e2e/samtale.spec.ts` er min, `src/api/mock/MockChatClient.ts` er #5
sin. Modellendringen (`Message.thoughtMs`) var klarert av dirigenten; disse to
var ikke nevnt. Innholdet er greit i begge — mock-endringen er den samme
klokken som i `useChat`, og testene er dem jeg selv ville skrevet — så dette
er en merknad om rutine, ikke om kode.

---

## Kan

### 3. Ansvarslinja brekker fortsatt til to linjer på 1440

Målt på sammenslåingen: `.ka-composer__disclaimer` er 2 linjer høy.
Rekkefølgen er rettet, som var det funn 6 handlet om, men bruddet står igjen.
Verdt å vite når noen ser på skrivefeltet neste gang.

### 4. `foundNothing` lages på nytt hver render

`src/views/chat/ChatView.tsx:367`: `foundNothing={(messageId) => …}`. Koster
ingenting i dag, siden `MessageList` ikke er memoisert. Nevnt fordi den ligger
ved siden av `filterSummary`, som har samme form.

---

## Det som er riktig, og hvor jeg sjekket det

1. **Funn 5 er rettet og målt.** Samme svar, før og etter reload: «Tenkte i 7
   sekunder» begge steder på sammenslåingen. På `main` `7f7147f` samme reise:
   «Tenkte i 7 sekunder» → «Tenkte i 4 sekunder». Klokken ligger nå på
   meldinga (`Message.thoughtMs`), målt i strømmen både i `useChat` og i
   mocken, og `ThinkingPanel` leser i stedet for å telle. Panelet mistet sin
   egen `useEffect`-klokke, som er riktig: den bodde i en komponent som bare
   finnes mens samtalen er på skjermen.
2. **Funn 6 er rettet.** `.ka-composer__disclaimer` leser nå
   «Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.»
   først, så snarveien. Skilletegnet fulgte med til `::before`, som er det
   riktige stedet når hintet er sist. (`pr57/funn-6-og-7.png`.)
3. **Funn 7 er rettet, og bare der det skulle.** «simuler ingen treff»:
   0 avslutningsspørsmål, 0 chips. Vanlig svar i samme samtale rett etterpå:
   1 avslutningsspørsmål, 3 chips. Merket per melding-id og ikke «den siste»,
   som er riktig i en tråd med flere svar.
4. **Mekanismen bak funn 1 er god selv om symptomet ikke fantes.** Å
   sammenlikne mot det skallet faktisk holder, i stedet for mot en `useRef`
   over hva som er sendt, gjør klassen av feil umulig: uansett hva som tømmer
   skallet, ser neste render hullet og fyller det. `clearAnswerSources` bundet
   til avmontering gjennom en ref er også riktig React — med
   `[clearAnswerSources]` ville opprydningen kjørt på en helt vanlig
   gjengivelse. Begge deler er billigere nå enn etter at noen har bygget på
   dem.
5. **Ingen a11y-regresjon.** Fire ruter (`/` og `/threads/nkom-maaloppnaaelse`,
   lys og mørk): ett axe-brudd, `region`, på drahåndtaket mellom panelene.
   Det står **likt på `main` `7f7147f`**, kom med #50 og er #5 sitt. Samme
   svar for «første overskrift er h2, ikke h1».
6. **Ikke-funn, så ingen melder det på nytt:** verktøyet skriver «textarea
   _Spørsmål til Kunnskapsassistenten_ ingen outline/box-shadow». Feltet har
   likevel synlig fokus: `.ka-composer:focus-within` tegner
   `outline: solid 3px` og en hvit innerskygge, målt før og etter fokus.
   Verktøyet leser elementet og `ds-field`, ikke omslaget. Jeg legger det i
   fellene i `README.md`.

## Til dirigenten

- **PR #57 er klar for Lars.** Ingen blokkerende, to «bør» som begge er
  rutine og tekst, to «kan».
- **Funn 1 skal ikke rettes mer.** Det som er gjort er en forbedring på egne
  premisser; symptomet fantes ikke. Be #3 legge den fra seg.
- Jeg rydder i min egen rapport fra runde 2 og i fellelista, i egen PR. Det
  som gikk galt var at jeg leste et panel én gang midt i en gjenoppbygging og
  skrev det som en tilstand.
