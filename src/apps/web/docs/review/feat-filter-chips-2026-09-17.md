# PR #91, `feat/filter-chips`: chip-navnet og fokusringen

Anmeldt 2026-09-17. Hode `b69e163`, base `main` (`3c00f72`).
`git merge-tree --write-tree origin/main b69e163` går rent.

Tre filer, 52 linjer inn. Begge endringene er målt i nettleseren, ikke bare
lest.

**Ingen blokkerende funn. Én «bør», tre «kan».** «Bør» er et tall i en
kommentar som ikke stemmer med det nettleseren gjør — oppførselen er riktig.

## Fillista mot beskrivelsen

`FacetField.tsx` og `FacetField.test.tsx` er chip-navnet, `threads.css` er
fokusringen. Begge mappene er #2 sine. Ingenting i `tests/` er rørt, og #2 sier
selv i PR-kommentaren at chip-navnet kunne vært e2e-testet men at fila er min.
Det er riktig håndtert.

Beskrivelsen dekker det som er i PR-en. Briefens punkt 1, 2 og 4 er avvist med
måling i en PR-kommentar i stedet for å bygges — chips, «Tøm» og høyden fantes
fra før. Jeg har verifisert «Tøm»: den heter «Tøm dokumenttyper» i
tilgjengelighetstreet, altså navngitt per dimensjon.

## Målingene

Kjørt på sammenslåingen, maskinen for meg selv, e2e på min port 4173.

| Port                                               | Resultat                  |
| -------------------------------------------------- | ------------------------- |
| `npm run build`                                    | grønn                     |
| `npm run lint`                                     | grønn                     |
| `npm run format:check`                             | grønn                     |
| `npm run tokens:verify`                            | grønn                     |
| `npm test`                                         | 55 filer, 575/575         |
| `KA_E2E_PORT=4173 CI=true npm run test:e2e`        | 128/128 på 2,0 min        |
| `docs/review/tools/a11y.sh` på `/` og `/threads/…` | 0 axe-brudd i lys og mørk |

De to uavklarte axe-funnene er de samme som før — `aria-required-children` på
tre noder, som er Designsystemets `Suggestion`, vurdert i
`feat-primary-sidebar-2026-09-11.md` og to ganger siden, og `color-contrast`
som axe ikke kan avgjøre bak web-komponenter. Antallet er uendret av denne
PR-en.

**Merk om #2 sitt tall:** PR-kommentaren sier «380 unit-tester». Unit-suiten på
denne sha-en er 575. Alt er grønt uansett, men 380 er ikke hele suiten — trolig
en filtrert kjøring.

## Det som er riktig

1. **Chip-navnet er målt der en leser møter det**, ikke bare som attributt.
   Tilgjengelighetstreet for feltet:

   ```
   listbox "Valgte verdier":
     option "Årsrapport, Trykk for å fjerne fra dokumenttyper": Årsrapport
   ```

   Alle tre feltene bærer sin egen dimensjon: `dokumenttyper`, `virksomheter`,
   `år`. Det er nøyaktig det beskrivelsen lover.

2. **Fokusringen overlapper ikke lenger klokkeslettet.** Målt med ekte
   tastaturfokus på rad 2 i begge moduser: ringens ytterkant og tidas overkant
   står begge på 426,69 px — **0,0 px overlapp**. Radens underkant er det samme
   tallet, altså ligger ringen akkurat innenfor boksen, slik kommentaren sier.
3. **Ringen er fortsatt synlig og har god kontrast der den nå ligger.** Målt:
   14,13:1 mot panelbakgrunnen i lys, 12,55:1 i mørk, og på den valgte raden,
   der ringen nå ligger på accent-flata i stedet for på panelet, 8,63:1 og
   8,4:1. Kravet er 3:1.
4. **Ingen hardkodede verdier.** `calc(-1 * var(--ds-border-width-focus))`
   henter forskyvningen fra samme token som bredden, så en endring i
   Designsystemet flytter begge samtidig. Farge, bredde og stil er fortsatt
   Designsystemets.
