# Brukerblikk runde 7: mandagens arbeid sett med brukerens øyne

Sett 2026-09-22 av KA CC på `main 7918108`, etter #117 til #144 — korpusvalg,
korpusbytte, opplasting, høydebudsjett, korpus per svar og de to vaktene.
Mock på 1280 × 720, 1440 × 900 og 1920 × 1080 i lys og mørk, live på egen port
med nøkkelen fra `.env.local` og `VITE_KA_TENANT=demo`. 43 skjermbilder i
`design/skjermbilder-frontend/blikk7/`.

To live-spørsmål brukt, som er taket.

## Sammendrag

Mandagens arbeid henger sammen. Korpusvalget bytter korpus, tømmer skjermen og
starter en ny tråd; en eldre tråd navngir sitt eget korpus i alle tre
setningene som nevner det; en opplastet fil går hele veien fra bindersen i
skrivefeltet til et kildekort som sier at bare du har dokumentet. Begge
funnene fra runde 6 er lukket, og jeg har målt dem lukket og ikke bare lest
PR-ene.

To funn, og de er små. Det ene er det eneste stedet i live der noe fra
backend tegnes rått på skjermen. Det andre er en liste der to dokumenter er
lenker og det tredje ikke er det, uten at noe sier hvorfor.

Og ett notat om verktøyet mitt som er større enn begge funnene: jeg var to
ganger i ferd med å skrive ned et produktfunn som var en feil i målingen.

## 1. Live tegner rå Markdown i utdragets overskriftssti

**Live, 1440 × 900.** `blikk7/live-03-kilder-1440-lys.png`. **Bør.**

I kildepanelet står overskriftsstien til utdrag 2 slik:

> Første verdenskrig › Bakgrunn**### Navn**

`###` er Markdown som ikke er tegnet. Stien kommer fra
`parseHeadingPath` i `src/api/live/mcp.ts`, som plukker verdiene ut av
Clojure-kartet backend sender i `metadata` og setter dem sammen med `›`.
Verdien er tatt ordrett, og når chunkeren har lagt en rå overskrift inn i
verdien, er det den leseren ser.

Det er det eneste stedet i live der noe fra backend når skjermen uten å gå
gjennom Markdown-tegneren. Hvem som skal fikse det er en avgjørelse: panelet
kan stryke innledende `#`-er, eller bestillingen kan be om en ren verdi.
Frontenden er det billigste stedet i dag, og det eneste som virker uten at
noen andre gjør noe.

## 2. Dokumentlista blander lenker og ikke-lenker uten å si hvorfor

**Mock, alle tre vindusstørrelser, lys og mørk.**
`blikk7/1280-02-svar-lys.png`, `blikk7/1920-03-kilder-mork.png`. **Eier: #2.**
**Kan.**

Under «Dokumenter / Fra Kudos» står tre dokumenter etter et svar. To er blå,
understrekede lenker. Det tredje — «Instruks for økonomi- og
virksomhetsstyring i Nkom» — er svart tekst. Ingenting sier hvorfor.

Det er med vilje, og kommentaren i `DocumentsList.tsx:179` sier hvorfor: et
mappebasert korpus har ingen offentlig adresse, og «en tittel uten lenke slår
en lenke som går ingen steder». Jeg er enig i valget.

Funnet er at **kildepanelet sier det høyt om det samme dokumentet** —
«Dokumentet har ingen offentlig lenke.» — mens filterpanelet lar det være. To
paneler, samme dokument, samme fakta, og bare det ene forklarer seg. Leseren
som ser den svarte tittelen i lista har ingen måte å vite om det er en feil
eller et vilkår.

## Det som ble målt lukket

**Runde 6 funn 1 — egen fil under «Fra Kudos».** Lukket i #130. Målt:
`egenFilUnderFraKorpus: false` etter et spørsmål med vedlegg. Fila står bare
under «Dine dokumenter».

