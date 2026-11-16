# PR #93, `fix/width-controls-when-fixed`: kontrollene forsvinner når vinduet er fullt

Anmeldt 2026-09-17, på kode. Hode `9bc0930`, base `main` (`3c00f72`).
`git merge-tree --write-tree origin/main 9bc0930` går rent.

**Ingen blokkerende funn. To «bør», to «kan».** Begge «bør» gjelder tekst som
ikke fulgte med endringen: README beskriver fortsatt oppførselen PR-en fjerner,
og en e2e-test har mistet tennene sine uten å miste kommentaren sin.

## Fillista mot beskrivelsen

Seks filer, alle gjort rede for:

| Fil                                | Hva                                                | Nevnt i beskrivelsen                    |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------- |
| `src/layout/PanelSeparator.tsx`    | `if (fixed) return null`, `tabIndex` tilbake til 0 | ja                                      |
| `src/layout/PanelWidthButtons.tsx` | samme, og `dead`-propen fjernet                    | ja                                      |
| `src/layout/Shell.tsx`             | seks linjer kommentar, ingen oppførsel             | nei, men den peker bare på komponentene |
| de to `.test.tsx`                  | seks nye unit-tester                               | ja                                      |
| `tests/e2e/resize.spec.ts`         | tre tester skrevet om, tre nye                     | ja, med unntak                          |

Ingen andre filer i `tests/` er rørt. Det stemmer.

## Målingene

Kjørt på sammenslåingen, med maskinen for meg selv (load 1,6 ved start), e2e på
min port 4173.

| Port                                        | Resultat           |
| ------------------------------------------- | ------------------ |
| `npm run build`                             | grønn              |
| `npm run lint`                              | grønn              |
| `npm run format:check`                      | grønn              |
| `npm run tokens:verify`                     | grønn              |
| `npm test`                                  | 55 filer, 576/576  |
| `KA_E2E_PORT=4173 CI=true npm run test:e2e` | 130/130 på 2,0 min |

#5 sine tall stemmer.

## Det som er riktig

1. **Den tidlige returen står etter alle hookene.** `PanelSeparator.tsx:48-60`
   (`useLayout`, `useState`, `useRef`, `usePanelWidth`) før `:150`, og
   `PanelWidthButtons.tsx:27-28` før `:69`. En hook bak en `if` her ville ha
   krasjet med «rendered fewer hooks than expected» i det vinduet krysset
   1440 — altså akkurat i tilstanden PR-en handler om. Den er unngått.
2. **Påstanden om at grensa blir stående er sann i CSS-en.**
   `.panel-separator` er `position: absolute` (`global.css:149`), så ingenting
   flytter seg når den forsvinner; `::before` er gjennomsiktig utenom `:hover`
   og `[data-dragging]` (`global.css:183-194`); og den synlige kanten tegnes av
   panelets egen ramme (`global.css:347` og `:363`). Det som går er gripeflata
   og `col-resize`, slik beskrivelsen sier.
3. **Ingenting melder en bredde som ikke er på skjermen.** `fixed` er
   `range.min === range.max` (`usePanelWidth.ts:60`) og `aria-valuenow={width}`
   er den tegnede bredden (`PanelSeparator.tsx:164`), ikke den lagrede.
4. **Ingen andre specer rører skillene eller breddeknappene.** Bare
   `resize.spec.ts` treffer på `getByRole('separator')` og «Gjør … bredere», så
   suitens faste 1440 (`playwright.config.ts:83`) etterlater ingen test som
   påstår kontroller som nå er borte.
5. **Axe-dekningen av skillet overlever.** Den kjøres på 1920 i lys og mørk
   (`resize.spec.ts:524-570`), altså på en bredde der kontrollene fortsatt
   tegnes. Hadde den ligget på 1440, ville PR-en stilltiende ha fjernet
   a11y-dekningen av kontrollene.
6. **`not.toHaveAttribute('tabindex')` er gyldig** i Playwright 1.63 —
   ettargumentsformen finnes fra 1.39 — og den er riktigere enn `'0'`: en
   `<button>` er et tabbstopp uten attributt. At testen følger opp med
   `.focus()` og `toBeFocused()` er det som gjør den til en måling og ikke en
   attributtsjekk.
7. **`dead`-propen er ryddet overalt.** Ingen rester i `src` eller `tests`.
8. **Unit-testen beholder vakten mot den lagrede bredden**, flyttet til 1480
   der tegnet (440) er forskjellig fra både lagret (480) og standard (400)
   (`PanelSeparator.test.tsx`). Det er den riktige bredden å måle det på. Se
   «bør 2»: e2e-versjonen valgte en annen.

## Bør

