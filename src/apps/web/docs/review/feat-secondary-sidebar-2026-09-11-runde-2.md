# Etterrevisjon: `feat/secondary-sidebar` (PR #2), runde 2, 2026-09-11

Anmeldt commit `3bd6718` («Merge remote-tracking branch 'origin/main'»), som er
PR-hodet nå. Forrige runde anmeldte `5040004`, se
[`feat-secondary-sidebar-2026-09-11.md`](feat-secondary-sidebar-2026-09-11.md).
Rettelsene ligger i `f15824f` «Kildepanel: skill rulling fra fokus, og ta i
bruk grunnmuren».

**Konklusjon: klar. Alle tre blokkerende er rettet og verifisert i nettleser.**
To bør står igjen, begge på én linje hver, og begge bør med før merge.
Ingenting blokkerer.

## Portene

| Port                    | Resultat                   |
| ----------------------- | -------------------------- |
| `npm run build`         | grønt                      |
| `npm run lint`          | grønt, null funn           |
| `npm run format:check`  | grønt                      |
| `npm run test`          | grønt, 68 tester i 9 filer |
| `npm run tokens:verify` | grønt                      |

## Slik er det målt

Denne gangen er hele stabelen montert, ikke bare forhåndsvisningsflata:
`SourcesView` i `viewComponents.ts` med fixturene, og `ChatView` fra
`feat/chat` i `src/routes/Thread.tsx`, begge som **lokale, ucommittede**
endringer i arbeidstreet. Det er den eneste måten å prøve `[n]`-koblingen
ende til ende på, siden markørene bor i den ene PR-en og målet i den andre.
Endringene er tilbakestilt etterpå.

Målingen med åpent panel krevde dessuten at `defaultLayout` midlertidig ble
satt til `collapsed: false`, siden verktøyet ikke klikker.

## De tre blokkerende

### 1. Søkefeltet låste seg etter to tegn — rettet

`scrollTo` og `scrollToAndFocus` er nå to funksjoner
(`SourcesView.tsx:29–40`), og `changeQuery` bruker den som ikke fokuserer.

Målt, «risiko» skrevet tegn for tegn i det montskallet:

| Tast | Feltverdi | Fokus      | Teller             |
| ---- | --------- | ---------- | ------------------ |
| `r`  | `r`       | søkefeltet | Skriv minst 2 tegn |
| `i`  | `ri`      | søkefeltet | 1 av 9 treff       |
| `s`  | `ris`     | søkefeltet | 1 av 3 treff       |
| `i`  | `risi`    | søkefeltet | 1 av 3 treff       |
| `k`  | `risik`   | søkefeltet | 1 av 3 treff       |
| `o`  | `risiko`  | søkefeltet | 1 av 3 treff       |

Hele ordet kommer fram, og fokus blir liggende. Funn 10 fra forrige runde er
rettet i samme slengen: under grensen står det nå «Skriv minst 2 tegn» i
stedet for ingenting.

### 2. «Skjul kilder» mistet fokus — bortfalt, og verifisert

Knappen er borte fra viewet. Skallet eier den nå, og `types.ts:12–15`
dokumenterer hvorfor. Skallet rendrer den én gang, utenfor forgreiningen, som
var rettelsen jeg foreslo.

Målt med tastatur: fokus på «Skjul kilder», Enter, og fokus står på samme
knapp, nå med teksten «Vis kilder». Enter igjen, og den er «Skjul kilder» med
panelet åpent. Ingen fokus på `<body>` i noen av retningene.

### 3. `[n]`-markør mot kollapset panel gjorde ingenting — rettet

`SourcesView.tsx:121` åpner nå panelet selv når en markør peker inn i det, og
effekten venter to bilder (`:140–144`) på at skallet skal fjerne `hidden`.

Målt, ende til ende, med `defaultLayout` som den står — altså med panelet
kollapset ved oppstart:

```
start                    aside data-collapsed="true", knappen «Vis kilder»
klikk [2] i svaret       panelet åpner, knappen blir «Skjul kilder»,
                         utdrag 2 åpnet (details.open = true),
                         fokus på div#excerpt-2
klikk [2] en gang til    fokus på div#excerpt-2 igjen
klikk [4]                fokus på div#excerpt-4
```

Nonce-en gjør altså jobben sin også gjennom skallet. Dette er svar 19, den
viktigste enkeltsaken i hele lista, og den virker nå fra markør til utdrag.

## De øvrige funnene fra runde 1

| #   | Funn                                         | Status                 |
| --- | -------------------------------------------- | ---------------------- |
| 4   | «Neste treff» åpnet ikke utdraget            | **rettet**, verifisert |
| 5   | Forrige/Neste flyttet fokus bort fra knappen | **rettet**, verifisert |
| 6   | `index.ts` eksporterte ikke rullemålene      | **rettet**             |
| 7   | Effekten kunne flytte fokus ved montering    | **rettet**, verifisert |
| 8   | Lokal `document` skygget DOM-globalen        | **rettet**             |
| 9   | Faste DOM-id-er                              | **delvis**, se funn A  |
| 10  | Én bokstav ga ingen tilbakemelding           | **rettet**             |
| 11  | Telleren blir snakkesalig                    | står, se funn B        |
| 12  | Snarveislista lagde et eget landemerke       | **delvis**, se funn A  |

