# Brukerblikk: hva ser rart ut for en som åpner appen første gang

2026-09-15, anmelderen (KA CC). `main` = `0be1aa0`, mock-modus, bygget app på
`vite preview` 5177. Gjennomgått i **1280, 1440 og 1920**, **lys og mørk**, i
tilstandene brief-en lister: tom forside, begge sidekolonner kollapset, nav
åpen, begge åpne med svar, under strømming, feiltilstand, trådliste, filter
med valg, utdragssøk med treff.

Dette er en annen linse enn a11y og Figma-avvik. Alt her er **grønt** i axe og
i e2e-suiten; ingenting under er en regresjon. Det er ting som ser rart ut.

60 rå skjermbilder ligger i
`design/skjermbilder-frontend/blikk/raa/` med målinger i `maalinger.json`.
De 20 nummererte under er bevisene.

Kollapset-rail-saken Lars fant er utelatt, den ligger hos #5 (rolle-5d).

## Sammendrag

| Eier                | Funn                            |
| ------------------- | ------------------------------- |
| #2 navigasjonspanel | 3, 7, 8, 12, 13, 14, 16 — **7** |
| #3 hovedkolonne     | 5, 6, 9, 10, 17 — **5**         |
| #4 kildepanel       | 11, og halve 1 — **2**          |
| #5 skall og layout  | 1, 2, 4, 15 — **4**             |

**De fem verste:** 1, 2, 3, 4, 5.

---

## 1. Utdragsteksten er 174 px bred og brekker etter to ord

**1440, begge åpne, lys og mørk.** `blikk/01-utdragstekst-174px.png`
**Eier: #5 (panelbredden) og #4 (kortene inni).** **Rett nå.**

Kildepanelet er 336 px på 1440. Utdragets tekstkolonne er **174 px**, målt.
Ett kort avsnitt blir **30 linjer** à to–tre ord: «Nkom gjennomfører / årlige /
risikovurderinger på / virksomhetsnivå.» Hovedkolonnens tekst er 590 px ved
siden av.

162 px forsvinner i padding og kort inni kort: panelets 36 på hver side, så et
ytre utdragskort, så et indre med egen padding. Hvert lag er rimelig for seg.

Det er verdt å merke seg fordi layoutbeslutningen sier at 336 «er også gulvet
til `kilder`-organismen minus dens egen padding, så et utdragskort fortsatt
har rom til å leses». Målt stemmer ikke det. Tallet 336 er riktig for
_plassen_; det er kortene inni som ikke tåler den.

På 1536 og 1920 er panelet 432 og teksten 270 px, 18 linjer. Fortsatt smalt,
men lesbart. **Det er 1440 som er problemet, og 1440 er bredden alle
Figma-framene er tegnet i.**

## 2. «Skjul kilder» ruller ut av vinduet når man klikker en kildemarkør

**Alle bredder, begge moduser.** `blikk/02-skjul-kilder-rullet-bort.png`
**Eier: #5.** **Rett nå.**

Klikk på `[1]` i svaret. Kildepanelet åpner seg og ruller til utdraget — på
1440 ruller det **987 px**. Veksleknappen «Skjul kilder» ligger øverst i samme
rullende kolonne, så den havner på **y = −955**, altså en skjerm over toppen
av vinduet. Det gjør også overskriften «Kilder».

Resultatet er et panel uten tittel og uten synlig måte å lukke seg på.
Brukeren må rulle opp i panelet for å finne knappen igjen — og det er ikke
opplagt at det er der den er.

Samme mekanisme i navigasjonspanelet: innholdet er 991 px høyt i et
900 px vindu, så «Skjul tråder og filter» kan rulle bort der også.

Veksleknappen bør ligge fast (`position: sticky`) i toppen av plassen, eller
utenfor det som ruller.

## 3. Filteret sier «Alle valgt» både når alt er valgt og når ingenting er valgt

**Alle bredder, begge moduser.** `blikk/03-alle-valgt-uansett.png`
**Eier: #2.** **Rett nå.**

På en side ingen har rørt står det «Alle valgt» under alle tre fasettene. Det
står også «Alle valgt» etter at man har trykket «Velg alle» og fått seks
chips. De to tilstandene er **ordrett like**; det eneste som skiller dem er om
knappen ved siden av etiketten sier «Velg alle» eller «Tøm».

To ting følger av det:

- Brukeren kan ikke lese av om et filter er satt.
- «Velg alle» tilbyr en handling hvis resultat tilstanden allerede påstår. Man
  trykker den og teksten endrer seg ikke.

Tomt utvalg betyr «ingen begrensning», som er riktig logikk, men det er ikke
det samme som «alle valgt», og ordene bør skille dem. «Ingen filtrering» mot
«Alle 6 valgt», for eksempel.