### 1. README beskriver fortsatt oppførselen PR-en fjerner

`README.md:308-314`, i fet skrift:

> **Skillet er ikke et tabbstopp når det ikke kan flytte seg.** … Linja står
> fortsatt — kanten er der — men `tabIndex` er −1 og `aria-disabled` er satt …

Det er #50 sin oppførsel, og den er borte fra og med denne PR-en. Avsnittet
over, om `aria-disabled` på knappen som står på en grense (`README.md:303-306`),
er derimot fortsatt riktig og skal stå. Det er bare separator-avsnittet som må
skrives om — helst med samme begrunnelse som nå står i `PanelSeparator.tsx:131-147`.

To filer i repoet er uenige om hva produktet gjør, og README er det første en
ny leser åpner.

### 2. E2E-testen «taket er vinduets, ikke bare modellens» kan ikke lenger bli rød av den grunnen den finnes for

`tests/e2e/resize.spec.ts:414-430`. Før målte den på 1440: lagret 480, tegnet
400, og `aria-valuenow` måtte være 400. Det var løgnen som ble voktet. Nå er
skillet borte på 1440 — riktig — og påstanden er flyttet til 1680, der tegnet
og lagret er **det samme tallet** (480): over = 1616 − 1680 ≤ 0, så ingen av
panelene gir fra seg noe. Da består påstanden uansett om koden melder den
tegnede eller den lagrede bredden.

Kommentaren lover fortsatt det motsatte: «det skal være bredden på skjermen,
ikke den lagrede».

Bredden som gir tennene tilbake er **1480**, den samme som PR-ens egen
unit-test bruker: 480 + 32 + 640 + 32 + 432 = 1616, vinduet er 1480, kildepanelet
gir 96 og navigasjonspanelet de siste 40, så tegnet er 440 mot lagret 480 — og
`range` er `{ min: 400, max: 440 }`, altså finnes skillet. Behold gjerne
1680-steget som det er, det viser at den lagrede bredden kommer tilbake når det
blir plass; legg 1480 ved siden av.

**Målt, ikke utledet.** Jeg la løgnen inn i koden — `aria-valuenow` satt til
den lagrede bredden i stedet for den tegnede — og kjørte de to testene mot den:

| Kode        | Påstand              | Resultat                          |
| ----------- | -------------------- | --------------------------------- |
| løgnen inne | e2e på 1680          | **grønn** — fanger ikke løgnen    |
| løgnen inne | unit på 1480         | rød: «expected 480 to be 440»     |
| løgnen inne | e2e flyttet til 1480 | rød: «Expected 440, Received 480» |
| løgnen ute  | e2e på 1480          | grønn                             |

Mutasjonen og testflyttingen er tilbakestilt etterpå; arbeidstreet står rent på
`9bc0930`.

Merk at egenskapen ikke er udekket: `PanelSeparator.test.tsx` måler den på 1480.
Dette handler om at e2e-testen sier noe den ikke måler.

## Kan

### 1. Stale begrunnelse i axe-testen

`tests/e2e/resize.spec.ts:527-530` velger 1920 fordi skillet på 1536 «er ute av
tab-rekkefølgen med vilje». Det er ikke lenger ute av tab-rekkefølgen; det er
ikke tegnet. Valget av 1920 er fortsatt riktig, bare begrunnelsen er gammel.

### 2. Det utskrevne antallet skiller avhenger av tastetrykkene før det

`tests/e2e/resize.spec.ts:471-473`:
`toBe(width === 1440 && sources === 'open' ? 0 : 1)`. Tallene stemmer slik
løkka står, men de stemmer fordi `Home` kommer sist i `['End', 'Home']` og
legger hvert panel tilbake på gulvet sitt før neste tilstand. Bytter noen om
til `['Home', 'End']`, blir navigasjonspanelet stående på 480 inn i
`sources === 'open'`, kildepanelet gir 80 i stedet for 96, og på 1536 finnes da
**to** skiller. Testen ryker høylytt og ikke stille, så den er ikke farlig — men
kommentaren forklarer tallene uten å nevne at de henger på rekkefølgen.

## Til dirigenten

Ingen blokkerende. «Bør 1» er README og hører hjemme hos #5 i denne PR-en —
det er samme endring, bare i prosa. «Bør 2» og begge «kan» ligger i
`tests/e2e/resize.spec.ts`, som er min fil: si fra om #5 skal ta dem mens de
likevel har unntaket, eller om jeg tar dem i min neste lille PR. Jeg foreslår
det siste for de to «kan», og at #5 tar «bør 2» nå: det er to tall og en
kommentar, og jeg har målt at erstatningen virker.

Alle portene og hele e2e-suiten er kjørt på sammenslåingen og er grønne.