**Runde 6 funn 2 — fraskrivelsen sa «fra Kudos» uansett korpus.** Lukket i
#129 og #139. Målt i live, der korpuset ikke er Kudos: «All tekst er sitater
fra dokumentene **fra standardkorpuset**. Ikke generert av kunstig
intelligens.» Og i mock, i en eldre Kudos-tråd med Wikipedia (mock) valgt:
«… **fra Kudos**», med «Hentet fra Kudos» over svaret og «Les dokumentet på
Kudos» i lenkene. Alle tre setningene følger svaret.

**Runde 6 funn 3 og 4** ble lukket som «sånn er det». Chipsen er likevel målt
på nytt, og den er blitt billigere av seg selv:

| Rad               | Runde 6 | Nå      |
| ----------------- | ------- | ------- |
| etiketten         | 42      | **27**  |
| feltet med chipen | 85      | 85      |
| «1 av 5 valgt»    | 27      | 27      |
| til sammen        | 154     | **139** |

Femten piksler spart uten at noen gikk løs på det. Selve `ds-field` måler 162
px med sine egne marger. Funnet står som lukket; tallet er tatt med fordi
høydebudsjettet nå følges over tid.

## Høydebudsjettet, med brukerens øyne

Samme metode som runde 6: `.ka-message--assistant .markdown` sitt rektangel,
klippet mot rullevinduet minus view-hodet og minus `.ka-composer-area`.

| Vindu       | Leservindu | Klebrig nederst | Synlig av svaret | Runde 6   |
| ----------- | ---------- | --------------- | ---------------- | --------- |
| 1280 × 720  | 538        | 214             | **315 px**       | 311       |
| 1440 × 900  | 718        | 214             | **495 px**       | 491       |
| 1920 × 1080 | 898        | 214             | **675 px**       | ikke målt |

Uendret fra runde 6, og det er det riktige svaret: ingen av mandagens PR-er
skulle koste høyde, og ingen av dem gjorde det. De fire pikslene er
måleusikkerhet, ikke en endring.

Andelen av svaret som er synlig er **ikke** sammenlignbar med runde 6 (35 % og
24 % der, 40 % og 26 % her), fordi svaret er kortere denne gangen — 1233 px
mot rundt 1400. Det er pikslene som er målingen; prosenten er en egenskap ved
spørsmålet.

Ved 1920 ser 55 % av svaret på én gang. Det er den første målingen der over
halvparten er framme uten å rulle.

## Resten av det som ble gått gjennom

**Korpusvalget og byttet.** Velgeren har to korpus i mock. Et bytte tømmer
skjermen, går til `/`, setter korpuslinja til «Dokumenter fra Wikipedia
(mock)» og bytter de tre forslagene til de generelle. Målt på 1440 og 1920; på
1280 lot det seg ikke måle i samme gjennomgang, fordi kildepanelet var åpnet
først og det kollapser navigasjonspanelet ved den bredden — som er regelen fra
#97 og ikke en feil.

**Korpus per svar.** På 1920: spør i Kudos (ingen linje over svaret, som er
riktig), bytt til Wikipedia (mock), spør igjen (ingen linje), åpne
Kudos-tråden igjen mens Wikipedia står valgt → «Hentet fra Kudos» over svaret
og «fra Kudos» i fraskrivelsen, med velgeren fortsatt på `norquad-mock`.

**Opplasting ende til ende, mock.** Bindersen tar imot fila, chipen står i
skrivefeltet med «Årsrapport 2025.pdf er lastet opp og lagt ved», spørsmålet
får «Med vedlegg: Årsrapport 2025.pdf» under seg, svaret åpner med «Svaret er
også bygget på dokumentet du la ved, «Årsrapport 2025.pdf».[1]», fila står
under «Dine dokumenter» med «PDF · 21 B», og kildepanelet har kortet med «Fra
ditt eget dokument» og «Bare du har dette dokumentet, så det finnes ingen
lenke til det.»

