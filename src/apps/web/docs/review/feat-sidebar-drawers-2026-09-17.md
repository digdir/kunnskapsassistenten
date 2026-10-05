# PR #97, `feat/sidebar-drawers`: sidekolonnene som skuffer under 1139

Anmeldt 2026-09-17. Hode `d1dcc07`, base `main` (`b502e65`).
`git merge-tree --write-tree origin/main d1dcc07` går rent.

Ni filer, 1069 linjer inn. Alt dirigenten ba om er målt i nettleseren, og det
som skal være uendret over brytepunktet er målt **mot `main`**, ikke bare sett
på.

**Ingen blokkerende funn. Én «bør», tre «kan».** «Bør» er en regel
beskrivelsen bruker et helt avsnitt på, som ingen test vokter.

## Fillista mot beskrivelsen

| Fil                                       | Hva                                                                                           | I beskrivelsen                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| `useDrawerMode.ts`                        | ny, media query for brytepunktet                                                              | ja                              |
| `viewModel.ts`                            | `drawerMaxViewport`, `drawerPlacement`, `drawerWidth`, `slotRail`, `withAllSidebarsCollapsed` | ja                              |
| `Shell.tsx`                               | `Dialog`, og `railed` skilt fra `collapsed`                                                   | ja                              |
| `LayoutProvider.tsx`                      | foldes bort ved inngang, ingen auto-åpning i skuffmodus                                       | ja                              |
| `global.css`                              | skuffbredde og lukkeknappen som flex-element                                                  | ja                              |
| `src/test/setup.ts`                       | jsdom-shim for `<dialog>`                                                                     | nei, men den er forklart i fila |
| `DrawerShell.test.tsx`, `drawers.test.ts` | nye unit-tester                                                                               | ja                              |
| `tests/e2e/drawers.spec.ts`               | ny e2e, min mappe                                                                             | ja, med unntak                  |

Unntaket for `tests/` står i beskrivelsen denne gangen, og ingen eksisterende
e2e-fil er rørt. Det er slik jeg ba om i #92.

## Målingene

Kjørt på sammenslåingen, maskinen for meg selv, e2e på min port 4173.

| Port                                        | Resultat           |
| ------------------------------------------- | ------------------ |
| `npm run build`                             | grønn              |
| `npm run lint`                              | grønn              |
| `npm run format:check`                      | grønn              |
| `npm run tokens:verify`                     | grønn              |
| `npm test`                                  | 58 filer, 608/608  |
| `KA_E2E_PORT=4173 CI=true npm run test:e2e` | 140/140 på 2,1 min |

140 og ikke 139: #92 er merget inn i `main` siden #5 målte.

### 1. Ingen vannrett rulling, og hva det var før

200 % zoom er målt som 720 CSS-px viewport, som er det et 1440-vindu på 200 %
faktisk gir nettleseren.

| Bredde | Tilstand               | `scrollWidth − clientWidth` |
| ------ | ---------------------- | --------------------------- |
| 1024   | landing                | 0                           |
| 1024   | navigasjonsskuffa åpen | 0                           |
| 1024   | kildeskuffa åpen       | 0                           |
| 720    | landing                | 0                           |
| 720    | navigasjonsskuffa åpen | 0                           |
| 720    | kildeskuffa åpen       | 0                           |

På `main`, samme rute og samme tilstand: **115 px for mye ved 1024 og 419 ved
720**, med `scrollWidth` 1139 begge steder. At tallet er nøyaktig
`drawerMaxViewport` er en fin bekreftelse på at 1139 er riktig sum.

Se «kan 1»: beskrivelsens 51 og 355 er fra en annen tilstand.

### 2. Modal, fokusfelle, inert bakgrunn, Escape

Målt på begge skuffene, på 1024 og 720:

- `dialog.matches(':modal')` **sann** — altså ekte `showModal()`.
- **Fokusfella holder.** Jeg tabbet 30 ganger med kildeskuffa åpen og skrev ned
  hvert stopp: tolv kontroller inne i skuffa, så rundt igjen. Ikke ett stopp i
  bakgrunnen.
  Verdt å vite for neste måling: ved omslaget står `document.activeElement` på
  `<body>` for **ett** steg før den er tilbake i skuffa. En naiv test på
  «forlot fokus skuffa noen gang» blir rød av det. #5 sin egen e2e går klar,
  fordi den ser på hvilke elementer `walkWithTab` faktisk merket og ikke på
  `activeElement` mellom stegene — det er den riktige formen.
- **Bakgrunnen er inert:** en lenke i svarkolonnen nekter å ta fokus
  (`element.focus()` etterlater `document.activeElement` et annet sted).
- **Escape lukker og gir fokus tilbake** til railknappen som åpnet: «Vis tråder
  og filter» og «Vis kilder, 3 dokumenter».

### 3. Null axe-brudd med skuffa åpen

Åtte kjøringer — to bredder × to moduser × to skuffer — med skuffa faktisk
åpen, som er tilstanden verktøyet mitt ellers ikke ser:

