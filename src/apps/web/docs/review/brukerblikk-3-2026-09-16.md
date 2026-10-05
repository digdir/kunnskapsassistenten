# Brukerblikk runde 3: hva ser rart ut etter nattbølgen 15.–16.09

2026-09-16, anmelderen (KA CC). `main` = `043da26`, mock-modus, bygget app på
`vite preview` 5184, **1440 × 900 og 1280 × 720, lys og mørk**. (#78 er merget
etterpå og rører bare `tests/` og denne mappa, så alt under gjelder også
`bf0b548`.)

Runde 2 så på bølgen 15.09. Denne runden ser på det som kom i natt: skallets
sticky view-hode (#74), tidsstempel på svaret (#71), målt tenketid (#72),
trådlista som oppdaterer seg live (#69), den stoppede turen som overlever en
oppfriskning (#76), ekte Kudos-lenker (#70/#75), søk i svaret (#60),
panelbredder (#50) og feilmeldinger per tilfelle (#49).

**Alt under er grønt.** E2E-suiten er 128/128 på `main` (2,0 min, port 4173,
`CI=true`), og `docs/review/tools/a11y.sh` gir 0 axe-brudd på `/` i både lys og
mørk. Ingenting her er en regresjon i noe som ble målt. Det er ting som ser
rart ut for en som bruker appen.

Skjermbilder i `design/skjermbilder-frontend/blikk3/`.

## Sammendrag

| Eier                | Funn       |
| ------------------- | ---------- |
| #3 hovedkolonne     | 1, 6, 8    |
| #5 skall og layout  | 2, 3, 4, 8 |
| #2 navigasjonspanel | 5, 7       |
| #4 kildepanel       | 9          |

**Funn 1 er den eneste som gjør en ferdig funksjon ubrukelig.** Funn 2 er den
eneste som er en avgjørelse og ikke en feil.

---

## 1. Søkestripa i svaret havner under skrivefeltet

**1440 × 900, lys og mørk.** `blikk3/03-funn1-sokestripa-under-skrivefeltet-1440-light.png`
**Eier: #3.** **Rett nå.**

Trykk «Søk i svaret», skriv `Digdir`, trykk «Neste treff». Treffet blir
markert og rullet fram — det virker. Men det du styrer det med, er borte:

```
skrivefeltets overkant            y = 610
søkefeltet i svaret               y = 685–727
telleren «2 av 2 treff»           y = 694–718
document.elementFromPoint(midt i feltet)  → DIV.ka-composer__buttons
```

Stripa ligger nederst i svarkortet, kortet ruller, og skrivefeltet er
klebrig og ugjennomsiktig. Så leseren skriver i et felt hen ikke ser, og
telleren som er hele poenget med å ha en teller står bak knapperaden i
skrivefeltet. Rett etter at søket åpnes står stripa på y = 549 og er synlig;
det er første «Neste treff» som skyver den under.

Dette er akkurat tilfellet `rolle-5j` punkt 4 beskrev. #5 laget view-hode-plassen
i `main` som skulle løse det (#74) og skrev at #3 flytter stripa etterpå.
Plassen er der; stripa har ikke flyttet inn i den ennå.

## 2. På 1440 × 900 kan ingen kolonne dras

**1440 × 900, lys og mørk.** `blikk3/04-funn2-ingenting-kan-dras-1440-light.png`
**Eier: #5.** **Avgjørelse, ikke feil.**

Med begge sidekolonnene åpne på 1440:

```
[role=separator] «Endre bredde på tråder og filter»  now=400 min=400 max=400  tabindex=-1
[role=separator] «Endre bredde på kilder»            now=336 min=336 max=336  tabindex=-1
alle fire breddeknappene                             aria-disabled="true"
```

Fire knapper med piler står i panelhodene og gjør ingenting. Skillene kan
ikke dras og ikke nås med Tab. Målt over fire bredder:

| Vindu      | nav | hoved | kilder | Hva kan endres                    |
| ---------- | --- | ----- | ------ | --------------------------------- |
| 1280 × 720 | 67  | 749   | 432    | kilder 336–541                    |
| **1440**   | 400 | 640   | 336    | **ingenting**                     |
| 1536       | 400 | 640   | 432    | kilder kan bare bli smalere       |
| 1920       | 400 | 800   | 432    | alt, men nav kan bare bli bredere |

Grunnen står i koden og er riktig: `viewModel.ts` regner 1440 = 400 + 32 + 640

- 32 + 336, altså nøyaktig summen av de tre gulvene. Under det holder regel B
  én sidekolonne åpen om gangen. Så på designets egen referansebredde er hver
  kolonne på sitt minimum samtidig, og #50 kan per definisjon ikke gjøre noe.
  «Gjør tråder og filter smalere» er dessuten avslått i alle fire bredder, fordi
  navigasjonspanelets gulv og standardbredde begge er 400.

To ting å ta stilling til, ingen av dem en kodefeil: om fire varig avslåtte
knapper skal tegnes på den bredden alle Figma-rammene er tegnet i, og om
navigasjonspanelet skal kunne bli smalere enn 400 slik at brukeren kan gi
plassen til svaret. Visjonen kaller det å endre kolonnestørrelse essensielt
(brukerreise 24); på 1440 finnes det ikke.

## 3. Tabellen i svaret ser fokusert ut hele tiden

**1440, begge moduser, verst i mørk.** `blikk3/05-funn3-tabell-med-fokusring-1440-dark.png`
**Eier: #5** (`src/components/Markdown.tsx:270`). **Rett nå.**

Svaret om Digdir har en tabell. Rundt den står en 3 px ring i
`--ds-color-neutral-border-strong`, hele tiden:

```
getComputedStyle(.markdown__table).outline   →  rgb(31, 44, 61) solid 3px
.matches(':focus-visible')                   →  false
document.activeElement                       →  BUTTON «Skjul kilder»
```

Klassen er `ds-focus--visible`. Kommentaren over sier at den «gives it
Designsystemet's own focus ring» — men det er den påtvungne varianten.
Repoets egen kommentar i `src/views/filters/DocumentsList.tsx:133` sier det
rett ut: «NOT `ds-focus--visible`, which is the forced-on variant and paints a
ring around the list at rest.» Samme felle, motsatt konklusjon, to filer fra
hverandre.

Rettelsen er ett ord: `ds-focus`. Boksen beholder `tabIndex={0}` og får ringen
når den faktisk har fokus.

## 4. Tenkepanelet på en feil viser et steg fra et helt annet spørsmål

**1440, begge moduser.** `blikk3/06-funn4-tenkesteg-fra-annet-sporsmal-1440-light.png`
**Eier: #5** (`src/api/mock/MockChatClient.ts:242` og `:257`). **Rett nå.**

Spør «simuler ingen treff», åpne «Tenkte». Innholdet er:

> Jeg deler spørsmålet i to: hvordan måloppnåelse gjøres opp, og hvor målene
> er satt.

Det er `nkomThinkingSteps[0]` — første steg i NKOM-fixturen. Alle seks
feilkodene og avklaringen sender det samme steget, uansett hva som ble spurt
om. En som ser på feilskjermene leser en setning om et spørsmål som aldri ble
stilt.

Bare mock, så det når ikke live. Men feilskjermene er nettopp det designere og
Lars ser på for å vurdere feiltekstene, og dette står midt i dem.

Samme sted: på disse turene heter panelet bare «Tenkte», uten tid, mens et
vanlig svar sier «Tenkte i 2 sekunder». Tida kommer i `done`-ramma, og en feil
sender ingen. Det er forklarlig, men den samme kontrollen sier altså to
forskjellige ting avhengig av hvordan turen endte.

## 5. Tråden du nettopp laget er den eneste raden som er rå spørsmålstekst

**1440 × 900, begge moduser.** `blikk3/07-funn5-ny-traadrad-1440-light.png`
**Eier: #2.** **Rett senere.**

Trådlista oppdaterer seg nå live — raden kommer øverst under «I dag» med
`aria-current="page"`, uten å bytte visning. Det virker, og det var hele
poenget med #69.

Men raden får hele spørsmålet som tittel:

```
ny rad      «Hva rapporteres om regnskap, kostnader og bevilgning i DSS
             sine årsrapporter for 2022 og 2023?»        78 px, 3 linjer
raden under «Regnskap og bevilgning i DSS sine årsrapporter»  54 px, 2 linjer
neste       «NKOM måloppnåelse»                           30 px, 1 linje
```

Den nye raden er to og en halv gang så høy som nabolinja, og raden rett under
er den samme saken med en kort tittel fra fixturen. Lista viser altså samme
emne to ganger, én gang som overskrift og én gang som råtekst. Det endrer seg
ikke av en oppfriskning — tittelen blir stående.

Mocken lager ingen tittel, og backend gjør det trolig heller ikke ennå. Til
den gjør det, er en avkorting på to linjer det lista trenger.

## 6. En stoppet tur mister tenkepanelet når du laster på nytt

**1440 × 900.** `blikk3/08-funn6-stoppet-tur-for-reload-1440-light.png` og `09-…-etter-reload-…`
**Eier: #3.**

```
FØR reload     «Tenkte i 6 sekunder»  ·  «Du stoppet søket før svaret begynte.»  ·  «Generer på nytt»
ETTER reload                             «Du stoppet søket før svaret begynte.»  ·  «Generer på nytt»
```

Turen overlever oppfriskningen, som er det #76 lovte, og tidsstemplet er det
samme. Men tenkepanelet er borte. Leseren som stoppet fordi det tok for lang
tid, mister akkurat den delen som sa hvor lenge og hvor langt det kom.

Slektning av runde 2 punkt 5, som er lukket: der viste den samme turen to
ulike tall før og etter. Nå viser den ett tall før og ingenting etter.

## 7. Filterhodet holder 179 px som aldri endrer seg

**1440 × 900 og 1280 × 720.** `blikk3/12-view-hodet-blir-staende-1440-dark.png`
**Eier: #2, og #5 for hva plassen skal romme.** **Kan.**

Sticky view-hode virker: «← Tråder», «Filtrering» og korpuslinja blir stående
mens dokumentlista og fasettene ruller under, i begge moduser, og
«Tråder»-knappen er fortsatt klikkbar med fokusring. Målet fra `rolle-5j` er
nådd — med et svar på skjermen er **2 av 3 fasettfelt helt synlige på 1440 × 900**
(mot 0–1 før).

Prisen er målt:

| Vindu      | rullende flate | view-hodet | andel    | fasettfelt synlige |
| ---------- | -------------- | ---------- | -------- | ------------------ |
| 1440 × 900 | 778 px         | 179 px     | 23 %     | 2 av 3             |
| 1280 × 720 | 598 px         | 179 px     | **30 %** | 1 av 3             |

Mesteparten av de 179 er korpuslinja, som er fire linjer tekst og aldri
endrer seg: «Dokumenter fra Kudos: 938 dokumenter, årsrapporter,
strategi/plan, tildelingsbrev, statusrapporter og evalueringer, 2020–2027».
På den minste skjermen er altså nesten en tredel av panelet permanent bundet
opp av en setning som er lest én gang.

## 8. På 1280 × 720 leser du svaret gjennom fire linjer

**1280 × 720, lys og mørk.** `blikk3/10-funn7-og-8-1280x720-dark.png`
**Eier: #3, og #5 for høydebudsjettet.** **Kan.**

```
skrivefeltets overkant      y = 430 av 720
skrivefelt + forslagschips + ansvarsfraskrivelse   ≈ 290 px  (40 % av vinduet)
svarteksten som vises       ≈ 215 px  ≈ fire linjer
```

Spørsmålet tar to linjer øverst, tenkepanelet én, og så er det fire linjer
igjen til selve svaret før skrivefeltet begynner. Til sammenligning har
1440 × 900 610 px over skrivefeltet. Ingen av delene er feil hver for seg;
summen er at den vanligste lille laptop-en leser et langt svar gjennom en
sprekk.

## 9. Et utdrag uten nummer står mellom to som har det

**1440.** `blikk3/20-utdrag-uten-nummer-1440-light.png`
**Eier: #4.** **Trolig bevisst, la stå.**

Kortet for tildelingsbrevet sier «3 utdrag», snarveien over sier «Utdrag 1–2»,
og det tredje kortet heter bare «Utdrag», uten tall. Grunnen står rett under —
«Ikke vist til i svaret» — og er riktig: nummeret er markørens nummer, og det
utdraget har ingen markør. Skrevet ned fordi jeg måtte lese to ganger, ikke
fordi jeg tror det er galt.

---

## Det som er blitt bedre siden runde 2

Alle sju punktene fra runde 2 er målt på nytt. **Fem er lukket, to er borte
fra bildet:**

- **Punkt 1 er lukket.** En gjenopprettet samtale har kildene sine. Målt: før
  og etter reload er kildepanelet tegn for tegn identisk — samme to
  dokumentkort, samme «Utdrag 1–2»/«Utdrag 3–4», samme åtte lenker. Dette var
  runde 2s eneste funn som tok noe fra leseren.
- **Punkt 2 er lukket.** «Siden finnes ikke» er nå en `h2` på **36 px**, mot
  18 px i runde 2 — større enn alt i sidepanelene, som det skal være når det
  er hele sidas sak. Samme for «Fant ikke tråden».
  `blikk3/19-siden-finnes-ikke-1440-light.png`
- **Punkt 3 er lukket.** «Kilder til svar 2 av 2» med Forrige/Neste og
  søkefeltet blir stående på `top = 90` mens panelet ruller (`scrollTop` 0 →
  144). `blikk3/11-svarvelgeren-blir-staende-1440-light.png`
- **Punkt 4 er lukket.** Dokumentlista i filterpanelet ligger ikke lenger
  under skjermkanten: første dokumentrad er på **y = 352** og begge radene er
  helt synlige — på 1280 × 720 like mye som på 1440 × 900. I runde 2 startet
  første rad på y = 818 i et 900 px vindu.
- **Punkt 5 er lukket.** Samme svar sier nå samme tenketid før og etter en
  oppfriskning (målt: 7 og 7). Tallet er veggklokke og varierer med last —
  samme spørsmål ga 2 sekunder på en rolig maskin og 8 under e2e-last — men
  det er ett tall som følger turen, som var poenget med #72.
- **Punkt 6 er ordnet.** Ansvarsfraskrivelsen kommer først, snarveien etter:
  «Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon. ·
  Trykk Cmd + / for å hoppe hit». Linja brekker fortsatt på 1440 og lar
  «hoppe hit» stå alene på linje to.
- **Punkt 7 er lukket.** Et «ingen treff»-svar slutter nå på «Prøv å stille
  spørsmålet med andre ord …» og har ingen «Er det noe mer jeg kan hjelpe deg
  med?» etter seg.

Og det som er nytt og virker, målt:

- **Tidsstempel på svaret (#71).** `<time datetime="2026-09-15T23:46:57.331Z"
title="16. september 2026 kl. 01:46">01:46</time>`, med skjult
  «Svaret kom 16. september 2026 kl. 01:46». Bit for bit identisk etter reload.
- **Trådlista live (#69).** Raden kommer øverst under «I dag» med
  `aria-current="page"` uten at man bytter visning. Se funn 5 for tittelen.
- **Kudos-lenkene (#70/#75).** Alle peker på `https://kudos.dfo.no/dokument/<uuid>`
  uten `#page=N` — løftet om en bestemt side er tatt bort der adressen ikke
  kunne holde det. Lenketeksten er «Les dokumentet på Kudos» med skjult
  «(åpnes i ny fane)». Én synlig lenke per dokument; de andre treffene på
  `a[href*=kudos]` ligger i lukkede `Details` og er usynlige for både øye og
  Tab.
- **Feilmeldinger per tilfelle (#49).** Seks koder, seks ulike overskrifter og
  to setninger hver; «Prøv igjen» på de forbigående, ingen knapp på «Ingen
  tilgang». `blikk3/13-…` til `18-…`. Kildepanelet ved ingen treff sier «Ingen
  kilder til dette svaret · Svaret viser ikke til noen utdrag fra dokumentene»
  — ikke «Henter kilder …».
- **Stoppet tur (#76).** Overlever oppfriskning med tekst, tidsstempel og
  «Generer på nytt». Se funn 6 for det som mangler.

### Sjekket, og det er riktig

To ting så feil ut i nettleseren og viste seg å være avgjort:

- **Kildepanelet har ingen egen flate mens det er åpent** — hvert punkt i det
  måler skallets bakgrunn (#f3f4f4 lys, #192029 mørk), mens
  navigasjonspanelet måler sin egen (#ffffff / #202834). Det er Lars sin
  avgjørelse 15.09, skrevet i `global.css`: kildene hører til svaret og deler
  grunn med det. Kollapset får den samme kolonnen flate igjen, som er den
  andre halvdelen av samme avgjørelse.
- **Skillene som forsvinner ut av tab-rekkefølgen når de ikke kan gjøre noe**
  er dirigentvalget fra 2026-09-15 (`visjon-og-beslutninger.md`), ikke et
  hull. Funn 2 handler om at knappene ved siden av dem ikke gjør det samme.

## Til dirigenten

Rangert neste-liste, billigst og viktigst først:

1. **Funn 3** — ett ord i `Markdown.tsx` (`ds-focus--visible` → `ds-focus`).
   Minutter, og det er det eneste i appen som tegner en fokusring uten fokus.
2. **Funn 1** — flytt søkestripa inn i view-hode-plassen #74 laget. Det er
   den planlagte oppfølgingen etter #74, og til den er gjort er #60 en
   funksjon man ikke kan styre på 1440. Hører hjemme hos #3.
3. **Funn 4** — gi feil- og avklaringsstien sitt eget tenkesteg i mocken.
   Lite, og det rydder feilskjermene før noen ser på tekstene.
4. **Funn 6** — behold tenkepanelet på en stoppet tur etter reload. Samme
   lagringssti som #76 nettopp rørte.
5. **Funn 5** — avkort trådtittelen til to linjer til noen lager titler.
6. **Funn 2** — din og Lars sin avgjørelse, ikke en oppgave: skal fire varig
   avslåtte knapper stå på 1440, og skal navigasjonspanelet kunne bli
   smalere enn 400? Begge deler endrer hva #50 er verdt på den bredden
   designet er tegnet i.
7. **Funn 7 og 8** — begge er høydebudsjett, ett i sidepanelet og ett i
   midten. De bør ses sammen, og helst av #5 og eierne i samme runde, ikke
   hver for seg.

Funn 9 trenger ingenting.
