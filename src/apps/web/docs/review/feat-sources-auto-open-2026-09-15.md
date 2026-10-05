# PR #30, kildepanelet åpner seg selv, og railen viser antall

2026-09-15, anmelderen (KA CC). `feat/sources-auto-open` @ `61daf57`
(`4050b12`, `61daf57`). Fasit: `design/_briefs/bygg/rolle-5e-traad-url-kilder.md`
punkt 3.

**Klar. Ingen blokkerende.** Begge unntakene i mine filer er riktige, og jeg
har ettermålt begge påstandene som bar dem.

## Portene

| Sjekk                                               | Resultat                     |
| --------------------------------------------------- | ---------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | OK                           |
| `npm test`                                          | 136 tester, 17 filer, grønne |
| `npm run test:e2e`                                  | 56 grønne, 0 røde            |
| axe (`a11y.sh`, 1440, begge ruter, lys og mørk)     | **0 brudd**                  |

## Plass-regelen, målt

Spørsmål stilt fra `/`, svaret ferdig, ingen vannrett rulling i noen av dem:

| Bredde | Etter svaret                                | Hvorfor                                                                      |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| 1536   | panelet **åpnet seg**, «Skjul kilder»       | begge sidekolonner får plass                                                 |
| 1440   | panelet **åpnet seg**                       | brytepunktet selv rommer begge                                               |
| 1280   | **forble rail**, «Vis kilder, 3 dokumenter» | navigasjonspanelet er åpent, så det er ikke plass uten å ta noe fra brukeren |

Det er den riktige avveiningen, og begrunnelsen står i koden: å ta et panel
fra brukeren er noe hen må be om, ikke noe et ankommende svar gjør.

## «Lukket av brukeren», målt

```
etter svar 1             : Skjul kilder            (expanded=true)
etter at brukeren lukket : Vis kilder, 3 dokumenter (expanded=false)
etter svar 2             : Vis kilder, 3 dokumenter (expanded=false)
```

Panelet kommer ikke tilbake av seg selv. Og `showCitation` nullstiller flagget,
som er riktig: å klikke en markør _er_ å be om panelet.

Skillet mellom «brukeren kollapset» og «regelen kollapset» er det som bærer
hele funksjonen, og det er truffet: `remember()` kalles bare fra `setCollapsed`
og `toggleCollapsed` med den plassen brukeren faktisk nevnte. Kollapser
regel B kildepanelet fordi navigasjonspanelet ble åpnet, står flagget urørt —
ellers ville en vindusendring slått av svarpanelet for resten av økta.

## Badgen

```html
<span class="ds-badge--position" data-placement="top-right">
  <span class="ds-badge" data-count="3" aria-hidden="true"></span>
  <button aria-label="Vis kilder, 3 dokumenter" …></button
></span>
```

Tallet tegnes av `.ds-badge` fra `data-count`, og er `aria-hidden`. Det er
nøyaktig fella i `funn-tverrgaaende.md` — `Badge` er usynlig for skjermleser
fordi tallet er `content: attr()` — og den er håndtert på den ene måten som
virker: tallet står i knappens navn. Synlig tall og navn er enige, målt: begge
sier 3. Skjermbilde: `skjermbilder-frontend/pr30-rail-badge-1280.png`.

**Fokus overlever at badgen kommer.** Badgen pakker knappen i
`ds-badge--position`, altså samme omforming som `Tooltip` gjorde i #20, og
knappen byttes ut når tallet ankommer. Målt: fokus satt på railknappen under
strømming, svaret blir ferdig, badgen kommer — fokus står fortsatt på knappen,
nå med det nye navnet. Reparasjonen fra #20 dekker også denne veien.

## De to unntakene i `tests/`

### `settle()` i `a11y.ts` — riktig, og den skjuler ingenting

Påstanden var at axe måler en tooltip i bevegelse. Den holder: `.ds-tooltip`
har `animation: ds-fade-in .15s` pluss 150 ms forsinkelse, så den er delvis
gjennomsiktig i rundt 300 ms.

Det viktige spørsmålet er om `settle()` dermed skjuler et ekte problem, siden
axe nå aldri ser en tooltip. Målt i ro, godt forbi fade-in:

|      | Farger                                    | Kontrast    |
| ---- | ----------------------------------------- | ----------- |
| lys  | hvit på `rgb(31, 44, 61)`                 | **14,13:1** |
| mørk | `rgb(19, 24, 31)` på `rgb(235, 236, 237)` | **15,07:1** |

Ingenting å skjule. Og formen er riktig: `settle()` **venter på en tilstand**
(`.ds-tooltip` borte), ikke på et tall. En `waitForTimeout(600)` i en hjelper
som kalles fjorten ganger ville vært ti sekunder lagt til suiten og en
presedens for at neste flakete ting løses med et større tall. Denne koster
ingenting på en side uten tooltip.

At den også dropper fokus før måling er verdt å vite: axe ser ikke lenger
fokustilstanden. Ingen dekning går tapt — det er `walkWithTab` og
`expectEveryStepReachable` som faktisk sjekker fokusringene, og ingen test
leser fokus etter et axe-kall.

### `SOURCES_TOGGLE`-regexen — riktig, og nødvendig

`/^(Vis|Skjul) kilder(,|$)/`. Uten den løsere enden matchet den ingenting så
snart badgen kom, siden navnet blir «Vis kilder, 3 dokumenter». Den er
fortsatt forankret i begge ender av det som betyr noe: `^` på hele uttrykket,
og `(,|$)` slipper bare gjennom komma eller slutt — ikke «Vis kildene» eller
«Skjul kilder og noe annet». Navigasjonsknappen har ingen teller og står
uendret forankret, som er riktig.

## Det som er riktig, og hvor jeg sjekket det

- **Render-fase-oppdateringen** har samme form som smal-regelen fra #14, med
  en husket forrige verdi (`sourcesSeen`) i stedet for en effekt. Begrunnelsen
  er den samme og den holder: en effekt ville tegnet svaret én gang med
  panelet lukket og åpnet det en frame senere.
- **`toggleCollapsed` leser fra render-scope og ikke inne i oppdateringen**,
  med kommentaren som sier hvorfor: en updater skal være ren, og `remember` er
  en annen tilstand som settes.
- **Regelen kjører på hver bunke kilder, ikke bare den første.** Et
  oppfølgingssvar finner panelet åpent og gjør ingenting.
- Ingen heksfarger, ingen nye px-tall, ingen `!important`.

## Til dirigenten

1. **Klar for Lars.**
2. Begge unntakene i `tests/` var riktige å gi, og begge er skrevet slik at
   neste person skjønner hvorfor. Jeg har lagt mine egne målinger i rapporten
   så påstandene ikke hviler på én måling gjort én gang.
