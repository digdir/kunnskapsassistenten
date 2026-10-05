# Brukerblikk runde 6: opplastingsflyten hele veien, og to overskrifter som ikke følger med

Sett 2026-09-21 av KA CC på `main 9a016af`, etter #117, #123, #124 og #125.
Mock på 1440 × 900 og 1280 × 720, live på egen port med nøkkelen fra
`.env.local`. Skjermbilder i `design/skjermbilder-frontend/blikk6/`.

To live-spørsmål brukt, som er taket.

## Sammendrag

Opplastingsflyten henger sammen hele veien i mock: en fil lagt ved i
skrivefeltet dukker opp under «Dine dokumenter» i filterpanelet, svaret sier
at det er bygget på den, og kildepanelet viser den som «Ditt dokument» uten
lenke. Det er den første runden der en hel ny funksjon er til å gå gjennom fra
ende til ende, og den gjør det.

To funn, og begge er av samme slag: en overskrift som ble skrevet da det bare
fantes én slags dokumenter, og som ikke har fulgt med. Ingen av dem er
WCAG-brudd; begge er panelet som sier noe leseren kan se er galt.

## 1. Ditt eget dokument står under «Fra Kudos»

**Mock, 1440 × 900.** `blikk6/03-kilder-eget-dokument-1440.png`. **Eier: #2.**
**Bør.**

Etter et spørsmål med vedlegg ser filterpanelet slik ut:

```
Dokumenter
Fra Kudos
  • Årsrapport 2025.pdf            ← leserens egen fil
  • Årsrapport Nasjonal kommunikasjonsmyndighet 2025
  • Tildelingsbrev Nkom 2026 (DFD)
  • Instruks for økonomi- og virksomhetsstyring i Nkom
…
Dine dokumenter
  • Årsrapport 2025.pdf   PDF · 2 kB
```

Målt: den samme fila står to steder i samme panel, og den ene av dem er under
en overskrift som sier at dokumentet kommer fra Kudos. Det gjør det ikke — det
kom fra leserens egen maskin, og ingen andre har det.

Dette er samme sak som #110 løste for korpusnavnet: overskriften fulgte ikke
dataene under seg. To veier ut, og eieren velger: hold egne dokumenter utenfor
lista over det svaret bygger på, eller merk raden slik kildepanelet gjør
(«Ditt dokument»).

Filnavnet i målingen er valgt med vilje: «Årsrapport 2025.pdf» ligner
korpusets «Årsrapport Nasjonal kommunikasjonsmyndighet 2025». Det er nettopp
da en leser trenger at panelet sier hvilket som er hvilket.

## 2. Fraskrivelsen sier «fra Kudos» uansett hvilket korpus som er valgt

**Live, 1440 × 900.** `blikk6/10-live-kilder-1440.png`. **Eier: #4.** **Bør.**

Over kildene står det:

> All tekst er sitater fra dokumentene **fra Kudos**. Ikke generert av
> kunstig intelligens.

Målt i live, der korpuset ikke er Kudos: kildekortet er «Oldtidens egypt» fra
standardkorpuset, altså en Wikipedia-artikkel. Setningen navngir feil kilde
over en artikkel leseren kan se ikke er derfra.

#123 utvidet den samme setningen da et opplastet dokument kunne ligge i lista
(«både fra Kudos og fra dine egne»), og den avgjørelsen var riktig av nøyaktig
denne grunnen. Korpushalvdelen står igjen: `corpusDisplayName` finnes fra #110
og er det samme oppslaget linja over dokumentlista bruker.

Merk om oppsettet: min dev-server har ikke `VITE_KA_DATASETS`, så korpuset
heter «standardkorpuset» her og ikke «Wikipedia (NorQuAD)». Det endrer navnet,
ikke funnet.

## 3. Chipsene står fortsatt over et felt som ser ubrukt ut

**Mock, 1440 × 900.** `blikk6/11-chips-over-tomt-felt-1440.png`. **Eier: #2.**
**Kan.** Runde 4 funn 4, runde 5 funn 4, uendret. Målt på nytt: etikettrad 42
px, feltet med chipen 85, «1 av 5 valgt» 27 — tre rader der to sier det samme,
og en tom søkeboks i midten.

## 4. Samme tittel deles med bindestrek i kildekortet

