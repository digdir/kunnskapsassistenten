# Brukerblikk runde 4: hva ser rart ut etter dagens bølge

2026-09-17, anmelderen (KA CC). `main` = `198b7c1`, mock-modus, dev-server på
**5182** (hovedsjekkouten, som sto der fra før — 5182 var opptatt av en annen
agent å starte selv, så jeg brukte den som allerede serverte riktig sha).
**1440 × 900, 1280 × 720 og 1024 × 768, lys og mørk.**

Runde 3 så på nattbølgen 15.–16.09. Denne runden ser på det som kom i dag:
sidekolonnene som skuffer under 1139 (#97), breddekontrollene som forsvinner
når vinduet ikke har noe å gi (#93), chip-navn per dimensjon (#91) og unike
lenkenavn i kildepanelet (#92) — og måler alle ni funnene fra runde 3 på nytt.

**Alt under er grønt.** E2E er 140/140 på `main` og axe gir null brudd på de
rutene og tilstandene som er målt i anmeldelsene av #91, #92, #93 og #97,
inkludert med en skuff åpen i begge moduser. Ingenting her er en regresjon i
noe som er målt. Det er ting som ser rart ut for en som bruker appen.

Skjermbilder i `design/skjermbilder-frontend/blikk4/`.

## Sammendrag

| Eier                | Funn |
| ------------------- | ---- |
| #5 skall og layout  | 1, 2 |
| #3 hovedkolonne     | 2, 3 |
| #2 navigasjonspanel | 4    |
| #4 kildepanel       | 5    |

**Funn 2 er den eneste som gjør noe vanskelig å bruke.** Den er runde 3 sitt
funn 8, målt skarpere: på 1280 × 720 leser du et svar på 1233 px gjennom et
vindu på 106 px.

---

## 1. Skuffhodet tar railens farge, ikke skuffas

**1024 × 768, lys og mørk.** `blikk4/02-skuff-nav-1024-light.png`
**Eier: #5.** **Bør.**

Åpne navigasjonsskuffa. Hodet med «← Tråder / Filtrering / Dokumenter fra
Kudos …» tegnes som et grått felt inne i en hvit skuff, med hvite marger på
begge sider. Det ser ut som et kort som har havnet feil.

Samme element, samme mål, to farger:

```
dokket 1440:  .view-head  x=36 w=327 h=179   bakgrunn rgb(255, 255, 255)
i skuffa:     .view-head  x=36 w=327 h=179   bakgrunn rgb(243, 244, 244)
```

Hodet henter fargen sin fra `--ka-region-surface` (`global.css:575`), og den
løses opp gjennom landemerket. I skuffmodus er landemerket på rada en **rail**,
og railens flate er `#f3f4f4` — mens flata hodet faktisk tegnes på, er
Designsystemets dialog, som er hvit. Målt inne i den åpne skuffa:

```
--ka-region-surface på hodet    #f3f4f4
--ka-region-surface på skuffa   #f3f4f4   (arvet, dialogen ligger inne i <nav>)
skuffas egen bakgrunn           rgb(255, 255, 255)
```

Hodet er altså riktig i forhold til rada det hører hjemme på, og feil i forhold
til boksen det står i. Det gjelder begge skuffene og begge modusene.

## 2. Leservinduet er like stort uansett hvor langt svaret er

**Alle tre breddene, verst på 1280 × 720.** `blikk4/01-traad-1280-light.png`
**Eier: #5 og #3.** **Bør — og det er runde 3 sitt funn 8.**

Svaret i `nkom-maaloppnaaelse` er 1233 px høyt. Slik mye av det er synlig om
gangen, målt fra svarets overkant til skrivefeltets:

| Vindu      | Leservindu | Andel av svaret |
| ---------- | ---------- | --------------- |
| 1440 × 900 | 286 px     | 23 %            |
| 1024 × 768 | 154 px     | 12 %            |
| 1280 × 720 | **106 px** | **8,6 %**       |

106 px er tre linjer. Over vinduet står tittelen, spørsmålet og
tenkepanelet (337 px til sammen, likt i alle tre), under står skrivefeltet
klistret til bunnen.

Den andre halvdelen av det samme: når svaret er **kort**, står den samme
plassen tom. På feilskjermen og på den stoppede turen slutter kortet på
y = 275 og skrivefeltet begynner på y = 655 — 380 px tomt midt i kolonnen
(`blikk4/04-feilsti-1440-light.png`). Kolonnen fordeler altså plassen likt
enten det er tre linjer eller 1233 px som skal vises.

Dette er ikke en regresjon fra i dag; det er den eneste av runde 3 sine funn
som er blitt mer synlig, fordi 1024 nå er en bredde appen inviterer til.

## 3. Feilstien mister tenkepanelet i det feilen lander

**1440 × 900, lys og mørk.** `blikk4/04-feilsti-1440-light.png`
**Eier: #3.** **Kan.**

Still «simuler feil». Mens det står på, viser tenkepanelet «Tenker …» og «Jeg
søker i korpuset» — riktig steg for dette spørsmålet, som er #81 sin fiks og
lukkingen av runde 3 sitt funn 4. Men i det feilkortet kommer, er panelet
borte: skjermen har spørsmålet øverst, feilkortet under, og ingenting som sier
hva som ble forsøkt.

Et vellykket svar beholder sitt: «Tenkte i 4 sekunder» blir stående over
svaret. Feilstien er den eneste som rydder bort sporet sitt, og det er den
stien der leseren har mest bruk for å se hva som skjedde.

## 4. Chipsene står over et felt som fortsatt inviterer til søk

**1440 × 900, begge moduser.** `blikk4/06-chips-1440-light.png`
**Eier: #2.** **Kan.**

Velg «Årsrapport» og «Tildelingsbrev» i Dokumenttyper. Chipsene legger seg i
en egen rad **over** feltet, feltet står igjen tomt med plassholderen «Søk i
dokumenttyper», og under kommer «2 av 5 valgt». Tre rader der to av dem sier
det samme, og den tomme boksen i midten ser ut som noe som ikke er tatt i bruk.

Chip-navnet i seg selv er riktig, og bedre enn før denne bølgen: hver chip
heter nå «Årsrapport, Trykk for å fjerne fra dokumenttyper» i
tilgjengelighetstreet (#91). Dette er bare om hvordan de tre radene leses
visuelt. «Tøm» dukker opp ved siden av «Velg alle» først når noe er valgt, og
det er riktig.

## 5. Samme tittel deles med bindestrek i ett panel og på mellomrom i et annet

**1440 × 900, begge sidekolonner åpne.** `blikk4/03-begge-apne-1440-light.png`
**Eier: #4.** **Kan.**

«Årsrapport Nasjonal kommunikasjonsmyndighet 2025» står to steder på skjermen
samtidig. I navigasjonspanelet brytes den på mellomrom. I kildepanelets kort
brytes den med bindestrek, midt i ordet: «Årsrapport Nasjonal kom-
munikasjonsmyndighet 2025».

Orddelingen er ikke gal norsk, og kildepanelet er smalere, så den har en grunn.
Men to ulike behandlinger av samme streng, synlige samtidig, leser som en
inkonsekvens før den leser som en tilpasning.

## Det som er blitt bedre siden runde 3

Alle ni målt på nytt.

| Runde 3                                           | Nå                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **1.** Søkestripa havner under skrivefeltet       | **Lukket** (#82). Stripa står i view-hodet på y = 0, skrivefeltet på y = 623           |
| **2.** Ingen kolonne kan dras på 1440             | **Lukket** (#93). Null skiller og null knapper i den tilstanden — ingen døde glyfer    |
| **3.** Tabellen ser fokusert ut hele tiden        | **Lukket** (#82). `outline: none` uten fokus                                           |
| **4.** Tenkepanelet viser steg fra annet spørsmål | **Lukket** (#81) mens det står på. Se funn 3 om hva som skjer etterpå                  |
| **5.** Ny tråd er rå spørsmålstekst               | **Lukket** (#80). Alle radene har `-webkit-line-clamp: 2`, høyeste rad 54 px           |
| **6.** Stoppet tur mister tenkepanelet ved reload | **Ikke målt rent.** Avbruddet mitt landet før svaret begynte, som er et annet tilfelle |
| **7.** Filterhodet holder 179 px                  | **Står igjen.** Fortsatt 179 px, dokket og i skuffa                                    |
| **8.** På 1280 × 720 leser du gjennom fire linjer | **Står igjen, og er målt skarpere.** Se funn 2                                         |
| **9.** Utdrag uten nummer mellom to med           | **Ikke nåbar i mocken.** Alle fem utdragene er nummererte                              |

Og dagens fire, sett med brukerens øyne:

- **Skuffene (#97) virker.** Null vannrett rulling på 1024 og 720, skuffa
  dekker svaret, bakgrunnen er dimmet — også railen på motsatt side, som jeg
  sjekket med `elementFromPoint` fordi den så uberørt ut på skjermbildet: det
  var skjermbildet som lurte meg, ikke appen. Escape gir fokus tilbake til
  railknappen.
- **Breddekontrollene (#93).** Panelhodene er rene i den tilstanden der de før
  sto fire døde knapper. Merk at de forsvinner fra navigasjonspanelets hode når
  du åpner kildepanelet — altså fra et panel du ikke rørte. Det er avgjørelsen
  (Lars 17.09, 9c), ikke en feil, men det er verdt å vite at det ser sånn ut.
- **Chip-navn (#91) og lenkenavn (#92)** endrer ingenting synlig, som er
  poenget med begge. Den synlige flata er den samme, målt i anmeldelsene.

## Til dirigenten

Rangert neste-liste, billigst og viktigst først:

1. **Funn 1** — én regel: la hodet inne i en skuff ta skuffas flate i stedet
   for railens. Minutter hos #5, og det er den eneste av dagens fem som er et
   synlig brudd i det som nettopp ble bygget.
2. **Funn 2** — den er ikke liten, og den er nå den eldste åpne saken i
   brukerblikket. Den bør ses som ett spørsmål av #5 og #3 sammen: hva skal
   svarkolonnen gjøre med plassen når svaret er kort, og hva skal den gjøre
   når det er langt. To runder har beskrevet den; en avgjørelse mangler.
3. **Funn 3** — behold tenkepanelet på feilstien, samme sted som det står på et
   vellykket svar. Lite, hos #3.
4. **Funn 7 fra runde 3** — filterhodet på 179 px står fortsatt, og i skuffa
   spiser det 179 av 768. Det er samme høydebudsjett som funn 2, i et annet
   panel.
5. **Funn 4 og 5** — begge er små og begge er eierens valg. De trenger ingen
   runde av seg selv.

Og én ting som ikke er et funn: **runde 3 sitt funn 6 er fortsatt umålt.** Jeg
fikk avbrutt for tidlig til å treffe tilfellet. Den bør måles med et avbrudd
midt i et svar før noen krysser den ut.
