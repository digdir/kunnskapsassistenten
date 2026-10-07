# Kunnskapsassistenten, frontend

> Kopiert fra [larsekhansen/kunnskapsassistenten-frontend](https://github.com/larsekhansen/kunnskapsassistenten-frontend) på `53bf2c8` 7. oktober 2026, uten historikken. Historikken står der.

[![CI](https://github.com/larsekhansen/kunnskapsassistenten-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/larsekhansen/kunnskapsassistenten-frontend/actions/workflows/ci.yml)

Ny frontend for Kunnskapsassistenten (KA) i Digdir. Vite, React, TypeScript,
React Router i klientmodus, og Designsystemet 1.21.0.

Klienten har samtalen, trådlista, kildene med utdrag og filtreringen.
`VITE_API_MODE` velger backend: `bff` (BFF-en i `src/apps/server`), `live`
(rett mot headless-rag) eller `mock` (fixturene i `src/api/mock/`, standard).
Hva som er ferdig, står under «Status» i [`src/README.md`](../../README.md#status).

Navnereglene står under [Naming](#naming), og kortversjonen av arbeidsreglene i
[CONTRIBUTING.md](CONTRIBUTING.md).

## Kom i gang

I monorepoet står oppskriften i
[`src/README.md`, «Komme i gang»](../../README.md#komme-i-gang): Node 24,
`npm ci` i `src/`, BFF-en og klienten, testene og bildet. Skriptene under
kjøres fra `src/` med `--workspace apps/web`.

| Skript                  | Gjør                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`           | Utviklingsserver                                                                                 |
| `npm run build`         | `tsc -b` og produksjonsbygg til `dist/`, for BFF-en uten `VITE_API_MODE` (`src/api/apiMode.ts`)  |
| `npm run preview`       | Server produksjonsbygget lokalt                                                                  |
| `npm run lint`          | oxlint, inkludert `jsx-a11y`-reglene                                                             |
| `npm run test`          | vitest én gang. `npm run test:watch` for løpende kjøring                                         |
| `npm run format`        | Prettier, skriver                                                                                |
| `npm run format:check`  | Prettier, sjekker bare                                                                           |
| `npm run tokens:build`  | Bygger temaet på nytt fra `designsystemet.config.json`                                           |
| `npm run tokens:verify` | Bygger temaet i en midlertidig mappe og feiler hvis resultatet er annerledes enn det innsjekkede |

Kjør `tokens:verify` etter hver oppgradering av Designsystemet. Feiler den, er
det informasjonen du vil ha: les diffen før du sjekker inn.

## CI

I monorepoet kjører klientens sjekker i `.github/workflows/ci.yml` i rota, på
hver pull request og hver push til `main`. Jobben `check` kjører format,
typesjekk, `npm test` og bygget for hele arbeidsområdet. Jobben `web` kjører
lint, `tokens:verify` og e2e-suiten i mock-modus, så CI snakker aldri med
backenden. Feiler e2e, lastes Playwright-rapporten opp som artefakt. På pull
requests bygger og starter jobben `image` bildet, uten å pushe det.

Arbeidsflytene i `.github/workflows/` her er fra frontend-repoet. GitHub
kjører dem ikke herfra.

## Mappestruktur

```
designsystemet.config.json    kilden til temaet: fem farger, radius, font
design-tokens/                Design Tokens som JSON, Tokens Studio-format
design-tokens-build/
  digdir.css                  temaet, ~1155 linjer CSS-variabler
  types.d.ts                  typer for data-color og data-size
src/
  main.tsx                    inngangspunkt, BrowserRouter
  App.tsx                     rutene
  globals.d.ts                window.dsWarnings
  env.d.ts                    VITE_API_MODE
  styles/global.css           importrekkefølge og all egen CSS
  model/                      delte domenetyper: Thread, Message, Citation,
                              SourceDocument, FilterFacet, StreamEvent …
  api/
    chatClient.ts             grensesnittet mock og ekte klient deler
    index.ts                  createChatClient(), leser VITE_API_MODE
    mock/                     fixtures og MockChatClient
    live/                     LiveChatClient, MCP-oversettelse, SSE-leser
  layout/
    Shell.tsx                 de tre plassene
    viewModel.ts              Slot, ViewId, View, Layout, bredder, brytepunkt
    layoutContext.ts          React-konteksten
    LayoutProvider.tsx        tilstanden: aktivt view, kollapset, bredder
    useLayout.ts              useLayout() og useSlot()
    viewComponents.ts         hvilken komponent som tegner hvilket view
    ViewPlaceholder.tsx       står i til viewene er bygget
    useNarrowViewport.ts      om begge sidekolonner får plass samtidig
    colorScheme.ts            mørk modus, window.ka.colorScheme
    citationContext.ts        hvilken [n] brukeren vil se
    useCitation.ts            useCitation()
  components/                 PanelHeader, Markdown, EmptyState, ErrorState
    icons.ts                  aksel-ikoner under KA-navn
  routes/
    NewConversation.tsx       ruten /
    Thread.tsx                ruten /threads/:threadId
  test/
    setup.ts                  jsdom-oppsett for vitest
    matchMedia.ts             matchMedia for jsdom, med bredde testen kan sette
```

Mappene `src/api/`, `src/model/` og `src/components/` kommer med grunnmuren.
`src/routes/` er rutesider som monterer views i plassene; `src/views/`
(`threads/`, `filters/`, `chat/`, `sources/`) er selve viewene, og hver
undermappe eies av én arbeider, se `CONTRIBUTING.md`.

## Naming

Regelen ble satt 2026-09-11:

- **Kode, filnavn, mapper, CSS-klasser, CSS-variabler, typer og ruter:
  engelsk.**
- **Alt brukeren ser eller hører: norsk bokmål med ekte æøå.** UI-tekst,
  `aria-label`, `title`, feilmeldinger, `lang="nb"`.
- **Plasser heter etter posisjon, innhold heter etter innhold**, som i VS Code.

Denne fila og `CONTRIBUTING.md` er på norsk. Kommentarer i koden er på engelsk,
siden de er kode.

### Plasser og views

En **plass** (slot) er et sted i layouten. Det er tre av dem, og de har faste
navn etter posisjon:

| Plass               | Element                    | CSS-klasse           |
| ------------------- | -------------------------- | -------------------- |
| `primary-sidebar`   | `<nav>`                    | `.primary-sidebar`   |
| `main`              | `<main id="main-content">` | `.main`              |
| `secondary-sidebar` | `<aside>`                  | `.secondary-sidebar` |

Et **view** er innhold som kan flyttes mellom plasser, og heter etter
innholdet: `threads`, `filters`, `chat`, `sources`. Standardoppsettet har
threads og filters i `primary-sidebar`, chat i `main` og sources i
`secondary-sidebar`.

**En plass har aldri en fast `aria-label`.** Navnet kommer fra viewet som står
der, via `slotLabel()` i `src/layout/viewModel.ts`: «Tråder og filter» for
primary, «Kilder» for secondary. `<main>` får ingen etikett, siden det er unikt
på sida.

To grunner til at plassene ikke er navngitt etter hvilken side de står på:

1. **Skjermlesere.** Flytter man et view, skal navnet følge med. En fast
   etikett som nevner en side lyver den dagen panelet flyttes, og en
   skjermleserbruker har ingen sider å navigere etter uansett.
2. **Flyttbare paneler.** Brukeren skal på sikt kunne velge hva som ligger
   hvor. Et navn bundet til posisjon overlever ikke det.

Derfor finnes ikke ordene «venstre», «høyre», `left` eller `right` noe sted i
dette repoet, heller ikke i kommentarer. Det er grep-bart, og det skal
fortsette å være det.

### Layout-abstraksjonen

`src/layout/viewModel.ts` har typene `Slot`, `ViewId`, `View`, `SlotState` og
`Layout`, pluss `defaultLayout` som skallet leser fra. Grunnen til at
abstraksjonen kom først står i fila: plassinnhold, plassbredde og
modusvekslingen i begge sidepaneler er samme problem.

Bredden var det første som fikk et grensesnitt, 2026-09-15: hver åpen
sidekolonne har et skille leseren kan dra i, `src/layout/PanelSeparator.tsx`.
Se «Panelbredder». Det finnes fortsatt **ikke** noe grensesnitt for å flytte
et view mellom plasser — `withViewMoved` er der, knappen er det ikke.

## Sideflaten

Sida er lys grå, ikke hvit: `--ds-color-neutral-background-tinted` på
`.shell`. Designet setter hvite kort på grå flate, og på hvit flate forsvinner
kortene. Navigasjonspanelet har sin egen hvite flate over den grå.

## Temaet

Digdir-temaet er ikke publisert på npm, så det genereres her med
Designsystemets kommandolinjeverktøy fra `designsystemet.config.json`. Bygget
(`design-tokens-build/digdir.css` og `types.d.ts`) er **sjekket inn**, slik at
et bygg av frontenden ikke trenger CLI-en i kjeden. `colors.d.ts` er utdatert
og holdes utenfor.

CSS-en importeres i denne rekkefølgen i `src/styles/global.css`, og
rekkefølgen har en grunn:

1. `@digdir/designsystemet-css` — komponent-CSS, og den erklærer
   layer-rekkefølgen `@layer ds.theme, ds.base, ds.components`
2. `design-tokens-build/digdir.css` — temaet, som legger seg i `ds.theme.*`
3. vår egen CSS, **utenfor alle layers**

Punkt 3 er nøkkelen: ulagret CSS slår all lagret CSS, så vi trenger aldri
`!important` for å overstyre Designsystemet.

**Skriv aldri px og aldri heksfarger.** Bruk `var(--ds-size-N)` og
`var(--ds-color-*)`. Faste verdier følger ikke tema, størrelsesmodus eller
mørk modus.

Rot-attributtene står i `index.html`, og **de står på to forskjellige
elementer med vilje**:

| Attributt                  | Element      | Hvorfor                                                                                                                                                                       |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lang="nb"`                | `<html>`     | Flere Designsystemet-komponenter har norske standardtekster som bare slår inn når nærmeste `lang` starter på `nb`, `nn` eller `no`. `Suggestion` er det tydeligste eksempelet |
| `data-color-scheme="auto"` | `<html>`     | Følger operativsystemet. Overstyres av `window.ka.colorScheme`, se «Mørk modus»                                                                                               |
| `data-size="md"`           | **`<body>`** | Se under                                                                                                                                                                      |
| `data-color="accent"`      | `<body>`     | Følger `data-size`                                                                                                                                                            |

**`data-size` må ikke stå på `<html>`.** Designsystemets `[data-size]`-regel
setter `font-size` på elementet den treffer. Står den på `<html>`, blir `1rem`
18 px i stedet for 16 px, og da skalerer **alle** `--ds-size-*`-tokens 12,5 %
opp, siden de er regnet ut av `calc(1rem * 4 / 18 * 1.125)`. Målt: 36 px blir
40 px. Designsystemet sier det selv i `base.css`: «Setting default font on
`<body>` not `:root`/`<html>` to ensure 1rem is still 16px».

## Tilgjengelighet

**WCAG 2.x AA er et krav, ikke et mål.** Offentlig sektor og
uu-kravene. Enhver snarvei som gir utseende uten tilgjengelighet er
utelukket.

Praktisk betyr det:

- `npm run lint` kjører `jsx-a11y`-reglene som feil, ikke advarsler.
- Bruk Designsystemets komponenter for det Designsystemet dekker. De har
  fokusring, tastaturstøtte og ARIA ferdig. Hover og fokus **arves** og
  tegnes ikke selv.
- Alt er norsk, også tilgjengelige navn.
- Ikonknapper må ha `aria-label`.
- Hopp-lenka er Designsystemets `SkipLink` og er alltid første fokuserbare
  element.

### Tastatursnarveier

Én, og den har en modifikator med vilje.

| Snarvei                | Hva                                   |
| ---------------------- | ------------------------------------- |
| `Ctrl + /` (`Cmd + /`) | flytter skrivemerket til skrivefeltet |

Begge modifikatorene virker overalt; hinten ved feltet navngir den maskinen
leseren sitter ved (`shortcutHint()` i `src/views/chat/text.ts`).

**Hvorfor ikke bare `/`.** En snarvei bundet til én tegntast er WCAG 2.1.4
Character Key Shortcuts, **nivå A**, og må da kunne slås av, remappes, eller
bare virke når komponenten har fokus. Snarveien var `/` alene i første
utkast — ingen av delene — og KA CC blokkerte den 15.09. Med modifikator
faller den utenfor 2.1.4, og mnemonikken er den samme som i GitHub og Slack.
Hopp-lenka rett til skrivefeltet er primærveien; snarveien er snarveien.

**Shift slipper gjennom.** På norsk tastatur er `/` = Shift+7, så `shiftKey`
er alltid sann når tasten i det hele tatt finnes. En vakt som avviste shift
ville aldri utløst på oppsettet appen er skrevet for.

**Alt avvises.** Ctrl+Alt er AltGr på Windows, som setter sammen tegn i stedet
for å gi kommandoer.

Snarveien står to steder i grensesnittet, fordi den leses på to måter: en liten
dempet linje ved feltet, og en visuelt skjult beskrivelse på selve feltet der
tegnet er skrevet ut som «skråstrek» — `/` lest høyt er stumt i noen stemmer.
Se `src/views/chat/useComposerShortcut.ts` og `text.ts`.

## Layout og brytepunkter

Avgjort 2026-09-14, endret 2026-09-15. Se `design/visjon-og-beslutninger.md`.
Appen har **ett** brytepunkt, og det er regnet ut, ikke valgt.

### Bredder

| Plass               | Åpen           | Kan dras til | Kollapset | Gir etter?                |
| ------------------- | -------------- | ------------ | --------- | ------------------------- |
| `primary-sidebar`   | 400            | 400–480      | 67        | ja, sist, tilbake til 400 |
| `main`              | 640–800        | —            | —         | ja, først, ned til 640    |
| `secondary-sidebar` | 432, minst 336 | 336–560      | 67        | ja, deretter, ned til 336 |

Tallene er **yttermål**, padding medregnet, fordi sidepanelene er `border-box`.
Det var de ikke før: med `content-box` ble de 36 px paddingen på hver side lagt
utenpå, og hvert tall i modellen var 72 px kortere enn det tegnet. Målt, ikke
resonnert fram.

Navigasjonspanelets 400 er de 328 som ble satt (svar 59b) pluss paddingen, og
400 er også det malen tegner panelet som. Taket på 480 ble satt da
skillene kom; kildepanelets tak på 560 er toppen av `kilder`-rammen i
designet, den bredeste den kolonnen er tegnet noe sted.

Kolonnen «Åpen» er standarden. Har leseren dratt i et skille, er det den
bredden som gjelder — så langt vinduet rekker. Se «Panelbredder».

### Panelbredder leseren kan dra i

Fra visjonen i `design/visjon-og-beslutninger.md`: kolonnene skal kunne endres
i størrelse. Punkt 24 i brukerreise-lista kaller det essensielt — svaret og
kilden det hviler på skal kunne leses ved siden av hverandre, og 640 px svar
ved siden av 336 px utdrag er ikke alltid delen leseren vil ha.

**Ett skille per åpen sidekolonne**, på kanten mot hovedkolonnen. En rail har
ingen bredde å endre og får ingen. Skillet er 1 px-linja panelet alt hadde,
med en gripeflate på 8 px midt på seg; den viser seg først når pekeren eller
tastaturet er der.

| Tast                       | Hva                                         |
| -------------------------- | ------------------------------------------- |
| pil mot venstre/høyre      | flytter kanten 16 px den veien tasten peker |
| `Shift` + pil              | 64 px                                       |
| `Home` / `End`             | smaleste / bredeste panelet kan være        |
| `Enter` eller dobbeltklikk | tilbake til standardbredden                 |
| knappene i panelhodet      | 16 px per klikk, uten draging               |

Musa og fingeren drar den samme kanten, og tastaturet gjør det samme uten å
dra — det er WCAG 2.1.1 Keyboard.

**To knapper i panelhodet er pekerveien:** «Gjør tråder og filter bredere» og
«… smalere», ett steg på 16 px per klikk. De er der for WCAG 2.5.7 Dragging
Movements (AA), som handler om **peker**-inndata: alt som betjenes med en
draging skal også kunne betjenes med én peker uten å dra. Et tastatur
oppfyller ikke den, for de kriteriet er skrevet for bruker peker og kan
klikke, men ikke holde og bevege — hodepeker, skjelving, styrepinne. En
gripeflate på 8 px er dessuten vrien å dra for flere enn dem. Funn fra KA CC
sin anmeldelse av PR #50.

Står kanten på en grense, blir knappen `aria-disabled` og ikke `disabled`. Å
gjøre et panel bredere er noe man gjør ved å trykke på den samme knappen flere
ganger, og en `disabled`-knapp slipper fokus til `body` i det den slår seg av.
Samme par som i utdragssøket.

**Kan ingen kant flyttes, tegnes ingen breddekontroller.** Ved 1440 med begge
sidekolonner åpne er 400 + 32 + 640 + 32 + 336 nøyaktig vinduet, og da er
`aria-valuemin`, `aria-valuemax` og `aria-valuenow` det samme tallet: begge
skillene og alle fire knappene forsvinner helt, ikke bare ut av
tab-rekkefølgen. Avslått er en tilstand som går over, og denne gjør det ikke —
en kontroll som aldri kan gjøre noe herfra ser bare ødelagt ut. 1440 er
bredden alle Figma-rammene er tegnet i, så det er bredden flest møter.
Kontrollene kommer tilbake av seg selv når vinduet vokser, gjennom
`useViewportWidth`.

Grensa mellom panelet og svaret blir stående: den tegnes av panelets egen
ramme, ikke av skillet. Det som går er gripeflata og `col-resize`-pekeren,
altså løftet om en draging vinduet ikke kan innfri.

Skillet er `role="separator"` med tab-stopp, som er splitter-rollen i ARIA
1.2, med `aria-orientation="vertical"`, `aria-valuenow/min/max` i piksler og
`aria-valuetext` («400 piksler»), siden en separator ikke bærer noen enhet en
leser kan gjette.
Ingen live-region: verdien _er_ meldingen, og en region som sa det samme en
gang til ville snakket over leseren. Navnet kommer fra viewene i plassen, som
alle andre navn i skallet — «Endre bredde på tråder og filter», ikke
«navigasjonspanelet», slik at et view som flyttes tar navnet med seg.

**Hva som begrenser dragingen** er det trangeste av to: modellens egne tall i
tabellen over, og det vinduet har igjen når det andre panelet og
hovedkolonnens gulv på 640 har fått sitt. En draging tar plass fra
hovedkolonnen og aldri fra det andre panelet — å dra i én kant og se den
motsatte flytte seg er å se appen gjøre noe ingen ba om. Ved 1440 med begge
sidekolonner åpne står alt på gulvet sitt, og da er `aria-valuemin`,
`aria-valuemax` og `aria-valuenow` det samme tallet: det er sant, og det er
bedre enn en kant som spretter tilbake.

Bredden huskes i `ka.layout.v1`, og bare når den er en annen enn standarden —
tilbakestilling fjerner den, den skriver ikke standarden ned en gang til.

Designsystemet 1.21.0 har ingen Splitter, ingen Resizable og ingen fokuserbar
Separator; `Divider` er en vannrett strek med `aria-hidden`. Det er notert i
`design/designsystemet/behov-til-komponent.md`. Fokusringen er likevel
Designsystemets, gjennom klassen `ds-focus`.

### Kollapset sidekolonne er en rail

En kollapset sidekolonne er **67 px**, med panelflate og kantlinje, og holder
bare veksleknappen sin. Knappen er ikon-eneste; teksten lever videre som
`aria-label` og som tooltip, så en skjermleserbruker hører «Vis kilder» i begge
tilstander.

Utledet, ikke valgt: 42 px ikonknapp + 12 px padding på hver side + 1 px for
railens egen kant. `railWidth` i `src/layout/viewModel.ts` skriver ut summen.

**En rail ligger inntil hovedkolonnen — gapet er 0.** De 32 px
(`--ds-size-8`) gjelder mellom et _åpent_ panel og hovedkolonnen. Derfor er
gapet en `margin` på panelet og ikke `gap` på rada: `gap` sier det samme om
alle par, og en rail skal ligge klemt inntil.

Det var 236 og 198 fram til 2026-09-15, brede nok til å tegne hver sin etikett
på én linje. Sett i mørk modus: 236 px tom flate med én knapp øverst
leses som et hull, ikke som en kolonne som er lagt sammen. Poenget med å
kollapse et panel er å gi plassen tilbake.

### Rekkefølgen når plassen blir knapp

1. **Hovedkolonnen** krymper først, ned til gulvet sitt på 640.
2. **Kildepanelet** deretter, fra bredden sin ned til 336.
3. **Navigasjonspanelet** sist, fra bredden sin ned til 400.

Punkt 1 er `flex` i `src/styles/global.css`: hovedkolonnen vokser fra null og
nekter å krympe, så den tar det som er igjen og ikke mer. Punkt 2 og 3 er
`fittedWidths()` i `src/layout/viewModel.ts`, en ren funksjon av layout og
vindusbredde.

Rekkefølgen sto i CSS fram til 2026-09-15 og måtte flytte: `flex-shrink`
fordeler mangelen på alle som kan krympe samtidig og kjenner ingen rekkefølge,
og et panel som er drukket bredere må gi tilbake _etter_ kildepanelet, ikke
sammen med det. Regnestykket eier dessuten `aria-valuenow` på skillet — en
verdi som sier 480 over et panel som tegnes på 400 er en løgn fortalt til den
ene leseren som ikke ser forskjellen.

**Navigasjonspanelet gir aldri under 400.** Det var «gir aldri» så lenge 400
var den eneste bredden det kunne ha.

### Brytepunktet: 1440

Under 1440 kan ikke begge sidekolonnene være åpne samtidig. Åpner du den ene,
kollapses den andre; krymper vinduet forbi 1440 mens begge er åpne, kollapses
**kildepanelet**, som er det som gir etter. En kildehenvisning i svaret følger
samme regel, siden den også er en forespørsel om å åpne kildepanelet.

1440 er ikke et magisk tall og ikke en skjermstørrelse. Det er summen av det
de tre plassene trenger når ingen har noe å gi:

```
400 + 32 + 640 + 32 + 336 = 1440
```

Begge sidekolonner **åpne** er den eneste tilstanden dette handler om, så
begge gapene er ekte her og railen kommer ikke inn i regnestykket. Railen er
det som får alle de andre tilstandene til å gå opp ved 1280; den bredeste er nå
navigasjonspanelet åpent med kildepanelet som rail, 400 + 32 + 640 + 67 = 1139.

Konstanten heter `bothSidebarsMinViewport` i `src/layout/viewModel.ts` og er
**regnet ut** av breddene, ikke skrevet ned, så den flytter seg om en bredde
endres. At den lander på 1440, bredden alle Figma-framene er tegnet i, er en
sammentreff verdt å merke seg og ikke grunnen til tallet.

Regelen ligger i `LayoutProvider`, ikke i CSS, og `useNarrowViewport.ts`
forklarer hvorfor: det brytepunktet endrer er **kollapset tilstand**, som
knappene melder med `aria-expanded`. En CSS-regel som skjulte et panel ville
latt knappen påstå at panelet er åpent.

Regelen tar et panel bort når det ikke er plass. Den gir ikke noe tilbake når
vinduet vokser igjen: et panel som åpnet seg selv ville overstyrt et valg
brukeren har tatt.

### Kildepanelet åpner seg selv

Når et svar kommer med kilder, åpner kildepanelet seg — **hvis det er plass**.
Over brytepunktet er det alltid plass. Under det bare når navigasjonspanelet
alt er kollapset: ellers ville regel B tatt navigasjonspanelet for å gi rom,
og å ta et panel fra brukeren er noe de må be om, ikke noe et svar gjør.

**Lukker brukeren panelet selv, åpner det seg ikke igjen i økta.** Bare en
kollaps brukeren ba om teller. Regel B kollapser også dette panelet, og hadde
det blitt husket som en preferanse, ville én endring av vindusbredden slått av
kildepanelet for resten av økta. Åpner brukeren det igjen — med knappen eller
ved å trykke på en `[n]` — er det siste de har sagt «vis meg», og regelen
gjelder på nytt.

Når panelet er en rail og svaret har kilder, står antallet som en `Badge` på
knappen. Tallet må også stå i teksten: Designsystemet tegner det som
`content: attr(data-count)` på et pseudoelement, som skjermlesere leser
ustabilt eller ikke i det hele tatt. Knappen heter derfor «Vis kilder, 3
dokumenter», og tooltipen sier det samme — `@digdir/designsystemet-web`
skriver `data-tooltip` inn i `aria-label` på et element uten egen tekst, så to
forskjellige strenger ville betydd at den ene stille overskrev den andre.

### Panelhode og rulling

**Plassen ruller ikke; innholdsregionen i den gjør det.** Veksleknappen ligger
i et panelhode som blir stående. Uten det rullet knappen bort sammen med
innholdet: klikk på en `[n]` og kildepanelet ruller nesten tusen piksler til
utdraget, med «Skjul kilder» en skjerm over toppen av vinduet, så panelet står
uten synlig måte å lukke seg på. Funn 2 i `docs/review/brukerblikk-2026-09-15.md`.

`.sidebar-content` har `min-block-size: 0`. Det er ikke pynt: et fleksbarns
automatiske minstemål er innholdet sitt, så uten det vokser regionen forbi
plassen og panelet blir klippet ved vinduskanten uten noe å rulle i — funn 7,
navigasjonspanelet kuttet midt i en setning.

**Skillet mot sida bæres av kanten, ikke av flatene:** panel mot side er
1,10:1 i lys og 1,11:1 i mørk, altså usynlig i begge. `--ds-color-neutral-border-default` mot
sida er 3,95:1 og 4,23:1, over de 3:1 WCAG 1.4.11 ber om for en grense som
betyr noe. `border-subtle`, som sto der før, er 1,73:1 og 2,04:1. Målt i bygget
app 2026-09-15. Funn 4.

**Kildepanelet har ingen egen flate når det er åpent** (valgt 2026-09-15):
kildene hører sammen med svaret, så kolonnen deler hovedkolonnens grunn og
kanten markerer skillet. Funn 15 spurte om asymmetrien var med vilje. Den er
det. Kollapset er det en rail, og da har det flate som den andre — en kolonne
som er lagt sammen må leses som en kolonne.

Et smalt panel får mindre luft: under 380 px blir `--ka-sidebar-padding-inline`
20 px i stedet for 36, så kildepanelet på gulvet sitt (336) gir teksten plass i
stedet for å brekke etter to ord. En container-spørring spør plassens egen
bredde, og derfor ligger paddingen på regionene inni og ikke på plassen selv —
et element kan ikke svare på en container-spørring om seg selv. Spørringen
måler **innholdsboksen**, så navigasjonspanelet på 400 svarer 399: terskelen er
380 og ikke 400 nettopp fordi 400 traff den bredeste kolonnen også.

### Garantien

**Ingen vannrett rulling ved 1280 eller bredere, i alle tilstander.** Målt i
bygget app, headless, lys og mørk modus:

| Bredde | Tilstand                   | Nav | Hoved | Kilder |
| ------ | -------------------------- | --- | ----- | ------ |
| 1536   | alt åpent                  | 400 | 640   | 432    |
| 1440   | begge sidekolonner åpne    | 400 | 640   | 336    |
| 1440   | nav åpent, kilder som rail | 400 | 800   | 67     |
| 1280   | nav åpent, kilder som rail | 400 | 781   | 67     |
| 1280   | kilder åpne, nav som rail  | 67  | 749   | 432    |
| 1280   | begge som rail             | 67  | 800   | 67     |

Fjerde rad er **tilstanden appen åpner i**. Den trengte 1302 px før railen og
rullet 22 px vannrett ved 1280; nå trenger den 1139.

Radene går ikke alltid opp i vindusbredden, og det er riktig: når
hovedkolonnen treffer taket sitt på 800, fordeler `margin-inline: auto` resten
på hver side av den. Railene blir stående i vinduskanten, som er der en rail
hører hjemme.

## Åpne punkter

- **Under 1280 er et kjent avvik fra WCAG 1.4.10 Reflow (AA).** Kravet er at
  innhold skal kunne vises i 320 px bredde uten vannrett rulling; appen
  garanterer 1280. Det er en bevisst begrensning i v1 (spørsmål 45: desktop og
  stor tablet først), men det er et avvik og skal telles som det. Forslaget til
  fiks står rett under.
- **1024 px og 200 % zoom ruller vannrett i dag.** Reise 16, punkt 17 og 18 i
  `design/brukerreiser-2026-09-15.md`. WCAG 1.4.4 Resize text er AA, og AA er et
  krav. Forslag under.
- **Topplinje** er ikke bestemt, så det finnes ingen.
- ~~React Router-versjonen.~~ **Avgjort 2026-09-11:** 8.3.1, pinnet uten
  caret, samme versjon som ki.norge.no og Designsystemets egen nettside. Se
  «React Router» under.

### Forslag: sidekolonnene som skuffer under 1139

**Ikke bygget.** Dette er forslaget, med tallene som utløser det, så
beslutningen kan tas på tall og ikke på skjermstørrelser — samme framgangsmåte
som 1440.

I dag må hver tilstand få plass **ved siden av** hovedkolonnen. Det gir tre
terskler, alle summer av bredder som allerede står i `viewModel.ts`:

| Tilstand                   | Regnestykke         | Trenger |
| -------------------------- | ------------------- | ------- |
| nav åpent, kilder som rail | 400 + 32 + 640 + 67 | 1139    |
| kilder åpne, nav som rail  | 67 + 640 + 32 + 336 | 1075    |
| begge som rail             | 67 + 640 + 67       | 774     |

Målt i dag: 1024 × 768 ruller 51 px (1075 > 1024), og 1440 med 200 % zoom er
720 CSS-px, altså 355 px for lite.

**Trinn 1, under 1139:** en sidekolonne som åpnes legger seg **over**
hovedkolonnen i stedet for ved siden av. Designsystemets `Dialog` med
`placement` satt til kanten plassen står ved gir en skuff derfra (`left` og
`right` er leverandørens egne verdier, og leverandørnavn er unntaket fra
navneregelen); `closedby="any"` gir lukking ved klikk utenfor, og `Dialog` har
fokusfelle og Escape ferdig. **Railene blir stående**, så veksleknappene
beholder plassen sin og `aria-expanded` betyr fortsatt det samme — det eneste
som endrer seg er hvor panelet tegnes. Konstanten hører hjemme ved siden av
`bothSidebarsMinViewport` og regnes ut på samme måte:

```
drawerMaxViewport = 400 + 32 + 640 + 67 = 1139
```

Det løser punkt 17: ved 1024 er summen 774, og hovedkolonnen vokser til taket
sitt på 800 med 90 px til overs. Regel B blir overflødig under terskelen, for
to skuffer kan ikke ta plass fra hverandre.

**Trinn 2, under 774:** da er det railene selv som ikke går opp, og de to
knappene trenger et sted å bo. Det stedet er topplinja, som ikke er bestemt —
så trinn 2 er en beslutning før det er kode. Alternativet er å la
hovedkolonnens gulv på 640 gi etter i stedet, og det er billigere enn det
høres ut: gulvet finnes for at kildene skal kunne leses **ved siden av**
svaret (svar 46, 49 og 59), og under 1139 står kildene i en skuff. Da har
gulvet ingen grunn igjen.

Trinn 1 og 2 sammen tar 200 % zoom på 1440 (720) og på 1280 (640). Full
1.4.10 Reflow ned til 320 px er fortsatt utenfor v1 (spørsmål 45).

## Tråder og adresser

Rutene er `/` for ny samtale, `/threads/:threadId` for én samtale, og en
**oppsamlingsrute** for alt annet.

| Adresse              | Hva                                         |
| -------------------- | ------------------------------------------- |
| `/`                  | ny samtale                                  |
| `/threads/:threadId` | én samtale                                  |
| alt annet            | «Siden finnes ikke», med lenke til forsiden |

`/tull` ga **helt tom side** til 15.09 — ingen `main`, ingen overskrift, ingen
hopp-lenke — fordi `Routes` tegner null når ingenting treffer og skallet ligger
som ruteoppsett under. Nå tegnes skallet med beskjeden i hovedkolonnen.
`App.tsx` har to ruteoppsett og ikke ett: oppsamlingsruta monterer skallet med
`routeOwnsMain`, så chat-viewet står ned. «Siden finnes ikke» med et fungerende
skrivefelt under er to svar på samme spørsmål, og det største av dem er feil.

**En tråd-id ingen kjenner gir «Fant ikke tråden»**, ikke en fersk forside. Det
er `ChatSlotView` som avgjør det, for svaret kommer først når klienten har
svart: `getThread` som gir `null` betyr at tråden ikke finnes, mens en lesing
som **kaster** ikke sier noe om det — da fortsetter samtalen som før. Reise 14
i `design/brukerreiser-2026-09-15.md`: en delt lenke som var gått ut på dato
så ut som den virket.

**Første spørsmål fra `/` gir samtalen en adresse.** Viewet som eier
skrivefeltet kaller `useThread().startThread(spørsmålet)`, og
`ChatSlotView` lager tråden og bytter URL til `/threads/:id`. Uten det
kopierer «Kopier lenke til tråden» forsiden (C16 i
`design/funksjonssjekk-v1.md`).

Byttet skjer med `history.replaceState`, **ikke** med ruteren. En ekte
navigering ville byttet `key` på `ChatSlotView`, montert chatten på nytt og
tatt svaret som strømmer med seg. Adressen er en lenke til senere, ikke en
navigering: ingenting på skjermen skal flytte seg. Prisen er at React Router
tror den står på `/` til neste ekte navigering — alle lenker i appen er
absolutte, så ingenting løses opp mot den.

**Derfor vet ikke ruteren hvilken samtale som er åpen, og skallet gjør det.**
Trådlista merker den åpne raden med `aria-current="page"`, og det attributtet
— ikke fargen — er det som sier til en skjermleser hvor leseren står. Det kom
fra `NavLink`, som leser ruterens posisjon, og som derfor lot raden for tråden
leseren nettopp lagde stå umerket til neste lasting (målt av KA CC). Nå melder
`ChatSlotView` hvilken samtale som er på skjermen, skallet holder den, og lista
leser den: `openThreadContext.ts`, samme mønster som den aktive kildehenvisningen
og filteret. Begge veiene inn — en rad du klikker på og en tråd du nettopp lagde
— går gjennom den samme mekanismen.

**Tittelen er spørsmålet, til backend gir en ekte.** `Thread.title` er
brukerens eget spørsmål, trimmet, og `titleFromQuestion` sier at det er et
stedfortredertall. Trådlista bruker det som radtittel; samtalen skal **ikke**
tegne det, for spørsmålet står allerede på skjermen som brukerens melding, og
en overskrift som gjentar det satte samme setning på sida to ganger (målt av
#3, 15.09). Flagget forsvinner av seg selv den dagen backend sender en tittel.

En tråd laget i nettleseren finnes bare i den fana: backend har ikke noe
tråd-API å lagre den i (gap 4 i `design/eksisterende/api-for-frontend.md`,
API-bestilling A6). **I mock-modus overlever den likevel en reload**, se «Det
appen husker». I **live**-modus gjør den ikke det: `getThread` svarer alltid
`null`, så en reload av en samtale du nettopp hadde lander på «Fant ikke
tråden». Det er sant — samtalen er borte — men det er A6 som er svaret på det,
ikke noe frontenden kan fikse.

## Det appen husker

Fem nøkler, og ingenting annet. Fire i `localStorage`, som varer til
nettleseren tømmes, og én i `sessionStorage`, som varer så lenge fana lever.

| Nøkkel               | Lager          | Hva                                                                                               |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `ka.color-scheme`    | localStorage   | lys, mørk eller auto. Se «Mørk modus»                                                             |
| `ka.display-level`   | localStorage   | hvor mye svaret viser om hvordan det ble til. Se «Visningsnivå»                                   |
| `ka.layout.v1`       | localStorage   | hvilke sidekolonner som er lagt sammen, hvor brede de er, og om brukeren selv lukket kildepanelet |
| `ka.filter.v1`       | localStorage   | filtervalget                                                                                      |
| `ka.mock.threads.v1` | sessionStorage | samtalene denne fana har hatt. **Bare i mock-modus**                                              |

**Layout og filter** ligger i `src/layout/persistence.ts` og leses én gang når
`LayoutProvider` monteres. Punkt 9 i reise 16: `localStorage` var tom, og et
panel du hadde lagt sammen var tilbake ved neste lasting. Nøklene har versjon
fordi de går ut på dato av ulike grunner — layout-nøkkelen når plassene endrer
seg, filternøkkelen når **korpuset** gjør det, siden verdiene er nøklene
backend filtrerer på.

To ting er bevisst:

- **«Lukket av brukeren» lagres ved siden av «er lagt sammen».** Kildepanelet
  er lagt sammen som standard, så en kollaps som blir husket alene er ikke til
  å skille fra en fersk side — og første svar med kilder ville åpnet panelet
  igjen i ansiktet på en som nettopp lukket det.
- **Regel B vinner over det som er husket.** Var begge sidekolonnene åpne da du
  forlot sida, og vinduet er for smalt nå, kollapses kildepanelet på første
  render. Det som er lagret er et ønske, ikke en garanti om plass.

Breddene lagres **ikke**. Ingenting kan endre dem ennå (svar 10: abstraksjonen
nå, dra-håndtaket senere), og å huske et tall ingen kan lage er bare noe å
migrere den dagen håndtaket kommer.

**Samtalene** ligger i `src/api/mock/sessionThreads.ts` og er mockens jobb
alene. Skallet sier fra hvilken tråd som er åpen — `ChatClient.openThread`,
som bare en klient som kan huske noe implementerer — og mocken skriver hver
ferdige tur inn i den: spørsmål, svar, kilder, tenkesteg. Da gir
`/threads/<uuid>` samtalen tilbake etter en reload, og trådlista viser den.

`sessionStorage` og ikke `localStorage`, med vilje: dette er en stedfortreder
for en server, ikke et arkiv. Det lever så lenge fana lever, deles ikke med
andre faner, og forsvinner når nettleseren lukkes — som er den ærlige
levetiden for noe som finnes fordi det ekte lageret mangler. Bare turer som
faktisk produserte tekst skrives ned; et svar som feilet før første token
tegner ikke noe kort, og et lagret tomt svar ville tegnet et kort som aldri
fantes. En tur i en fixture-tråd legges etter fixture-meldingene fra koden,
så det samme svaret aldri skrives ned to ganger.

## Visningsnivå

Hvor mye et svar viser om hvordan det ble til. To nivåer, lagret per nettleser
under `ka.display-level`, og `standard` er det alle får uten å velge noe.

| Nivå        | Over svaret                                                            | I kortet                               |
| ----------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `standard`  | «Fremgangsmåte», åpen: stegene i klartekst og søkeordene               | ingenting ekstra                       |
| `detaljert` | tenkepanelet: «Tenkte i N sekunder», stegenes detaljer og søkestrenger | «Fremgangsmåte» med treff og nøkkelord |

Nivået velges i en skjult meny. **Legg `#innstillinger` til i adressen**, for
eksempel `http://localhost:5173/#innstillinger`, så åpner den seg; å lukke den
tar hashen ut igjen. Ingen knapp peker på den, med vilje: standard er standard,
og den som vil ha det tekniske, er en utvikler som har fått adressen.

Hash og ikke spørring, fordi en hash aldri når serveren, ikke bytter rute, og
ikke følger med en lenke til en tråd noen limer inn et annet sted. Bakgrunnen
står i `src/decisions/0007-display-level.md`; koden ligger i
`src/views/chat/displayLevel.ts`, `ProcedurePanel.tsx` og `SettingsDialog.tsx`.

### Foten i navigasjonspanelet

Samme meny holder et valg til, fra issue 123:

| Valg         | Hva som skjer                                                                             |
| ------------ | ----------------------------------------------------------------------------------------- |
| `Festet`     | Standard. Lenkene og fargemodus står under rullefeltet, uansett hvor langt du har rullet. |
| `Ruller med` | Alt ligger i én kolonne. Foten står sist i rullefeltet og følger lista ned.               |

Valget er her for å kunne sammenlignes, ikke fordi det er avgjort. Målingene
av begge står i PR-en som la det inn. Koden ligger i
`src/layout/footerMode.ts`, `Shell.tsx` og `.sidebar-content > .sidebar-footer`
i `src/styles/global.css`.

## Mock-modus: spørsmål som gjør noe spesielt

| Spørsmål                | Hva mocken gjør                                              |
| ----------------------- | ------------------------------------------------------------ |
| `simuler feil`          | Feiler etter første tenkesteg, generisk feil (`unknown`)     |
| `simuler feil modell`   | Språkmodellen svarer ikke (`model-unavailable`)              |
| `simuler feil korpus`   | Søket i dokumentene er nede (`retrieval-unavailable`)        |
| `simuler tidsavbrudd`   | Svaret tok for lang tid (`timeout`)                          |
| `simuler ingen treff`   | Søket fant ingen utdrag (`no-hits`), tegnes som et svar      |
| `simuler avvist nøkkel` | Nøkkelen ble avvist (`unauthorized`), ingen «Prøv igjen»     |
| `simuler avklaring`     | Svarer med et spørsmål tilbake, status `needs-clarification` |

Alle er eksakte treff på hele spørsmålet, ikke ord inni det: «hva er feil i
rapporten» er et ekte spørsmål og skal få et ekte svar, og `simuler feil
modell` er sitt eget spørsmål og ikke et prefiks-treff på `simuler feil`. De
finnes fordi ingen av tilstandene ellers kan nås fra et bygget bygg, verken av
en e2e-test eller av en designer, uten en backend som er nede eller en agent
som spør tilbake.

**Feilkoden bestemmer teksten.** `ChatError` bærer en kode, og
`src/views/chat/errorText.ts` slår opp overskrift, to setninger — hva som
skjedde og hva brukeren kan gjøre — og om «Prøv igjen» i det hele tatt tilbys.
En avvist nøkkel får ingen knapp: samme spørsmål med samme nøkkel feiler likt.
Backend sender ikke kodene ennå (API-bestilling A16), så live-klienten mapper
det den faktisk får: 401/403 → `unauthorized`, 408/504 → `timeout`, 429 →
`rate-limited`, alt annet → `unknown`. En 5xx sier ikke om det var modellen
eller korpuset, og den forskjellen gjettes ikke.

`no-hits` er **ikke** en feil i rødt: søket kjørte og fant ingenting, som er et
svar med tom kildeliste. Chatten tegner det som en ferdig tur i tråden, og
kildepanelet sier det samme med sine egne ord i stedet for å vente på utdrag
som ikke kommer. Rådet følger filteret: har leseren avgrenset korpuset, står
det at filteret kan løsnes, ellers ikke.

`needs-clarification` er en **ferdig** tur, ikke en feilet: innholdet er et
ekte spørsmål til brukeren. Backend melder den i `_meta.status`, og
`StreamEvent`s `done` bærer den videre som `outcome`.

## Mock-korpuset

Mocken svarer fra et **ekte, fritt korpus**: 938 dokumenter fra
[Kudos](https://kudos.dfo.no), DFØ sitt åpne dokumentarkiv. 259 virksomheter,
årene 2020–2027, fem dokumenttyper.

**Hva som er ekte og hva som er vårt.** Titler, dokumenttyper, virksomheter,
år, sammendrag og lenker er hentet fra Kudos og er uendret. Svarene,
tenkestegene og koblingen mellom utdrag og svar er skrevet av oss. Ingenting i
korpuset er generert.

### Hente det på nytt

```sh
node scripts/fetch-mock-corpus.mjs
```

Kjøres for hånd, aldri fra et bygg: resultatet er sjekket inn som
`src/api/mock/corpus/kudos-korpus.json` (0,8 MB), så en klone bygger og tester
uten nett. Skriptet bruker ett sekund per forespørsel og prøver to ganger til
hvis forbindelsen ryker. Se diffen før du sjekker inn.

To ting som formet skriptet, begge målt:

- `type` er den **eneste** parameteren API-et godtar. År, sortering og
  fritekst gir feil — men `type` filtrerer, så de fem typene hentes hver for
  seg i stedet for å lese 1806 sider med alt.
- **De fleste dokumentene i Kudos har ikke sammendrag.** Av 200 målte hadde
  128 tomt `abstract`. Derfor leses 2500 dokumenter for å beholde 938.

Året i korpuset er det dokumentet handler **om**, ikke året det ble publisert:
en årsrapport for 2024 kommer ut i 2025, og et filter som la den under 2025
ville svart på et annet spørsmål enn det som ble stilt.

### Fasetter

Tellerne i filteret regnes ut av korpuset, betinget av det som alt er valgt —
det API-bestilling A2 ber backend om. Regelen som gjør tallene meningsfulle:
**en dimensjon snevrer ikke inn sine egne tellere.** «Årsrapport (322)» må
fortsette å si 322 etter at du huker den av, og «Evaluering (42)» må stå der
ved siden av. Talte man dem under dokumenttype-filteret, ville hver uhuket
type falt til null i det den første ble huket — som leses som «det finnes ikke
noe annet», når sannheten er «du har ikke bedt om noe annet ennå».

De andre dimensjonene snevrer inn. Huker du av «Helsedirektoratet», viser
årene hvor mange av Helsedirektoratets dokumenter hvert år har.

### Elleve cachede samtaler

Mocken har elleve ferdige samtaler over korpuset, så det går an å se hele
flyten uten backend: skjelett, tenkesteg, strømming, kilder og
«Fremgangsmåte». `src/api/mock/conversations/scripts.ts`.

**De er også trådene i lista.** `conversations/threads.ts` skriver hver samtale
ut som en `ThreadDetail` — spørsmålet, svaret, kildene gruppert per dokument,
`[n]`-ene løst opp mot dem, tenkestegene og «Fremgangsmåte» — så en rad du
klikker på i trådlista åpner den samme samtalen som om du hadde spurt og
ventet. Fram til 15.09 var lista tolv titler med én samtale under seg, så
elleve av tolv tråder var tomme (punkt 16 på brukerreise-lista, målt av #4).

Med ett unntak: **den som feiler blir ingen tråd.** `answer` er tom med vilje,
fordi teksten leseren ser hører til i viewet (`errorText.ts`, slått opp på
koden) og varselet drives av turen som skjer, ikke av en melding. Skrevet ned
som tråd ville den blitt en tom boble uten noe som sa hva som gikk galt. Den
nås som før, ved å stille spørsmålet.

Tidspunktene er relative (`clock.ts`), spredt fra i dag til i fjor, så
grupperingen i trådlista — «I dag», «Siste 7 dager», «Siste 30 dager», måned,
år — fortsatt tegnes hel uansett når appen åpnes. Hver samtale bærer dagen sin
selv, i `daysAgo`, og ikke i en liste ved siden av: en tabell paret etter
posisjon ville forskjøvet alle dagene etter en samtale som ble lagt til eller
filtrert bort.

**Tre av dem er kickstarterne på tomtilstanden, ord for ord.** Trykk et
forslag og send, og du får svar. Det krevde ingen endring i chat-viewet:
spørsmålene var allerede skrevet, så svarene er skrevet til dem.

To av de tre spør om år korpuset ikke har, og svarene sier det. Det er ikke
et hull i fikstureringen — det er det en søkeassistent gjør når arkivet
stopper før spørsmålet, og verdt å kunne se på.

| Samtale                               | Hva den viser                                                    |
| ------------------------------------- | ---------------------------------------------------------------- |
| Regnskap og bevilgning i DSS          | Kickstarter 1. Årene finnes ikke; svaret sier hva som gjør       |
| Lærerspesialordningen                 | Kickstarter 2. `needs-clarification`: spør tilbake, ingen kilder |
| Digdir: tildelingsbrev mot årsrapport | Kickstarter 3. Sammenlikning, med tabell                         |
| Institusjonsbarnevernet               | Ett dokument, og svaret sier at det er ett                       |
| Digitalisering på tvers               | 12 utdrag fordelt på 6 dokumenter                                |
| Klimagassutslipp                      | Feiler etter tenkestegene. Den ene uten tråd i lista             |
| Kunnskapsgrunnlag og samordning       | Lange nøkkelord i «Fremgangsmåte»                                |
| Folkehelsetiltak 2026                 | Punktliste                                                       |
| Isbjørn i norsk Arktis                | Ett dokument, fire utdrag                                        |
| Krav til helseforetakene              | Oppdragsdokument                                                 |
| Måling av forenkling                  | Sier fra når sammendraget ikke har måltall                       |

Spørsmålet trenger ikke treffe ordrett: sammenlikningen ser bort fra
tegnsetting og store bokstaver, og godtar at brukeren har kuttet slutten av
forslaget — kickstarterne fyller feltet uten å sende (svar 40), så spørsmålet
som kommer er ofte redigert.

**Utdragene er ordrette sitater.** `conversations.test.ts` sjekker at hvert
utdrag fortsatt er en delstreng av sammendraget det sier det kommer fra, at
tittel, type, virksomhet, år og lenke er hentet fra korpuset og ikke skrevet
av, og at hver `[n]` i svaret peker på et utdrag som finnes. Svarene,
tenkestegene og nøkkelordene er våre og kan ikke sjekkes av en maskin.

**Ingen sidetall.** Kudos gir ett sammendrag per dokument og ingen sider, og
et sidetall diktet opp fra ingenting er verre enn ingen. NKOM-fikstureringen
beholder sine, så visningen av sidetall fortsatt har noe å tegne.

### Tempo

`VITE_MOCK_SPEED` styrer hvor lang tid mocken bruker:

| Verdi       | Tenkesteg | Første token | Per token | Til hva                   |
| ----------- | --------- | ------------ | --------- | ------------------------- |
| `fast`      | 0,5 s     | 0,3 s        | 18 ms     | e2e-suiten                |
| `realistic` | 1,1 s     | 3,8 s        | 25 ms     | **standard**, å se på     |
| `slow`      | 2,5 s     | 7 s          | 60 ms     | å se hardt på én tilstand |

Standarden er den trege med vilje: en mock som svarer med én gang kan ikke
vise skjelettet, tenkepanelet eller strømmingen, som er mesteparten av det det
er å se på. Tallene er ikke plukket ut av lufta — én ekte spørring mot stacken
tok 15,1 sekunder, målt 2026-09-11.

`fast` er ikke null. Testen «avbryt stopper genereringen» trenger et svar som
fortsatt er på vei når stoppknappen trykkes, og på null er alt over før testen
rekker å trykke. En mock som strømmer momentant strømmer ikke.

## Ekte backend

`VITE_API_MODE=live` bytter `createChatClient()` fra mock til `LiveChatClient`.
Kopier `.env.example` til `.env.local` og fyll inn nøkkelen:

```sh
KA_API_URL=http://localhost:8080
KA_API_KEY=rag_…
```

**`VITE_API_MODE` skal ikke stå i `.env.local`.** Alle Vite-servere fra samme
sjekkout leser den samme fila, så en live-modus lagt inn der slår inn for alle
som kjører i treet. Sett den på kommandolinja for den ene kjøringen som skal
bruke ekte backend:

```sh
VITE_API_MODE=live npm run dev
```

### Hvilket korpus

`VITE_KA_TENANT` og `VITE_KA_DATASET_CONFIG_KEY` peker live-modus på et bestemt
datasett. De er **valgfrie**, og er de ikke satt skjer det som før: backenden
velger selv, som på den lokale stacken er demokorpuset.

```sh
VITE_API_MODE=live VITE_KA_TENANT=demo VITE_KA_DATASET_CONFIG_KEY=kudos-pilot npm run dev
```

De har `VITE_`-prefiks fordi de **skal** nå klientkoden, og det er greit: dette
er navn på datasett, ikke hemmeligheter. Nøkkelen er en annen sak og blir hos
proxyen.

**Begge eller ingen.** Backenden bygger datasett-scopet med
`(when (and tenant dataset_config_key) …)` i
`server/src/digdir/mcp/tools.clj`, så én alene blir forkastet der og svaret
kommer fra standardkorpuset. Da ville en halvkonfigurert frontend se ut som den
sto på pilotdatasettet og svare fra demodataene, uten at noe nedstrøms kunne se
forskjell. Klienten dropper derfor en enslig verdi og skriver en advarsel i
konsollen. Se `datasetArguments()` i `src/api/live/mcp.ts`.

På tråden sendes de som `tenant` og `dataset_config_key` i `tools/call`-
argumentene, ved siden av `query`.

### Flere korpus å velge mellom

`VITE_KA_DATASETS` lister korpusene denne oppsettinga når, og gjør korpus til
et **kjøretidsvalg**: leseren bytter uten at dev-serveren startes om.

```sh
VITE_KA_DATASETS="norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos-pilot|5 årsrapporter"
```

Semikolon mellom oppføringene, `=` før navnet, og en valgfri `|` før en
beskrivelse. Bare den første `=` deler, så navnet kan inneholde parenteser og
mellomrom. En ugyldig oppføring hoppes over med en advarsel i konsollen i
stedet for å ta hele lista med seg.

`VITE_KA_DATASET_CONFIG_KEY` virker som før og betyr nå «hvilket av dem appen
starter på». Er lista ikke satt, er det ett korpus og ingen velger — nøyaktig
som før i dag. Peker nøkkelen på et korpus lista har glemt, legges det til
likevel: en nøkkel som når backenden i dag skal ikke slutte å gjøre det fordi
noen skrev en liste uten den.

Valget ligger i `localStorage` under `ka.corpus.v1` og leses av klienten når
den bygger hver forespørsel — ikke én gang ved oppstart, for da ville et bytte
ikke nådd backenden før sida ble lastet på nytt.

**En tråd hører til korpuset sitt.** Svarene i den siterer dokumenter som bare
finnes der, så et bytte starter en ny tråd i stedet for å flytte den gamle.
Korpuset lagres på selve tråden, som `corpus:<nøkkel>` i `tags` på samtalen —
målt mot kjørende stack 21.09: backenden tar imot `tags` på `POST` og gir dem
tilbake på både liste og enkeltoppslag.

I mock-modus finnes ett korpus («Kudos, 938 dokumenter (mock)») og ingen
velger. Views leser det hele gjennom `useCorpus()` i `src/layout/`:
`{ options, active, option, choosable, set }`, der `option` bærer etikett og
beskrivelse for det aktive korpuset.

### Hva korpuset kaller filterdimensjonene

Filterpanelet tegner tre dimensjoner — «Dokumenttyper», «Virksomheter» og
«År» — mens backendens filter vil ha korpusets egne feltnavn. De er
forskjellige fra korpus til korpus, og **den oversettelsen er kunnskap om et
korpus, så den er konfigurasjon og ikke kode**. Ingen feltnavn står i `src/`.

```sh
VITE_KA_FILTER_FIELDS="kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer"
```

Semikolon mellom datasettene og `=` etter datasettnøkkelen, som i
`VITE_KA_DATASETS` — de to variablene beskriver de samme datasettene og skal
ikke kreve to grammatikker. Inne i ett datasett: `|` mellom dimensjonene og
`:` inne i én, som `dimensjon:felt` eller `dimensjon:felt:verditype`.
Dimensjonene heter `documentType`, `organisation` og `year`, og verditypen er
`integer` eller `string`. En ugyldig eller gjentatt oppføring hoppes over med
én advarsel i konsollen.

**Verditypen godtas ikke fritt, og det er med vilje.** `format-filter-value` i
backendens `rag/filters.cljc` sammenligner typen med den ene strengen
`integer`; alt annet — en type den aldri har hørt om like mye som `string` —
faller gjennom til å sitere verdien som en streng. En feilstavet `integr` blir
altså ikke avvist der borte. Den blir stille lest som streng, Typesense får et
sitert tall på et tallfelt, og leseren får 0 treff på et spørsmål korpuset kan
svare på. Skrivefeilen må tas her, for det eneste stedet nedstrøms som kunne
tatt den, tar den ikke.

**En dimensjon uten oppføring sendes ikke, og gjettes aldri.** Et gjettet
feltnavn er et filter på et felt Typesense ikke har, og leseren ville sett
«ingen treff» for et korpus som har dokumentene. Det samme gjelder et datasett
som ikke er beskrevet, og live-modus uten `VITE_KA_TENANT` og
`VITE_KA_DATASET_CONFIG_KEY`, der backenden velger datasett selv og ingenting
på denne sida vet hvilket.

**`verditype` er påkrevd for tallfelt.** Målt mot hele Kudos-korpuset
2026-09-24: `concerned_years = 2024` uten den gir 0 treff, fordi Typesense
avviser et sitert tall på et tallfelt. Verdiene sendes fortsatt som strenger —
typen står ved siden av dem.

På tråden blir valget til backendens eget filterformat, i
`tools/call`-argumentene ved siden av `query`:

```json
{
  "overrides": {
    "retrieve-filter-by": {
      "fields": [
        { "field": "type", "selected-options": ["Årsrapport"] },
        { "field": "concerned_years", "selected-options": ["2024"], "value-type": "integer" }
      ]
    }
  }
}
```

Flere felt AND-es, flere verdier i samme felt OR-es. Er ingenting huket av,
sendes ingen `overrides` i det hele tatt: tomt valg er «hele korpuset», mens
et tomt override ville overstyrt det datasettet selv er satt opp med.

Se `src/api/filterFields.ts` for konfigurasjonen og `filterArguments()` i
`src/api/live/mcp.ts` for trådformatet.

**Filteret når bare fram med en patchet backend.** Rettelsene som får det til
å virke ligger på grenen `fix/mcp-retrieve-filter-by` i headless-rag, som ikke
er sendt inn ennå. Mot headless-rag fra `main` sendes filteret, men gjør
ingenting. Hva som var galt står på den grenen; her ville lista blitt foreldet
neste gang den endrer seg.

**Fasettene i live teller vår egen server** fra Typesense, fordi backenden
ikke har noe fasett-API (`server/facets.ts`, «Fasettene i filterpanelet» i
`docs/deploy.md`). Uten Typesense-variablene sier panelet «Filtrering er ikke
tilgjengelig ennå», som før.

### Tråder i live-modus

Trådlista og lagringen kommer fra `/api/conversations`, målt mot kjørende
stack 2026-09-16.

**Frontenden oppretter samtalen selv** før den spør, og det er ikke det
billigste. `tools/call` lager en samtale på egen hånd hvis den ikke får en
`conversation_id` — men den eier den med **API-nøkkelens `client-id`**, mens
`GET /api/conversations` lister på `X-User-Id`. En tråd laget den veien blir
altså aldri synlig i lista, og ligger i en bøtte delt med alle andre som
bruker nøkkelen. Opprettet av oss bærer den vår id og vår tittel, og
`tools/call` skriver turene inn i den når den får id-en med. Målt: eier og
emne overlevde turen.

**Bruker-id-en er en plassholder.** Uten innlogging lager
`src/api/live/userId.ts` en tilfeldig id og husker den i `localStorage` under
`ka.user.v1`. Den er ikke en hemmelighet og beviser ingenting: hvem som helst
med API-nøkkelen kan sende hvilken som helst id og lese den brukerens
samtaler. Den finnes for at én nettleser skal se sine egne tråder og ikke alle
trådene nøkkelen har laget. Bak testmiljøets innlogging bytter serveren den ut
med den innloggede brukeren (`server/identity.ts`, «Innlogging» i
`docs/deploy.md`). Fila kan gå den dagen klienten bare kjører bak innlogging.

**Agent-id-en utledes av verktøynavnet.** Samme agent har to skrivemåter, og
bare én virker hvert sted: `builtin.agent-rag-agent__agent-rag-graph-bundled`
navngir verktøyet, `builtin/agent-rag-agent` navngir agenten. `POST
/api/conversations` krever `agent-id` så snart nøkkelen når mer enn én agent.
Se `agentIdFromToolName()`.

**Dette mangler backenden, og frontenden later ikke som noe annet:**

- **Ingen utdrag lagres.** Et svar lest tilbake kom med `chunks: []` selv om
  turen hadde hentet fem. Feltet finnes i API-et, men er tomt. Tråden viser
  derfor teksten uten kilder — og `[n]`-markørene i den peker på ingenting.
- **Ingen `updated`.** Samtalen har bare `created`, så trådlista grupperer på
  da den ble laget. En samtale besvart i dag, men startet forrige måned,
  havner under forrige måned.
- **Systemledeteksten lagres som en melding.** «You are a helpful assistant.»
  er første melding i hver samtale og filtreres bort.

### Nøkkelen

`KA_API_URL` og `KA_API_KEY` har **ikke** `VITE_`-prefiks, og det er poenget:
Vite eksponerer bare `VITE_`-variabler for klientkoden, så nøkkelen kan ikke
havne i bundlen ved et uhell. Dev-serveren er proxyen som setter
`X-API-Key`, og klienten snakker bare med `/api` på samme opphav.

**Det er ikke en preferanse.** Backenden svarer `401` på en CORS-preflight og
sender ingen `Access-Control-*`-headere i det hele tatt, så en nettleser ville
nektet å gi koden svaret uansett. I produksjon må en ekte tjener gjøre den
samme jobben, med logging, rate limiting og verktøynavnet låst der.

### Målt mot kjørende stack 2026-09-11

Tre ekte spørringer mot `localhost:8080`, agenten
`builtin.agent-rag-agent__agent-rag-graph-bundled`:

- **Svaret strømmer ikke.** Alle `response/chunk`-deltaene denne agenten
  sender er dens egen plan i jeg-form, og hver serie følges av en
  `agent/thinking` med de samme ordene. Selve svaret kommer helt i
  sluttrammen. Derfor holdes deltaene tilbake til noe sier hva de var: en
  `agent/thinking` etterpå beviser at de var planen, og de forkastes; ellers
  slippes de ut som svartekst. Klienten er dermed riktig i dag og riktig igjen
  den dagen en agent faktisk strømmer svaret, uten at viewene endres.
- **`[n]` treffer utdrag `n-1`.** Verifisert: svaret bar `[1][4][2][1][3]` mot
  seks utdrag i to dokumenter.
- **Utdragsteksten er tom.** `structuredContent.chunks` bærer id, tittel og
  lengde, aldri passasjen. Feltet er merket i `Excerpt`.
  API-bestilling A1.
- **Relevans er utledet av rekkefølgen**, ikke målt. Serveren sender ingen
  poengsum, men rangerer utdragene, så posisjonen er det eneste signalet.
- **Overskriftsstien parses ut av en Clojure-streng**, ikke et objekt, selv om
  skjemaet sier `object`. «Birkebeinerne › Kong Sverre».
- **Fasettene kommer ikke fra backenden** i live-modus, som ikke har noe
  fasett-API. Vår egen server teller dem fra Typesense til den har.

## Views og plasser i kode

Et **view** er en komponent som tar `SlotViewProps` (`src/layout/viewModel.ts`)
og ikke noe annet. Alle fire tar de samme propene, så et view kan monteres i
hvilken som helst plass uten at skallet vet hva det er:

| Prop                   | Hva                                                           |
| ---------------------- | ------------------------------------------------------------- |
| `view`                 | hvilket view skallet tegner. Kan ignoreres                    |
| `collapsed`            | om plassen viewet står i er kollapset                         |
| `onCollapsedChange`    | be plassen kollapse eller åpne                                |
| `activeCitationNumber` | hvilken `[n]` brukeren sist ba om å få se                     |
| `activeCitationNonce`  | teller opp ved hver forespørsel, også når tallet er det samme |
| `siblingViews`         | de andre viewene i samme plass, å veksle til                  |
| `onShowView`           | be plassen vise et annet view den holder                      |
| `switchedByUser`       | om brukeren vekslet hit, eller om sida bare åpnet her         |

**Plassen eier kollapset/åpen, ikke viewet.** Et view som skjulte seg selv
ville etterlate knappen som lyver om sin egen tilstand.

Nonce-en finnes fordi to klikk på samme `[n]` ikke endrer tallet. Uten den
kunne kildepanelet ikke se at det ble spurt en gang til.

**`switchedByUser` finnes fordi et view ikke kan se forskjell på «brukeren
vekslet hit» og «sida ble lastet».** Begge er en første montering, og
standardlayouten åpner på filter (spørsmål 1). To view i samme plass er
moduser av ett panel: veksler du, avmonteres knappen du trykte på, og fokus
faller til `document.body`. Viewet som kommer opp må ta det tilbake, men bare
når noen faktisk ba om det. Å ta fokus ved sidelasting ville hoppet forbi
hopp-lenka.

Bare layouten vet forskjellen, for det er bare layouten som blir bedt om å
veksle. `LayoutProvider` husker hvilket view brukeren sist vekslet hver plass
til, og `isSwitchedByUser()` sammenligner det med viewet som faktisk står der,
så en forespørsel som ikke endret noe heller ikke gir fokus. Det ligger
bevisst **utenfor** `Layout`: det sier hvordan layouten kom hit, ikke hva den
er, og skal ikke lagres den dagen en layout blir husket.

Koblingen mellom svaret og kildene går gjennom `useCitation()`: chat-viewet
kaller `showCitation(n)`, kildepanelet leser `activeCitation`. De to viewene
importerer aldri hverandre, og det er nettopp det som gjør at hvert av dem kan
flyttes til en annen plass.

`src/layout/viewComponents.ts` sier hvilken komponent som tegner hvilket view.
Når et view er bygget, er det den ene linja som endres.

### Scroll

**Hovedkolonnen eier scrollen**, ikke viewet som står i den. Et view som skal
følge et svar som vokser, eller tilby «bla til nederst», bruker
`useMainScroll()` og får `ref` til elementet pluss `scrollToBottom()`. Ikke gå
opp i DOM-treet etter `.main`: det virker helt til viewet monteres et annet
sted, og da finner det feil element eller ingenting.

`ref.current` leses i en effekt eller en hendelseshåndterer, aldri under
render.

### Overskriftsnivåer

`Markdown` starter på nivå 2, så `#` blir nivå 2, `##` nivå 3 og `###` nivå 4
under sidetittelen. Starter et svar på `##`, hopper dokumentet fra nivå 1 til
3 med mindre noe annet tegner en nivå 2 imellom. Hev `startLevel` bare når
svaret ligger under en egen overskrift.

## Kildehenvisninger

Avgjort 2026-09-11. **Et `[n]` i svaret peker på et UTDRAG, ikke på et
dokument.** Det stemmer med backenden, der `[n]` er 1-indeksert inn i
`structuredContent.chunks`.

- Markøren tegnes som hevet skrift og er en lenke til `#excerpt-n`.
- Id-en bygges av `excerptDomId(n)` i `src/model/source.ts`, av begge sider.
  Ingen bygger strengen selv.
- Markørens tilgjengelige navn er `Kilde 3: Årsrapport Nkom 2022, side 41`,
  fra `citationAccessibleName()`. «[3]» alene sier en skjermleserbruker
  ingenting om hvor lenken går.
- `citationTargets(documents)` gir hele lista ferdig til `<Markdown citations=…>`.
- En markør uten utdrag blir stående som ren tekst. Det er riktig oppførsel
  når modellen siterer noe som ikke finnes.

Merk at et utdrag kan mangle `citationNumber`: søket finner mer enn svaret
bruker, og «10 treff» ved siden av fem kilder er derfor riktig, ikke en feil.

## Ikoner

`@navikt/aksel-icons` følger med Designsystemet, men er pinnet eksplisitt her
så en import ikke er avhengig av hvordan npm hoister. Pakken er ES-moduler med
`sideEffects: false`, så bare ikonene som brukes havner i bundlen: **målt
+1,99 kB for to ikoner**, mot flere megabyte om pakken ikke var ristet.

Importer alltid fra `src/components/icons.ts`, aldri fra pakken direkte. Den
fila er det ene stedet leverandørens posisjonsnavn får stå, og den døper dem om
til våre. Se kommentaren i fila.

## Mørk modus

**Avgjort 2026-09-11: KA leverer mørk modus**, rett fra Digdir-temaets
tokens. Temaet har allerede 147 variabler i lys og mørk utgave, så kostnaden er
å verifisere skjermene, ikke å bygge noe.

`<html data-color-scheme="auto">` følger operativsystemet, og det er
standarden. Det finnes **ingen synlig bryter**, fordi ingen knapp er tegnet.
Bryteren er en konsollkommando:

```js
window.ka.colorScheme.get(); // 'auto' | 'light' | 'dark'
window.ka.colorScheme.set('dark');
window.ka.colorScheme.set('auto'); // tilbake til operativsystemet
```

Valget lagres per nettleser i `localStorage` under `ka.color-scheme`, og leses
av et lite innebygd skript i `index.html` **før første maling**, så sida aldri
blinker i feil modus. Det skriptet og `src/layout/colorScheme.ts` deler to
strenger, nøkkelen og attributtnavnet, og ingenting annet.

Når designeren tegner en knapp, kaller den `set()`. Resten er uendret.

Dette er også grunnen til at ingen farge skrives som heks noe sted: en
hardkodet farge følger ikke `data-color-scheme`, og mørk modus ryker på første
regel som gjør det.

## React Router

**8.3.1, pinnet uten caret** (avgjort 2026-09-11). Samme versjon som
ki.norge.no og Designsystemets egen nettside kjører, så de to
referanseoppsettene og dette repoet er på samme major.

Klientmodus: `BrowserRouter` i `src/main.tsx`, og rutene som `Routes`/`Route`
i `src/App.tsx`. Ingen framework-modus, ingen loaders, ingen
`createBrowserRouter` ennå. Oppsamlingsruta er `path="*"` i sitt eget
ruteoppsett; se «Tråder og adresser».

Oppgraderingen fra 7 til 8 krevde **ingen** endringer i koden vår:
`BrowserRouter`, `Routes`, `Route`, `Outlet` og `useParams` eksporteres
uendret fra `react-router` i 8.3.1. Verifisert både med typesjekk og ved å
laste begge rutene i nettleseren.

Versjonen er pinnet fordi en major i ruteren flytter API. Oppgrader bevisst.

## Designgrunnlaget

Spesifikasjonene ligger **ikke** i dette repoet. De ligger i den lokale
`design/`-mappa i paraplymappa `kunnskapsassistenten/`, som ikke er et
git-repo:

| Fil                                  | Innhold                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `design/visjon-og-beslutninger.md`   | Det som er bestemt, med dato                                                            |
| `design/skal-dette-implementeres.md` | Spørsmålsliste med fasit, og bygg-rekkefølgen for første versjon                        |
| `design/designsystemet/`             | Designsystemet kartlagt fra kildekoden: alle 42 komponenter, oppsett, behov → komponent |
| `design/omraader/`                   | Figma-spesifikasjoner per område                                                        |
| `design/tema/`                       | Temaoppsettet dette repoet er kopiert fra                                               |

Start i `design/INDEX.md`.