**Mock, 1440 × 900.** `blikk6/03-kilder-eget-dokument-1440.png`. **Eier: #4.**
**Kan.** Runde 4 funn 5, runde 5 funn 5, uendret: «Årsrapport Nasjonal
kom-munikasjonsmyndighet 2025» i kortet, mens de to andre stedene på skjermen
bryter på mellomrom.

## Høydebudsjettet med brukerens øyne

Serien #114, #115 og #119 er målt hver for seg i sine egne rapporter. Her er
den som leseren møter den: hvor mye av svaret som er synlig uten å rulle, målt
fra bunnen av view-hodet til overkanten av det klebrige skrivefeltet, med
svaret rullet til toppen.

| Vindu      | Klebrig nederst | Synlig av svaret | Av svarets høyde |
| ---------- | --------------- | ---------------- | ---------------- |
| 1440 × 900 | 214 (var 302)   | **491 px**       | 35 %             |
| 1280 × 720 | 214             | **311 px**       | 24 %             |

Metoden står her så runde 7 kan gjenta den: `.ka-message--assistant .markdown`
sitt rektangel, klippet mot rullevinduet minus view-hodet og minus
`.ka-composer-area`.

**Og kanten er ikke lenger skarp.** Runde 4 funn 2 handlet like mye om at
svaret ble klippet av et ugjennomsiktig felt uten antydning om at det var mer
under. Nå faller teksten av i en gradient over skrivefeltet
(`blikk6/05-leservindu-1280.png`, «Hva som gjøres opp» halvveis synlig). Det
er ikke et tall, men det er forskjellen mellom «slutt» og «det fortsetter».

## Det som er blitt bedre siden runde 5

- **Funn 1 og 2 fra runde 5 er lukket** (#110 og #111): overskriften følger
  korpuset, og forslagene er ikke lenger Kudos-spørsmål over Wikipedia.
- **Hele opplastingsflyten**, som ikke fantes i runde 5: legg ved i
  skrivefeltet → «Dine dokumenter» → svaret sier «Svaret er også bygget på
  dokumentet du la ved, «Årsrapport 2025.pdf».[1]» → kildekortet «Ditt
  dokument», uten lenke, med den ærlige setningen om hvorfor.
- **Live sier ærlig fra på alle tre stedene.** Bindersen i skrivefeltet er
  `aria-disabled` og heter «Legg ved dokument. Opplasting er ikke tilgjengelig
  i denne tjenesten ennå.»; «Dine dokumenter» har ingen filvelger og samme
  setning; kildepanelet har ingen egne dokumenter å vise.
- **Dokumentlista fylles i live** («Fra standardkorpuset: Første verdenskrig»),
  som sto tom tidligere i dag.

## Live, og hva det kostet

To spørsmål, begge besvart med kilder: «Oldtidens Egypt» (tenkte i 10 sekunder,
3 markører) og «første verdenskrig» (22 sekunder, 2 markører). Hele turen tar
minutter fra ende til ende, ikke sekunder — verdt å vite for den som planlegger
en demo.

## En felle i min egen måling, tredje gang

Jeg leste de første 320 tegnene av hovedkolonnen mens det første live-svaret
holdt på, så en tenke-tekst som sluttet midt i «Search pass», og var i ferd
med å skrive at turen døde uten feilmelding. Den var ikke død: tenkesteget er
langt, og både svaret og kildene kom. Det var kuttet mitt, ikke produktet.

Samme form som de to forrige gangene: **et utsnitt er ikke en tilstand.** Les
hele, eller les det elementet påstanden handler om — og når noe ser ødelagt
ut, mål en gang til før det skrives ned.

## Til dirigenten

- Funn 1 og 2 er begge «overskriften fulgte ikke dataene». De hører til hver
  sin eier, men det er én lærdom: hver streng som navngir en kilde bør spørre
  `corpusDisplayName` eller `origin`, aldri stå fast.
- Runde 5 funn 4 og 5 er nå tre runder gamle. De er «kan», og de blir ikke
  mindre av å stå — verdt en avgjørelse om de skal lukkes som «sånn er det».

**Avgjort samme dag:** begge lukkes som «sånn er det». Chipsene ligger i
Designsystemets eget Suggestion-felt slik komponenten tegner det, og
bindestreken i kildekortet er valgt framfor overflyt. Dirigenten skriver det i
beslutningene, og de står altså ikke som åpne funn i runde 7.