Funn 4 og 5, målt sammen: med søket «risiko» aktivt, alle utdrag manuelt
lukket, og «Neste treff» aktivert med Enter — fokus blir liggende på knappen,
ett `details` åpner seg, to `<mark>` blir synlige, og telleren går til «2 av
3 treff». Enter igjen gir «3 av 3 treff». Begge deler riktig.

Funn 7, målt mot `preview/index.html?kilde=3`, som er laget for nettopp dette:
utdrag 3 åpner seg, og fokus blir stående på `<body>`. Viewet stjeler altså
ikke fokus for en markør som alt var satt da det ble montert, men gjør likevel
utdraget synlig. Det er nøyaktig oppførselen som skal til.

Funn 6: `index.ts` re-eksporterer `documentDomId` fra `./ids` og `excerptDomId`
fra modellen. `excerptDomId` flyttet til `src/model/source.ts` i grunnmuren, så
begge sider bygger id-en av samme funksjon. Verifisert ende til ende: markøren
i svaret peker på `#excerpt-3`, og kortet i panelet bærer den id-en.

## Nye funn

### A. Lastetilstanden beholder både den faste id-en og landemerket — bør

`src/views/sources/SourcesPlaceholder.tsx:26–29`

Funn 9 og 12 er rettet i `SourcesOverview` og `ExcerptSearch`, men ikke i
`SourcesPlaceholder`, som er en kopi av den samme strukturen:

```tsx
<section className="sources-overview" aria-labelledby="kilder-snarveier-laster">
  <Heading level={3} data-size="xs" id="kilder-snarveier-laster">
```

Målt i forhåndsvisningen, med panelet i lastetilstand mot ferdig tilstand:

|            | Landemerker                                                                     | Faste id-er                       |
| ---------- | ------------------------------------------------------------------------------- | --------------------------------- |
| Laster     | main · aside «Kilder» · search · form · **section «Snarveier til dokumentene»** | root, **kilder-snarveier-laster** |
| Med kilder | main · aside «Kilder» · search · form                                           | root                              |

To ting følger av det. Landemerkelista endrer seg mens panelet laster, så en
skjermleserbruker ser et landemerke komme og gå. Og id-en er fortsatt en
modulkonstant, så to `SourcesView` samtidig ville dele den — som er hele
grunnen til at de to andre filene fikk `useId()`.

**Rett slik:** samme to grep som i `SourcesOverview`: `useId()` for
overskriften, og `div` i stedet for `section aria-labelledby`.

### B. Kildekortet er blått fordi det ikke sier at det er nøytralt — bør

`src/views/sources/SourceDocumentCard.tsx:45`

```tsx
<Card className="source-document ds-focus" id={documentDomId(source.id)} tabIndex={-1}>
```

`data-color="accent"` står på `<body>`, og `Card` henter flate og ramme fra
rolletokens uten familie. Uten `data-color="neutral"` blir kortet altså
accent-farget. Målt, ved siden av svarkortet, som setter `neutral`:

|                  | Lys                    | Mørk                 |
| ---------------- | ---------------------- | -------------------- |
| Kildekort, flate | rgb(255, 255, 255)     | **rgb(20, 41, 65)**  |
| Kildekort, ramme | **rgb(153, 192, 227)** | **rgb(40, 81, 130)** |
| Svarkort, flate  | rgb(255, 255, 255)     | rgb(32, 40, 52)      |
| Svarkort, ramme  | rgb(184, 188, 193)     | rgb(73, 81, 90)      |

I mørk modus er hele kildekortet marineblått mens svarkortet er nøytralt grått,
på samme skjerm. I lys modus er flaten hvit begge steder, men rammen er blå i
det ene og grå i det andre.

Dette er akkurat fella CONTRIBUTING beskriver under «Color-mode: accent på rot,
neutral på kromet», og som PR #5 unngår med vilje. Ingen har tegnet et blått
kildekort.

Dette sto der også i runde 1; jeg målte den gangen bare mot
forhåndsvisningsflata og fanget det ikke. Det er ikke en regresjon.

**Rett slik:** `data-color="neutral"` på `Card`, som `MessageList.tsx:87` gjør.

### C. Telleren annonserer per tastetrykk — kan

Funn 11 fra runde 1, nå målbart siden feltet kan skrives i. Målt over seks
tastetrykk: telleren endret seg fire ganger («Skriv minst 2 tegn», «1 av 9
treff», «1 av 3 treff», og så uendret). `aria-live="polite"` køer meldingene,
så en skjermleserbruker hører hele rekka etter hvert. Et kort opphold før
telleren oppdateres ville gjort den roligere. Eieren avgjør.

## Riktig, og hvor det er sjekket