**Opplasting i live.** Fortsatt ærlig på alle tre stedene: bindersen er
`aria-disabled` og heter «Legg ved dokument. Opplasting er ikke tilgjengelig i
denne tjenesten ennå.», «Dine dokumenter» sier det samme i slippsonen, og
filterpanelet sier «Filtrering er ikke tilgjengelig ennå. Du kan stille
spørsmål uten å avgrense dokumentene.»

**Rulling.** Dokumentet ruller aldri: `scrollHeight − clientHeight = 0` på
alle tre vindusstørrelsene, i mock og i live, med og uten kilder åpne.
Hovedkolonnen ruller på seg selv.

**1280 med kilder åpne.** nav 67 (rail), hovedkolonne 749, kilder 432 — samme
tre tall som funksjonssjekk v1.1 målte 15.09.

**Live-turene.** To spørsmål, begge besvart med kilder: «Hva handler
artikkelen om første verdenskrig om?» (14 sekunder, 4 markører, 786 tegn) og
«Hva var Wienerkongressen?» (14 sekunder, 4 markører, 805 tegn). Raskere enn
runde 6, der de tok 10 og 22 sekunder.

## To feller i min egen måling, og begge er den samme

Runde 4, 5 og 6 endte hver med ett notat om en måling som løy. Denne runden
har to, og de er verdt mer enn funnene over.

**Jeg la fila i feil filvelger.** `input[type="file"]` finnes to steder på
sida: i skrivefeltet og i «Dine dokumenter» i filterpanelet. `.first()` traff
filterpanelets. Fila ble lastet opp, den dukket opp under «Dine dokumenter»,
og svaret nevnte den ikke med et ord — fordi den aldri ble lagt ved
spørsmålet. Jeg var i ferd med å skrive at vedleggsflyten var brutt siden
runde 6. Den var ikke det; jeg hadde brukt den andre veien inn.

**En fersk nettleser er en ny bruker.** Live henter trådlista med
`X-User-Id`, og id-en er et tilfeldig tall i `localStorage` under
`ka.user.v1`. Hvert `chromium.launch()` er en ren profil, altså en ny id, og
da svarer backend `{"conversations":[],"total":0}` og tråd-URL-en blir «Fant
ikke tråden». Jeg målte det stabilt over 30 sekunder og var i ferd med å
skrive at live mister tråden ved omlasting.

Kontrollmålingen: jeg satte `ka.user.v1` til en id jeg selv eide, la en tråd i
backend med den id-en, og åpnet tråd-URL-en. Da sto tråden i lista og siden
tegnet den med tittel og alt. Produktet gjør nøyaktig det tomtilstanden lover:
«Tråder lagres ikke på tvers av nettlesere.»

Formen er den samme som de tre forrige gangene, men et hakk verre: der jeg før
leste **et utsnitt** og trodde det var en tilstand, laget jeg denne gangen
**tilstanden selv** med verktøyet og leste den som produktets. En måling som
ikke stemmer med det du forventet, er først en påstand om instrumentet.

## Til dirigenten

- Funn 1 (rå `###` i live) trenger en eier. Frontenden kan stryke det i dag;
  bestillingen er den varige veien.
- Funn 2 er en «kan» og en avgjørelse: skal filterpanelet si det samme som
  kildepanelet om et dokument uten adresse, eller skal kildepanelet la være å
  si det? Ett av panelene bør endres, ikke begge.
- **«Kopier lenke til tråden» lover mer enn live kan holde.** Lenken virker
  bare i nettleseren som lagde den, fordi `ka.user.v1` er identiteten. Det er
  skrevet ned i tomtilstanden og i README, så det er ikke et nytt funn — men
  knappen tilbyr å dele noe som ikke lar seg dele ennå, og det er verdt en
  avgjørelse nå som live brukes til demoer.
- Jeg la igjen én tråd i den lokale stacken fra kontrollmålingen:
  «Målingstråd for brukerblikk 7», eier `ka-blikk7-maaling`. Den er tom og
  ingen ser den uten den id-en.
