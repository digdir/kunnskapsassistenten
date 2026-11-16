# Brukerblikk runde 5: hva ser rart ut etter dagens fire

2026-09-22, anmelderen (KA CC). `main` = `da305db`, dev-server på 5177,
**1440 × 900, 1280 × 720 og 1024 × 768, lys og mørk**, mock — og et eget
live-oppsett på samme port med begge korpus for korpusvelgeren.

Dagens fire: korpusvelgeren (#106), rulling i hele midtfeltet (#107),
sr-only-fiksen (#105) og feilturen (#108). Pluss det som sto igjen fra runde 4.

**Alt under er grønt.** E2E er 143/143 på `main` og axe ga 0 brudd i alle
tilstandene jeg målte i anmeldelsene av de fire. Ingenting her er en regresjon.
Det er ting som ser rart ut for en som bruker appen.

Skjermbilder i `design/skjermbilder-frontend/blikk5/`.

## Sammendrag

| Eier                | Funn |
| ------------------- | ---- |
| #2 navigasjonspanel | 1, 4 |
| #3 hovedkolonne     | 2    |
| #5 skall og layout  | 3    |
| #4 kildepanel       | 5    |

**Funn 1 og 2 er det samme funnet i to hus:** korpusvalget når linja og wire,
men ikke resten av skjermen.

---

## 1. «Fra Kudos» står igjen under en linje som sier Wikipedia

**Live, 1440 × 900, begge moduser.** `blikk5/06-korpusvelger-1440-light.png`
**Eier: #2.** **Bør.**

Velg Wikipedia (NorQuAD) i korpusvelgeren. Fire linjer under står det fortsatt:

```
Korpus            [ Wikipedia (NorQuAD) ▾ ]
                  Dokumenter fra Wikipedia (NorQuAD): 351 artikler

Dokumenter
Fra Kudos
                  Dokumentene som er relevante for søket ditt vises her.
```

Overskriften er hardkodet i `DocumentsList.tsx:102`. Det er nøyaktig samme
påstand #106 ble skrevet for å fjerne — «Kudos» over et korpus som ikke er
Kudos — ett element lenger ned i det samme panelet.

Den er ikke synlig i mock, der det bare finnes ett korpus. Den er synlig i den
ene modusen der valget betyr noe.

## 2. Forslagene er Kudos-spørsmål uansett hvilket korpus som er valgt

**Live, 1440 × 900.** `blikk5/06-korpusvelger-1440-light.png`
**Eier: #3.** **Bør.**

På samme skjerm, i midten, med Wikipedia valgt:

- «Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter …»
- «Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialordningen?»
- «Hva rapporterer Digdir om prioriteringene i tildelingsbrevene …»

Tre spørsmål om norske etatsdokumenter, tilbudt som inngang til et korpus med
351 Wikipedia-artikler. `KICKSTARTERS` i `src/views/chat/text.ts` er en fast
liste.

En førstegangsbruker som trykker på et av dem får et tomt eller rart svar, og
det er den ene handlingen skjermen inviterer til.

## 3. Hjulmargen finnes bare når det er slakk

**Alle tre breddene.** `blikk5/01-traad-1440-light.png` mot `-1280-`.
**Eier: #5.** **Kan — og det er mest en opplysning.**

#107 gjorde at hjulet virker i det grå feltet ved siden av lesebredden. Målt
hvor stort det feltet er:

| Tilstand                   | `main` | Lesebredde | Marg per side |
| -------------------------- | ------ | ---------- | ------------- |
| 1440, kildepanel kollapset | 941    | 800        | **71 px**     |
| 1024, begge railer         | 890    | 800        | **45 px**     |
| 1280, kildepanel kollapset | 781    | 781        | **0**         |
| 1440, begge paneler åpne   | 640    | 640        | **0**         |

Margen er det som blir til overs, så den forsvinner så snart feltet er
smalere enn taket på 800. Demoen som utløste arbeidet var på 1920, der margen
er 311 px per side. På 1280 — som er den smaleste bredden layout-garantien
dekker — finnes den ikke.

Ingenting er galt. Men «hjulet virker overalt i midten» er sant på noen
bredder og tomt på andre, og det er verdt å vite før noen lover det videre.

## 4. Chipsene står fortsatt over et felt som ser ubrukt ut

**1440 × 900.** `blikk5/04-chips-1440-light.png` **Eier: #2.** **Kan.**
Runde 4 funn 4, umiddelbart gjenkjennelig:

```
Dokumenttyper            Velg alle   Tøm
[ Årsrapport ✕ ]
[ Søk i dokumenttyper            ▾ ]
1 av 5 valgt
```

Tre rader der to sier det samme, og den tomme boksen i midten leser som noe
som ikke er tatt i bruk. Uendret siden runde 4.

## 5. Samme tittel deles med bindestrek i kildekortet

**1440 × 900, begge sidekolonner åpne.** `blikk5/05-kilder-1440-light.png`
**Eier: #4.** **Kan.** Runde 4 funn 5, uendret — og nå er den lettere å se,
fordi den samme tittelen står **tre** steder på skjermen samtidig:

- navigasjonspanelet: «Årsrapport Nasjonal kommunikasjonsmyndighet 2025», brutt på mellomrom
- «Snarveier til dokumentene»: det samme, brutt på mellomrom
- kildekortet: «Årsrapport Nasjonal kom-munikasjonsmyndighet 2025»

To av tre bryter likt, den tredje deler ordet.

## Det som er blitt bedre siden runde 4

- **Funn 1 er lukket** (#102). Skuffhodet deler flate med skuffa i alle åtte
  kombinasjonene jeg målte.
- **Funn 3 er lukket** (#108). Tenkepanelet står på feilstien både live og
  etter omlasting — og feilturen overlever i det hele tatt, noe den ikke gjorde
  før. Det tomme feltet midt i feilskjermen, som runde 4 målte til ~380 px, er
  nå **138 px**, fordi panelet fyller plassen over kortet.
- **Runde 3 funn 6 er strøket** (målt 21.09): en tur avbrutt midt i svaret
  beholder tenkepanelet over en omlasting. Det var min egen for tidlige
  måling som holdt den åpen.
- **Ingen dokumentrulling og ingen vannrett rulling** i noen av de seks
  kombinasjonene av bredde og modus. #105 holder etter at #107 flyttet
  rulleregionen.

## Det som står igjen

**Runde 4 funn 2, leservinduet**, er fortsatt den eldste åpne saken:

| Vindu      | Runde 4 | Nå         | Av et svar på 1233 px |
| ---------- | ------- | ---------- | --------------------- |
| 1440 × 900 | 286 px  | 318 px     | 26 %                  |
| 1024 × 768 | 154 px  | 186 px     | 15 %                  |
| 1280 × 720 | 106 px  | **138 px** | **11 %**              |

32 px bedre overalt, som er `padding-block` som flyttet i #107. Svaret er
fortsatt klippet av et ugjennomsiktig skrivefelt — ingen overgang, ingen
antydning om at det er mer under. Sammen med **runde 3 funn 7** (filterhodet
på 179 px) er dette ett spørsmål om høydebudsjett i to paneler, og det venter
fortsatt på en avgjørelse og ikke på mer måling.

## En felle i min egen måling, andre gang

Første gjennomgang av skjermbildet på 1440 så det ut som svaret nå **toner ut**
under skrivefeltet — en ekte forbedring, hadde den vært der. Den er det ikke:
`.ka-composer` er ugjennomsiktig, uten maske, uten `backdrop-filter`, og
svaret er hardt klippet som før. Det jeg så var en tekstlinje kuttet på midten,
som i nedskalert bilde leser som en uttoning.

Det er andre gangen på to runder at et skjermbilde nesten ble et funn — forrige
gang så skuffas bakdunkling ut til å slippe railen på motsatt side. Begge
ganger var det `elementFromPoint` og `getComputedStyle` som avgjorde. Den
hører i målefellene i `docs/review/README.md`, og jeg tar den der.

## Live, og hva jeg ikke fikk målt

Korpusvelgeren er sett i live med begge korpus: feltet heter «Korpus», begge
står i lista, og linja følger valget. **Men jeg brukte ingen av de to
live-spørsmålene**: nøkkelen jeg har lokalt (`E2E_API_KEY` fra compose-fila)
gir 401 på både `/api/mcp` og `/api/conversations`, så et spørsmål ville blitt
en feilskjerm og ikke en måling. At de to korpusene gir forskjellige svar er
fortsatt #5 sin måling fra #103, ikke min.

## Til dirigenten

Rangert, billigst og viktigst først:

1. **Funn 1** — én hardkodet overskrift i `DocumentsList.tsx:102`. Den hører
   sammen med #106 og er den siste «Kudos» som står igjen der et korpus kan
   velges.
2. **Funn 2** — forslagene. Større enn funn 1, fordi det er en handling og
   ikke en påstand: skjermen inviterer til tre spørsmål korpuset ikke kan
   svare på. Trenger en avgjørelse først — skal forslag følge korpus, eller
   skjules når korpuset ikke er det de er skrevet for?
3. **Runde 4 funn 2 og runde 3 funn 7** — høydebudsjettet, uendret sak, tredje
   runde på rad. Den trenger #5 og #3 i samme rom, ikke en fjerde beskrivelse.
4. **Funn 3, 4 og 5** — opplysning og to eierens-valg. Ingen av dem haster.