**axe: null brudd** med panelet åpent, i lys og mørk modus, 42 regler passert.
Det ene uavklarte funnet er `color-contrast` på snarveislenkene, som axe ikke
klarer å regne ut selv. Målt for hånd, alle over AA:

| Element                     | Lys     | Mørk    |
| --------------------------- | ------- | ------- |
| Snarveislenke               | 5,95:1  | 6,85:1  |
| «Snarveier til dokumentene» | 12,83:1 | 13,87:1 |
| Listenummer (`::marker`)    | 12,83:1 | 13,87:1 |
| «Utdrag 1–2»                | 5,97:1  | 6,86:1  |
| Forhåndsvist sitat          | 12,83:1 | 13,87:1 |
| Kudos-ansvarsfraskrivelsen  | 5,97:1  | 6,86:1  |

**31 av 31 synlig fokuserbare elementer nås med Tab**, i begge moduser, alle
med `:focus-visible` og synlig ring. De to stegene uten ring er
Designsystemets egen `SkipLink` og skrivefeltet i chat-viewet, som har ringen
på rammen rundt seg — begge kjent og begge utenfor denne PR-en.

**Overskriftstreet henger sammen med alle tre viewene montert:**

```
h1 Kunnskapsassistenten · h2 NKOM måloppnåelse · h3 svaroverskrift · h4 ×5
h2 Kilder · h3 Snarveier til dokumentene · h3 dokumenttittel · h4 Utdrag 1 · h4 Utdrag 2 · …
```

`Kilder` er `ds-sr-only`, så den finnes for skjermleseren uten å stå på
skjermen. Ingen hopp.

**Ingen konsollfeil og ingen advarsler**, heller ikke fra
`onCollapsedChange?.(false)` i renderfasen på `SourcesView.tsx:121`. Det er
verdt å vite, fordi å sette tilstand i en _annen_ komponent under render
normalt gir en advarsel fra React. Den kommer ikke her.

**`Skeleton` brukes riktig.** `SourcesPlaceholder.tsx:35` bruker
`variant="rectangle"` med `width="82%"`, og bredden havner som ekte inline
`style`. Det er motsatsen til `variant="text"`, der `width` leses som
antall tegn — se funn 3 i reviewen av PR #5.

**Utdrag uten nummer.** Målt i forhåndsvisningens «Utdrag uten nummer»: ingen `id`, ingen
`tabindex`, overskriften «Utdrag» uten tall, og linja «Ikke vist til i
svaret». Modellen tillater det, og viewet håndterer det som dokumentert.

**Tokens og navn.** Ingen heksfarger, ingen egen markup der Designsystemet har
en komponent, ingen treff på venstre/høyre/left/right. Den ene rå
rem-verdien, `27rem` i `preview/preview.css:41`, er panelbredden i riggen og
havner ikke i produksjonsbygget.

## Til dirigenten

- **PR #2 er klar for Lars.** Ingen blokkerende igjen. Funn A og B er én linje
  hver og bør inn først; funn B er synlig for designeren.
- **`README.md` og `viewModel.ts` er uenige om bredden på åpent kildepanel.**
  README linje 205 sier «Verdien i `defaultLayout` er **483 px**»,
  `viewModel.ts:166` sier 432 med en helt annen begrunnelse. Det er
  grunnmurens, ikke denne PR-ens, men det er to filer i repoet som sier
  forskjellige ting. Tas med i etterrevisjonen av `main`.
- **Spørsmål 25, Kudos-ordlyden, er avgjort i praksis** av denne PR-en: «All
  tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig
  intelligens.» Bør føres inn i `visjon-og-beslutninger.md` så den ikke
  avgjøres på nytt. Gjentatt fra runde 1.
- **CONTRIBUTING sier feil klassenavn for fokusring.** Den ber om
  `ds-focus--visible`; klassen man setter på et element er `ds-focus`, og
  `.ds-focus:focus-visible` komponerer den andre (`base.css:82`). PR #2 bruker
  `ds-focus` og har rett. Grunnmurens fil.
- **De tre viewene leser `[hidden]`-regelen ulikt.** PR #2 parer bare den ene
  klassen som faktisk kan bli skjult; PR #3 og PR #5 parer alle sammen.
  CONTRIBUTING sier «noe som kan skjules med `hidden`», så PR #2 leser den
  strengest og mest presist. Én setning i CONTRIBUTING ville stoppet at neste
  arbeider gjetter.

## Skjermbilder

`design/skjermbilder-frontend/`:

| Fil                                                                                     | Hva                                                           |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `feat-secondary-sidebar-apent--threads-nkom-maaloppnaaelse--light.png` / `--dark.png`   | alle tre kolonnene, panelet åpent                             |
| `feat-secondary-sidebar-montert--threads-nkom-maaloppnaaelse--light.png` / `--dark.png` | samme rute med panelet kollapset, som `defaultLayout` starter |
| `feat-secondary-sidebar-laster.png`                                                     | lastetilstanden, der funn A står                              |

Rådata: `~/.cache/ka-review/runs/feat-secondary-sidebar-apent/` og
`~/.cache/ka-review/runs/feat-secondary-sidebar-montert/`.