## 4. Navigasjonspanelet har ingen flate i mørk modus

**Alle bredder, mørk.** `blikk/04-nav-uten-flate-mork.png`, sammenlign
`blikk/04b-nav-med-flate-lys.png` **Eier: #5.** **Rett nå.**

I lys modus er navigasjonspanelet en hvit flate mot grå side, tydelig som et
panel. I mørk modus er panelet `rgb(32, 40, 52)` og siden `rgb(25, 32, 41)`.
Det eneste som skiller dem er den 1 px kanten, som selv ligger på **1,84** mot
panelet.

Det er samme familie som det Lars fant kl. 02, men gjelder det **åpne**
panelet, ikke railen: en kolonne som ikke oppleves som en egen flate. Enten
mer forskjell på flatene i mørk, eller en kant som faktisk skiller.

## 5. Samme samtale ser ulik ut på forsida og på trådruta

**Alle bredder, begge moduser.** `blikk/05-forside-uten-tittel.png` og
`blikk/05b-traadrute-med-tittel.png` **Eier: #3, med #5 på ruting.**
**Rett nå.**

Stiller du spørsmålet på `/`, står spørsmålet ditt øverst som **liten tekst,
ikke en overskrift i det hele tatt** — første synlige overskrift i kolonnen er
svarets egen `h3` på 30 px. Ingen tittel.

Åpner du den samme tråden på `/threads/nkom-maaloppnaaelse`, står trådtittelen
«NKOM måloppnåelse» som `h2` på **36 px**, og spørsmålet under den.

Det er to forskjellige sider for det samme innholdet, og hvilken du får
avhenger av hvordan du kom dit. Dirigentens kandidat 3 beskriver
`/`-varianten, og den holder.

## 6. Svarkortet kuttes hardt under skrivefeltet

**Alle bredder, begge moduser.** `blikk/06-kortet-kuttet-under-skrivefeltet.png`
**Eier: #3.** **Rett senere.**

Kortets hvite flate slutter brått akkurat der skrivefeltet begynner, midt i en
setning og noen ganger rett under en overskrift. Det ruller riktig, men den
harde kanten leser som «kortet er avkuttet», ikke «det er mer lenger ned». En
uttoning eller litt luft under kortet ville sagt det andre.

## 7. Navigasjonspanelet er klippet nederst uten at noe sier fra

**1440 × 900 og smalere.** `blikk/07-nav-klippet-nederst.png`
**Eier: #2.** **Rett senere.**

Innholdet er 991 px i et 900 px vindu. «Last opp egne dokumenter» kuttes midt
i setningen «Opplasting er ikke klar ennå. Når den …», uten rullestripe eller
skygge. Det ser ut som en feil, ikke som noe man kan rulle til.

## 8. Trådtitlene ser ikke klikkbare ut

**Alle bredder.** `blikk/08-traadtitler-ser-ikke-klikkbare-ut.png`
**Eier: #2.** **Rett senere.**

«NKOM måloppnåelse», «Om Stimulab» og resten er mørk brødtekst uten
understrek, farge eller markør. «Ny tråd» rett over er en tydelig blå knapp,
så øyet leser lista som overskrifter. De er lenker.

## 9. «Prøv igjen» står to ganger i samme boks

**Alle bredder.** `blikk/09-prov-igjen-to-ganger.png` **Eier: #3.**
**Rett nå.**

Meldingen er «Svaret kom ikke fram. Noe gikk galt. Prøv igjen.» og under den
en knapp som heter «Prøv igjen». Setningen ber om det knappen gjør, én linje
unna. Kutt «Prøv igjen.» fra teksten.

## 10. Avbryt-knappen er et umerket kvadrat

**Alle bredder.** `blikk/10-avbryt-er-et-kvadrat.png` **Eier: #3.**
**Rett senere.**

Under strømming byttes papirflyet i skrivefeltet med et lite kvadrat. Det har
riktig `aria-label`, så skjermleseren er i orden, men for en som ser skjermen
er et kvadrat ikke opplagt «stopp». Teksten «Skriver svar …» står et annet
sted i kortet enn knappen som stopper det.

## 11. «Forrige» ser like aktiv ut på treff 1 av 8

**Alle bredder.** `blikk/11-forrige-ser-aktiv-ut-paa-treff-1.png`
**Eier: #4.** **Rett senere.**

«1 av 8 treff · Forrige · Neste». På første treff er «Forrige» samme blå som
«Neste». Enten deaktiver den, eller si at den går rundt.

## 12. To `h4` i samme panel har ulik størrelse

**Alle bredder.** `blikk/12-to-h4-ulik-storrelse.png` **Eier: #2.**
**Rett senere.**

