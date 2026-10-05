# Brukerblikk runde 8: en lenke appen skriver til seg selv, og ikke kan følge

Sett natt til 2026-09-23 av KA CC på `main c2e860b`, etter nattens arbeid:
#149, #151, #152 og #153. Mock på 1280 × 720, 1440 × 900 og 1920 × 1080 i lys
og mørk, live på egen port med `VITE_KA_TENANT=demo` og
`VITE_KA_DATASETS=norquad-docs=…`. Skjermbilder i
`design/skjermbilder-frontend/blikk8/`.

To live-spørsmål brukt, som er taket. Det andre gikk til å bevise funn 1.

## Sammendrag

Nattens arbeid holder. Søkestrengene under tenkesteget leser som det de er,
høydebudsjettet står uendret, og begge funnene fra runde 7 er målt lukket.

Men jeg fant noe som er eldre enn natta, og som jeg burde funnet i runde 7:
**i live er adressen appen skriver for en ny samtale ikke backendens id.**
Tråden kan ikke åpnes igjen — heller ikke av den som nettopp lagde den. Jeg så
symptomet i runde 7 og forklarte det bort med noe som ikke var forklaringen.

## 1. Adressen til en live-tråd peker på en samtale som ikke finnes

**Live, 1440 × 900.** `blikk8/live-04-egen-lenke-1440-lys.png`. **Eier: #5.**
**Blokkerer for testmiljøet.**

Målt på tråden, med nettverket som bevis. Ett spørsmål, samme nettleser hele
veien:

| Hva                                                 | Verdi                                           |
| --------------------------------------------------- | ----------------------------------------------- |
| adressen appen skrev                                | `/threads/e68ee39e-699f-4bed-b1d0-c97644240918` |
| `POST /api/conversations` svarte                    | `{"id":"rskfhAR3otaiib3NJiKfQ", …}`             |
| ved gjenåpning: `GET /api/conversations/e68ee39e-…` | **404 «Conversation not found»**                |

Backenden lagret samtalen riktig — riktig `userId`, riktig `corpus:norquad-docs`
— under sin egen id. Adressen bærer en id klienten selv fant på, og de to har
aldri vært den samme.

Følgen for en leser: samtalen kan ikke åpnes igjen. Ikke fra lista, ikke fra
adressen, ikke i samme nettleser, ikke etter fem sekunder og ikke etter seks —
jeg målte over seks sekunder for å være sikker på at det ikke var en lesing som
ikke var kommet. «Fant ikke tråden» står der fra første avlesning, og den er
sann: den id-en finnes ikke.

Og «Kopier lenke til tråden» kopierer nettopp den adressen.

I mock skjer ikke dette, fordi mocken lagrer under den samme id-en klienten
fant på. Det er derfor det ikke er synlig i noen test: mocken og live er enige
om alt annet enn hvem som bestemmer id-en.

**`docs/todo.md` sier i dag at lenken «virker bare i nettleseren som lagde
den». Det er for snilt.** Den virker ikke der heller. Punktet bør skrives om
når dette er rettet.

## 2. En tråd som lastes møter leseren med forsiden

**Mock og live, alle tre vindusstørrelsene.**
`blikk8/1440-04-gapet-tomt-lys.png`. **Eier: #3.** **Bør.**

Åpner du en tråd, er dette det første du ser:

> **Hei 👋**
> **Hva lurer du på?**
> Forslag: Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine
> årsrapporter …

Altså forsiden, med hilsen og tre forslag, over en samtale du nettopp klikket
på. Et sekund senere står samtalen der.

Det som gjør det til et funn og ikke bare en blink: **filterpanelet ved siden
av gjør det riktig i det samme øyeblikket.** Der står tre skjeletter og
«Dokumentene som er relevante for søket ditt vises her» — altså «dette laster».
To paneler, samme millisekund, og bare det ene sier sant.