| Bredde | Modus | Skuff           | Brudd |
| ------ | ----- | --------------- | ----- |
| 1024   | lys   | tråder / kilder | 0 / 0 |
| 1024   | mørk  | tråder / kilder | 0 / 0 |
| 720    | lys   | tråder / kilder | 0 / 0 |
| 720    | mørk  | tråder / kilder | 0 / 0 |

Eneste uavklarte er `aria-required-children` i navigasjonsskuffa, som er
Designsystemets `Suggestion` og er vurdert tre ganger før.

### 4. Over brytepunktet: ingenting er endret

Målt som et avtrykk på fem bredder — 1139, 1280, 1439, 1440, 1680 — i to
tilstander hver: slik sida lander, og etter at kildepanelet åpnes. Ti
avtrykk med ti felter hver: hovedkolonnens bredde, begge sidekolonnene,
`data-collapsed` på begge, antall skiller, antall breddeknapper, vannrett
rulling og `aria-expanded` på begge railknappene.

Samme avtrykk kjørt på `main` (`b502e65`) med samme nullstilte lager:
**ingen forskjeller.** Ikke ett felt.

Det dekker det dirigenten spurte om: railen står på 67, panelbreddene er de
samme, og regel B oppfører seg likt — navigasjonspanelet kollapser når
kildepanelet åpnes på 1139, 1280 og 1439, og begge blir stående på 1440 og 1680. Ingen `dialog` finnes i DOM-en over brytepunktet i det hele tatt.

## Bør: regelen om at en skuff ikke åpner seg selv har ingen vakt

`LayoutProvider.tsx:243`. Beskrivelsen bruker et avsnitt på den, og
begrunnelsen er god: en modal som legger seg over svaret du nettopp fikk og tar
tastaturet, midt i lesingen, er ikke noe man ber om.

Jeg fjernet `&& !drawer` fra betingelsen og kjørte alt:

| Suite                       | Uten vakten        |
| --------------------------- | ------------------ |
| `npm test`                  | **grønn**, 608/608 |
| `tests/e2e/drawers.spec.ts` | **grønn**, 9/9     |

Ingenting merker at regelen er borte. `LayoutProvider.test.tsx` har alt seks
tester om auto-åpning, med en harness som utløser den (`click('Svar med
kilder')`) — den syvende hører hjemme i samme blokk, med viewport under 1139.

Jeg forsøkte også å nå stien for hånd i nettleseren, med et ekte svar med fem
markører, og fikk ikke auto-åpningen til å slå til på noen av bredene. Den
e2e-testen som dekker auto-åpning andre steder (`layout.spec.ts:631`) åpner
panelet ved å **klikke en markør**, ikke ved at svaret kommer. Så stien er
enten smalere enn jeg fant, eller ikke nåbar for hånd — desto større grunn til
å pinne den der harnessen alt finnes. Vakten er tilbakestilt.

## Kan

### 1. De to tallene i beskrivelsen er fra en annen tilstand

Beskrivelsen sier «1024 × 768 ruller 51 px» og «355 px for lite» ved 720.
Målt på `main` i landingstilstanden er det **115** og **419**. Differansen er
64 begge steder, og 1024 + 51 = 1075 = 720 + 355 — altså tilstanden
«kildepanelet åpent ved siden av navigasjonsrailen», som er den andre summen i
#5 sin egen kommentar. Tallene er konsistente med hverandre, de beskriver bare
ikke tilstanden en leser lander i. Problemet er større enn beskrivelsen sier,
ikke mindre.

### 2. Lukkeknappen velges på vendorens attributt

`.drawer > button[command='close']` treffer markup Designsystemet genererer fra
`closeButton`-propen. Det virker i 1.21.0, men `command` er vendorens navn og
ikke en del av API-et vi kaller. Verdt en linje i
`designsystemet/funn-tverrgaaende.md` slik at neste oppgradering vet å se etter
den.

### 3. Railknappen er uklikkbar mens skuffa er åpen

Den bærer `aria-expanded="true"`, men ligger i den inerte bakgrunnen, så den
kan ikke brukes til å lukke igjen. Det er riktig oppførsel for en modal, og
Escape og lukkeknappen er begge der — men beskrivelsens «veksleknappene
beholder plassen sin» er sannere om plassen enn om vekslingen.

## Det som er verdt å si høyt

`src/test/setup.ts` shimmer `<dialog>` i jsdom og **nekter** å late som den kan
fokusfelle, inert bakgrunn, topplag og Escape — med en kommentar som sier at en
test som besto på latterten ville vært verre enn ingen test, og som peker på
e2e-fila der de fire faktisk måles. Det er den riktige avgjørelsen, og det er
verdt å lese for alle som skal shimme noe senere.

## Til dirigenten

Klar for Lars. «Bør» er én test i en fil som alt har seks av samme sort, og
ingen endring i produksjonskoden.