Målt i navigasjonspanelet: «Dokumenter» `h3` 21 px, «Fra Kudos» `h4` 18 px,
«Dine dokumenter» `h4` **21 px**. To `h4` med ulik størrelse, og en `h4` like
stor som `h3`-en over. Nivåene og størrelsene sier forskjellige ting.

## 13. «Ny»-merke på noe som ikke er bygget

**Alle bredder.** `blikk/13-ny-merke-paa-ubygd.png` **Eier: #2.**
**Rett nå.**

«Dine dokumenter» har et blått «Ny»-merke. Rett under står «Opplasting er ikke
klar ennå. Når den kommer, tar den PDF og .docx.» Merket lover noe nytt å
prøve; boksen sier at det ikke går. (Merket er også usynlig for skjermleser,
`Badge` bruker `content: attr()` — det står i `funn-tverrgaaende.md`.)

## 14. Trådgruppene blander relative og absolutte navn

**Alle bredder.** `blikk/14-traadgrupper-blander-navn.png` **Eier: #2.**
**Rett senere.**

«I dag», «Siste 7 dager», «Siste 30 dager», så «Juli». Tre relative bøtter og
så et månedsnavn uten år. August mangler i mellom, og «Juli» er tvetydig så
snart appen har levd et år.

## 15. Kildepanelet har ingen egen flate

**Alle bredder, begge moduser.** `blikk/15-kildepanelet-uten-egen-flate.png`
**Eier: #5.** **Bevisst, la stå — men verdt å se.**

Navigasjonspanelet har en flate (`neutral-surface-default`), kildepanelet har
`transparent` og lar kortene flyte rett på sidebakgrunnen. Skallet er
asymmetrisk: én kolonne er et panel, den andre er løse kort. Det kan godt være
med vilje, men det er den samme grunnen til at det kollapsede panelet ikke
oppleves skjult.

## 16. Tre identiske «Søk»-felt uten å si hva man søker i

**Alle bredder.** `blikk/16-tre-umerkede-sokefelt.png` **Eier: #2.**
**Rett senere.**

Dokumenttyper, Virksomheter og År har hvert sitt felt med plassholderen
«Søk». Feltene har `<label>`, så navnet finnes for skjermleser, men visuelt er
de tre like. «Søk i dokumenttyper» ville kostet ingenting.

## 17. «Hei 👋» uten navn

**Alle bredder.** `blikk/17-hei-uten-navn.png` **Eier: #3.**
**Bevisst, la stå** — men noen bør bekrefte det.

Hilsenen er «Hei 👋 / Hva lurer du på?». Uten navn leser den som en mal der
navnet mangler. Appen kjenner brukeren i prod (Digdir-pålogging), så enten
sett navnet inn eller la hilsenen være noe som ikke ser ut som et tomt felt.

---

## Dirigentens kandidat 1: holder ikke

**Påstand:** hovedkolonnens innhold ser ikke sentrert ut på 1920 når plassen
er bredere enn 800; kortet starter ~x580 med ~210 px tomt til høyre.

**Målt** (`blikk/18-sentrering-1920-maalt.png`), 1920, nav åpen, kilder
kollapset:

|                                                  |                     |
| ------------------------------------------------ | ------------------- |
| `.main`                                          | x = 661, bredde 800 |
| bredeste innhold (`.ka-chat`)                    | 728 px              |
| luft i `.main`, venstre / høyre                  | **36 / 36**         |
| fra navigasjonspanelets kant (400) til innholdet | 297                 |
| fra innholdet til kildepanelets rail (1722)      | 297                 |

Innholdet er sentrert i plassen, og plassen er sentrert mellom sidekolonnene,
på pikselen. `margin-inline: auto` gjør jobben.

**Det øyet reagerer på er noe annet:** til venstre står en fylt hvit flate
(navigasjonspanelet), til høyre 198 px tom grunn med en knapp i. Tyngden er
skjev selv om geometrien ikke er. Det er funn 15 og railen hos #5, ikke en
sentreringsfeil.

Kandidat 2 og 3 holder, og står som funn 3 og 5.

## Til dirigenten

- **Funn 1 er det som haster mest**, og det er ikke #4 sitt alene: 336 px er
  riktig for plassen, men ingen har regnet på hva som er igjen til teksten
  etter to lag kort. Enten smalere padding i kortene, eller et høyere gulv for
  panelet, og det siste rører layoutbeslutningen igjen.
- **Funn 2 og 4 er skall-saker** og hører sammen med rolle-5d, som allerede
  ligger hos #5.
- **Funn 3 og 5** er de to en bruker vil snuble i først, og begge er små
  endringer.
- Ingenting her er fanget av verken axe eller e2e-suiten, og det er verdt å
  merke seg: alle 17 er ting som ser feil ut, ikke ting som er feil målt mot
  en spesifikasjon. Flere av dem har ingen fasit i `design/omraader/` å bryte
  med.