5. **Skjermbilde av begge moduser med raden i fokus** viser at «09:30» står
   helt og uklippet. Det er pikslene, ikke bare boksene.

## Bør

### Kommentaren sier 4 px, nettleseren sier 3

`threads.css`: «The row's 4 px of vertical padding is where the ring goes
instead», og «One ring width inward puts its outer edge exactly on the border
box».

Den andre setningen stemmer, målt. Den første gjør ikke: raden har
`data-size="sm"`, og i den subtreet er `--ds-size-1` ikke 4 px men
`round(down, calc(1rem * 4 / 18), 1px)` = **3 px**. Målt på
`.threads-view__thread`: `padding-block-start: 3px`, `padding-inline-start:
7px` (ikke 8).

Konsekvensen er at klaringen kommentaren lover ikke finnes: ringen er 3 px og
paddingen er 3 px, så ringens innerkant ligger **akkurat** på innholdsboksen,
ikke 1 px fra den. Det er greit i dag — linjehøyden gjør at bokstavene ikke
når helt ut, og skjermbildene viser en ren rad — men neste person som regner
på det, regner på feil tall. Og hvis Designsystemet noen gang setter
`--ds-border-width-focus` til 4, spiser ringen av tekstboksen uten at noe sier
fra.

Rett tallet i kommentaren, eller skriv klaringen som det den er: null.

## Kan

### 1. Bare halve ringen flyttet

Designsystemets fokusring er et **par**: en `outline` og en `box-shadow` med
3 px spredning i motsatt tone, som er det som gjør at ringen virker mot hvilken
som helst bakgrunn. `outline-offset` flytter bare `outline`. Målt på den
fokuserte raden:

| Del                           | Ytterkant | Over tida |
| ----------------------------- | --------- | --------- |
| `outline`                     | 426,69 px | 0,0 px    |
| `box-shadow` (spredning 3 px) | 429,69 px | 3,0 px    |

Skyggen ligger altså fortsatt 3 px utenfor boksen, over tidas boks. Den synes
ikke: fargen er flatefargen med vilje — `rgb(255,255,255)` i lys,
`rgb(19,24,31)` i mørk — og den treffer luft i linjehøyden, ikke blekk. Det er
bekreftet på piksler i begge moduser.

Men parets to halvdeler er ikke lenger naboer: ringen ligger 3 px inne,
bakgrunnen 3 px ute, med 3 px radbakgrunn mellom. Kontrasten holder på alle
flatene raden faktisk har (punkt 3 over), så det er ingenting å gjøre nå.
Verdt å vite den dagen en rad får en sterkere flatefarge.

### 2. «Trykk for å fjerne fra år»

To av tre leser naturlig. Den tredje, «fra år», er tynn norsk. «fra årstall»
eller «fra filteret år» er en mulighet. #2 og Lars avgjør; det er ikke galt,
bare stramt.

### 3. Fokusringen har ingen automatisk vakt

Chip-navnet fikk en unit-test. CSS-fiksen fikk ingen, og en regel som
forsvinner er usynlig for både `lint` og axe — axe måler ikke om ringen
overlapper naboen. Målingen min (ringens ytterkant mot tidas overkant, med
ekte tastaturfokus) er nøyaktig det en e2e-test kan påstå. `tests/` er min, så
dette er min oppfølging, ikke #2 sin: jeg legger den i e2e-PR-en jeg har i kø.

## En felle å ta med videre

`element.focus()` slår **ikke** på `:focus-visible` i Chromium. Første måling
min leste `outline-style: none` og `outline-offset: 0` på en rad jeg nettopp
hadde fokusert, og et øyeblikk så det ut som om regelen ikke virket i det hele
tatt. Det som virker er ekte `Tab` til elementet. Den hører hjemme i
`docs/review/README.md` sammen med de andre målefellene; jeg legger den inn i
neste PR.

## Til dirigenten

Klar for Lars. Den ene «bør» er én linje i en kommentar. De tre «kan» kan alle
vente, og den siste av dem er min egen oppfølging.