Gapet er der med vilje: skrivefeltet skal virke mens lesingen går (#66, #149).
Det er ikke ventingen som er feil, det er hilsenen. Viewet vet at adressen
navngir en tråd — `threadId` er satt — og kan tegne trådens lastetilstand i
stedet for forsidens tomtilstand.

I mock varer det ~1 sekund. I live er det en nettverksrundtur.

## Det som ble målt lukket

**Runde 7 funn 1 — rå Markdown i overskriftsstien.** Lukket i #147. Målt i
live på nytt: ingen `#` noe sted i hele kildepanelet, og stiene leser
«Europas historie 1789–1914 › Stille før stormen (1900–1914) › Mot krig
(1911–1914)».

**Runde 7 funn 2 — dokumentlista blandet lenker og ikke-lenker.** Lukket i
#146. Målt på alle tre vindusstørrelsene: «Instruks · Nasjonal
kommunikasjonsmyndighet · 2024**, uten lenke**», mens de to med adresse står
som lenker uten noe tillegg.

## Nattens arbeid, sett med brukerens øyne

**Søkestrengene under tenkesteget (#152)** leser som det de er. Under «Jeg
søker i årsrapporten og tildelingsbrevet» står «Søkte etter:» og tre nøytrale
merker: «måloppnåelse Nkom», «tildelingsbrev Nkom hovedmål»,
«rapporteringskrav styringsparameter». Ingen av dem er klikkbare, og
ingenting antyder at de er det.

| Mål                                          | Verdi             |
| -------------------------------------------- | ----------------- |
| tenkepanelet lukket                          | **58 px**         |
| tenkepanelet åpent                           | 414 px            |
| søkestrengblokka i det åpne                  | **64 px**         |
| kontrast, merketekst mot merket (lys / mørk) | **11,60 / 11,57** |
| axe på det åpne panelet, lys og mørk         | **0 brudd**       |

Det lukkede panelet er 58 px, som før: leseren betaler ingenting for dette før
hen selv åpner. Og det åpne panelet er en tilstand ingen e2e-test kjører axe
på i dag — jeg gjorde det her, og det er rent.

Én observasjon uten alvorsgrad: merkenes flate måler 1,1:1 mot kortet under
dem. Teksten er langt over kravet, og merkene er ikke kontroller, så det er
ikke et brudd — men det som skiller dem fra vanlig tekst er formen og
luften, ikke fargen. Det er Designsystemets nøytrale `Tag` slik den er, og
verdt å vite hvis noen senere lurer på hvorfor de er diskré.

**I live henter tenkepanelet ekte søkestrenger** fra agenten, tre blokker med
til sammen fem. De to siste er leserens eget spørsmål ordrett — det er hva
agenten faktisk søkte på, så det er ærlig, men det leser rart å se spørsmålet
sitt igjen som et søkeord.

**Gapet (#149, #153)** oppfører seg som anmeldelsene sa: adressen står,
ingen fantomtråd, og turen er der etter en reload i mock. Det er bare
hilsenen over den, som er funn 2.

**Testmiljøet (#151)** er ikke synlig for en leser, og det er riktig.
`config.js` lastes før bundelen, og appen ser ut nøyaktig som før.

## Høydebudsjettet

| Vindu       | Leservindu | Klebrig nederst | Synlig av svaret | Runde 7 |
| ----------- | ---------- | --------------- | ---------------- | ------- |
| 1280 × 720  | 538        | 214             | **315 px**       | 315     |
| 1440 × 900  | 718        | 214             | **495 px**       | 495     |
| 1920 × 1080 | 898        | 214             | **675 px**       | 675     |

Piksel for piksel som i runde 7. Dokumentet ruller aldri, på noen størrelse,
i noen modus, i mock eller live.

## Rettelse til runde 7

I runde 7 skrev jeg at «en fersk nettleser er en ny bruker», og at «Fant ikke
tråden» i live var verktøyet mitt som laget tilstanden det målte. Den halve
forklaringen var riktig: en ny profil får en ny `ka.user.v1`, og derfor en tom
trådliste.

**Men den forklarte ikke 404-en på selve tråden**, og det burde jeg sett. Den
id-en har aldri vært backendens, så den ville gitt 404 i hvilken som helst
nettleser. Jeg hadde nettverksloggen tilgjengelig begge gangene og så ikke i
den; jeg forklarte et symptom med det første som passet, og det passet bare
halvveis.

Formen er verdt å ta med: **en forklaring som dekker en del av det du ser er
farligere enn ingen forklaring**, fordi den stopper letingen. Det som skilte
denne gangen var å lese hva som faktisk gikk på tråden i stedet for å
resonnere om hva som burde gått der.

## Til dirigenten

- **Funn 1 haster mer enn de andre**, fordi testmiljøet i #151 er i ferd med
  å bli vist til folk. En demo der en samtale ikke kan åpnes igjen, og der
  «Kopier lenke» gir en død lenke, er verre i live enn i mock.
- Funn 2 er liten og hører til #3.
- `docs/todo.md`-punktet om «Kopier lenke til tråden» bør skrives om: det sier
  i dag at lenken virker i nettleseren som lagde den, og det gjør den ikke.
