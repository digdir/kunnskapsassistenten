# Review: `feat/primary-sidebar` (PR #3), 2026-09-11

Anmeldt commit `ca5d59e` («Merge remote-tracking branch 'origin/main'»), som er
PR-hodet nå. Grunnlaget er `main` `d535558`, altså med grunnmurens PR 1–3 inne.

Diffen mot `main` rører bare `src/views/filters/` og `src/views/threads/`,
881 linjer i ti filer. Ingen andres mapper.

**Konklusjon: ikke klar. To blokkerende, fem bør, fire kan.** Begge de
blokkerende er verifisert i nettleser og er billige å rette. Alt annet i
PR-en er målt mot fasiten og stemmer.

## Portene

| Port                    | Resultat                   |
| ----------------------- | -------------------------- |
| `npm run build`         | grønt                      |
| `npm run lint`          | grønt, null funn           |
| `npm run format:check`  | grønt                      |
| `npm run test`          | grønt, 65 tester i 9 filer |
| `npm run tokens:verify` | grønt                      |

## Slik er det målt

Viewene er ikke montert noe sted: `src/layout/viewComponents.ts` peker
fortsatt på `ViewPlaceholder` for alle fire, og den fila er grunnmurens. For å
få viewene på skjermen er `threads` og `filters` koblet til i en **lokal,
ucommittet** endring i arbeidstreet. Trådlista er målt med `activeView` midlertidig
satt til `threads`, siden `defaultLayout` starter på `filters` (svar 1).
Begge endringene er tilbakestilt etterpå.

`docs/review/tools/a11y.sh` på `/` og `/threads/nkom-maaloppnaaelse`, i lys og
mørk modus, 1440 × 900. Interaksjonene er kjørt med playwright-cli mot samme
dev-server.

## Blokkerer

### 1. Fokus faller til `<body>` på fire knapper

`src/views/filters/FacetField.tsx:123` («Velg alle»),
`src/views/filters/FacetField.tsx:134` («Tøm»),
`src/views/filters/FiltersView.tsx:66` («Tråder»),
`src/views/threads/ThreadsView.tsx:73` («Filtrer dokumenter»).

Alle fire er betinget rendret på en tilstand som knappen selv endrer. «Velg
alle» vises bare når `!allChosen`, og klikket gjør `allChosen` sann; «Tøm»
vises bare når `chosen > 0`, og klikket setter den til null; modusknappene
bytter ut hele viewet de står i. React tar knappen ut av DOM-en i samme
render, og fokus faller til `document.body`.

Målt, alle fire:

```
klikk «Velg alle dokumenttyper» → fokus body
klikk «Tøm dokumenttyper»       → fokus body
klikk «Tråder»                  → fokus body
klikk «Filtrer dokumenter»      → fokus body
```

For en tastaturbruker betyr det at hvert eneste filtervalg kaster dem tilbake
til toppen av dokumentet, og at de må tabbe forbi hopp-lenka, panelknappen og
alt over igjen for å komme til neste nedtrekk. WCAG 2.4.3 Fokusrekkefølge (A).

Dette er samme feilklasse som de tre blokkerende i PR #2: en handling flytter
noe på skjermen uten å ta ansvar for hvor fokus havner.

**Rett slik:** flytt fokus bevisst i samme hendelseshåndterer. For
`FacetField` er `inputRef.current?.focus()` det naturlige målet — feltet står
rett under knappen, og det er der brukeren skal videre. For modusknappene:
det nye viewet har et selvsagt første element (søkefeltet i trådlista,
«Tråder»-knappen i filteret), og det kan ta fokus i en effekt som ser at
viewet nettopp ble montert.

### 2. Treffantallet i trådsøket kunngjøres ikke

`src/views/threads/ThreadsView.tsx:107–113`.

```tsx
{
  trimmed && (
    <Paragraph asChild data-size="sm">
      <output id={searchStatusId}>…</output>
    </Paragraph>
  );
}
```

`<output>` har implisitt `role="status"`, altså `aria-live="polite"`. Området
monteres samtidig med teksten sin, og en skjermleser kunngjør bare innhold som
dukker opp **inne i** et område som allerede fantes. Første søk sier derfor
ingenting. Målt: elementet finnes ikke i DOM-en før det er skrevet noe, og
forsvinner helt igjen når feltet tømmes.

Repoet dokumenterer allerede den riktige formen, i `src/components/ErrorState.tsx:18–22`:
beholderen rendres permanent, og bare innholdet kommer og går. Dette viewet
gjør det motsatte.

WCAG 4.1.3 Statusmeldinger (AA). `aria-describedby` på søkefeltet redder det
ikke: en beskrivelse som endrer seg mens fokus står stille, leses ikke opp av
NVDA eller JAWS.

Samme mønster på de to lastemeldingene, `ThreadsView.tsx:120` og
`FiltersView.tsx:79`. Der er skaden mindre, siden de står der ved første
maling, men `aria-busy` på beholderen er det som faktisk virker når
`Skeleton` er `aria-hidden`.

**Rett slik:** render `<output>` alltid, og la teksten være tom når det ikke
er noe å si.

## Bør

### 3. `ArrowLeftIcon` importeres rett fra `@navikt/aksel-icons`

`src/views/filters/FiltersView.tsx:2`.

`regler.md` sier at ikoner med posisjon i navnet — ArrowLeft er nevnt
eksplisitt — skal gå via `src/components/icons.ts` under et rollenavn, så
posisjonsordet står ett sted. `FunnelIcon` og `PencilWritingIcon` i
`ThreadsView.tsx:2` er riktige som de er; de har ingen posisjon i navnet.

`icons.ts` er grunnmurens fil og eksporterer i dag bare de tre
Sidebar-ikonene. Dette krever derfor en linje fra #5:
`ArrowLeftIcon as BackIcon`. Meldt videre til dirigenten.

### 4. Bredderegelen for nedtrekkslista er global

`src/views/filters/filters.css:70`:

```css
.ds-suggestion > u-datalist {
  width: min(26rem, calc(100vw - var(--ds-size-8)));
}
```

Fila importeres fra komponenten og havner utenfor alle layers, så regelen
treffer **hver** `Suggestion` i hele appen, også de andre eiere bygger.

Begrunnelsen i kommentaren, at lista ligger i top layer uten posisjonert
stamfar, gjelder plasseringen, ikke selektoren: elementet blir værende i
DOM-treet når popoveren åpnes. Målt på siden nå treffer
`.filters-view .ds-suggestion > u-datalist` 3 av 3.

Bredden selv er riktig. 26rem er den eneste tallverdien i PR-en, den er
begrunnet i en kommentar, og det finnes ingen token å bruke i stedet:
`--ds-size-30` (120 px) er den største i temaet, og 416 px har ingen token.

### 5. Overskriftsnivåene i dokumentlista henger ikke sammen

`src/views/filters/DocumentsList.tsx:24`, `:27` og `:35` gir
h3 «Dokumenter» · h4 «Fra Kudos» · h3 «Dine dokumenter».

«Dine dokumenter» blir dermed søsken av «Dokumenter», ikke av «Fra Kudos».
Fasiten (`design/omraader/september-2026/venstre-sidepanel/skjermer/left-sidebar-1497-2.md`)
har `DocumentsList` som én kolonne der «Dokumenter» står over begge. axe
fanger det ikke, siden h4 → h3 ikke er et hopp nedover.

«Dine dokumenter» skal være `level={4}`.

### 6. «Ny tråd» får `aria-current="page"` på forsiden

`src/views/threads/ThreadsView.tsx:79–84`. Målt på `/`:

```html
<a aria-current="page" class="ds-button active" href="/">Ny tråd…</a>
```

`NavLink` markerer seg selv som gjeldende side når ruta stemmer. «Ny tråd» er
en handling, ikke et sted i navigasjonen, og en skjermleserbruker får vite at
knappen de skal trykke på er siden de allerede står på. Trådradene skal ha
`aria-current` (svar 7) — denne skal ikke.

`Link` fra `react-router` i stedet for `NavLink` er hele rettelsen.

### 7. Første overskrift i DOM er h2, ikke h1

Målt i alle fire kjøringene:

```
h2 «Filtrering» · h3 «Dokumenter» · h4 «Fra Kudos» · h3 «Dine dokumenter» · h1 «Kunnskapsassistenten»
```

Navigasjonspanelet står før `<main>` i DOM-en, så panelets overskrifter kommer
før sidetittelen. En skjermleserbruker som hopper mellom overskrifter møter
fire nivåer under ingenting før h1 dukker opp.

Dette er ikke #2 sin feil alene — `PanelHeader` er grunnmurens og har
`level = 2` som standard, og rekkefølgen er skallets. Men det er PR #3 som
gjør det synlig, siden `ViewPlaceholder` ikke hadde overskrifter. Dette hører
til dirigenten, se under.

## Kan

### 8. To tekster avviker fra fasiten uten at avviket står noe sted

`DocumentsList.tsx:30`: «Dokumentene som er relevante for søket ditt vises
her.» Fasiten har «Dokumentene som er relevant for ditt søk vises her».
Rettelsen er språklig riktig — fasiten har en kongruensfeil — men
sjekklista ber om at bevisste avvik fra Figma står der teksten står.

`DocumentsList.tsx:45`: «Opplasting er ikke klar ennå. Når den kommer, tar den
PDF og .docx.» Fasiten har «Kun PDF og .docx for øyeblikket». Her er avviket
begrunnet i komponentens kommentar, men bare for slippsonen, ikke for teksten.

De to utelatelsene som **er** dokumentert — «Velg dokumenter» og slippsonen —
er godt begrunnet og bør stå.

### 9. Valgt trådrad skilles på vekt 500 mot 400

`src/views/threads/threads.css:79–82`. Målt:

| Måling                      | Lys    | Mørk   |
| --------------------------- | ------ | ------ |
| Tekst på valgt rad          | 8,63:1 | 8,40:1 |
| Valgt flate mot panelflaten | 1,64:1 | 1,49:1 |

Tekstkontrasten er god i begge moduser. Flaten skiller seg derimot mindre enn
3:1 fra panelet, så den er ikke i seg selv et pålitelig signal, og da hviler
skillet på `--ds-font-weight-medium` (500) mot 400. Det er en reell forskjell,
men en liten en på 14 px tekst. `--ds-font-weight-semibold` ville gjort den
tydelig uten å koste noe.

Fasiten markerer for øvrig aktiv tråd med **halvfet tekst alene**, ikke med en
flate («Det er en tekstoverstyring, ikke en variant, og ikke en flate»).
Flaten er et tillegg. Den er et godt tillegg, men den bør noteres som et
bevisst avvik.

### 10. «Tidligere tråder» er `xs`, fasiten sier `xxsmall`

Målt: h2 «Tidligere tråder» 21 px (`data-size="xs"`, `PanelHeader` sin
standard), gruppeoverskriftene 18 px (`2xs`). Fasiten gir «Tidligere tråder»
`size="xxsmall"` og seksjonsoverskriftene `size="2xs"`, altså samme størrelse.
Spørsmål 39 («`Heading size="xxsmall"` finnes ikke i koden, hvem retter?») er
ubesvart, så dette er ikke avgjort. Verdt å vite.

### 11. «Vis flere dokumenter» finnes ikke

Svar 8 sier «implementer». Dokumentlista er tom i alle modi i dag, så det er
ingenting å blafre i, og utsettelsen er rimelig. Nevnt så den ikke blir glemt.

## Riktig, og hvor det er sjekket

Dette er verifisert, ikke lest ut av PR-beskrivelsen.

**Grupperingen følger svar 6 nøyaktig.** Målt mot fixturene (0, 0, 3, 4, 6, 7,
12, 18, 26, 48, 83 og 310 dager siden):

```
I dag(2) · Siste 7 dager(3) · Siste 30 dager(4) · Juli(1) · Juni(1) · 2025(1)
```

`daysBetween` runder, så en sommertidsovergang flytter ingen tråd. Åtte tester
dekker grensene.

**Svar 7, trådraden.** `Link asChild` rundt `NavLink`, `aria-current="page"`
settes av ruteren, og markeringen henger på det attributtet. Målt: nøyaktig én
rad bærer `aria-current` etter klikk, og fokus blir liggende på lenka.

**Svar 50, begge funksjonene er med.** Chipsene ligger i `[part=items]` i
`ds-suggestion` sin shadow root, de brytes over flere linjer når verdiene er
lange (feltet vokser fra 84 til 120 px med to virksomheter valgt), og de er
tastaturnåbare: ArrowLeft fra et tomt inputfelt går inn i chipsene, Enter
fjerner én, og fokus flyttes til nabochipen. Annonseringen er norsk:
«Statusrapport, Trykk for å fjerne». `data-sr-*`-overstyringene virker altså.

**Svar 3.** «Velg alle» per dimensjon og treffantall i parentes i lista.
`label` mot `children` på `Suggestion.Option` gjør at chipen leser
«Årsrapport» mens lista leser «Årsrapport (1032)». Målt.

**Svar 5, søkefeltet.** `<search>`-landemerke, `<form>` rundt `Search` så
`Search.Clear` (`type="reset"`) virker. Escape tømmer feltet **og** tilstanden
følger med (12 tråder tilbake). Enter navigerer ikke. Clear gir fokus tilbake
til inputfeltet.

**`data-overscroll="contain"` og `data-autoplacement="false"`.** Målt:
lista 416 px mot feltet 328 px. Uten `data-overscroll` ville lista vært låst
til feltbredden.

**Filtreringen i nedtrekket.** Ikke-treff får `display: none`, «Ingen treff»
vises bare når ingenting matcher, og hele tastaturveien er riktig: Tab til
feltet, skriv, ArrowDown, Enter gir chipen «Nasjonal kommunikasjonsmyndighet»
med verdien `nkom` og beskrivelsen «1 av 6 valgt». Søketeksten tømmes, som
PR-en lover.

**axe: null brudd** i lys og mørk modus, på begge ruter, med begge viewene
aktive. Det ene uavklarte funnet, `aria-required-children` på
`div[part="items"]` inne i `ds-suggestion`, er Designsystemets egen markup.

**Fokusrekkefølgen i trådlista er komplett:** 18 av 18 synlig fokuserbare
elementer nås med Tab, alle med synlig fokusring i begge moduser.

I filterviewet nås 10 av 13. De tre som ikke nås er `Suggestion.Toggle`, som
Designsystemet selv gir `tabindex="-1"`. Funksjonen finnes på inputfeltet
(ArrowDown åpner lista), så det er ikke et tastaturbrudd. Verifisert, ikke
antatt.

**Tokens.** Ingen heksfarger, ingen egen markup der Designsystemet har en
komponent, ingen `!important`, og hver `display`-regel har en
`[hidden]`-regel ved siden av seg. Den ene tallverdien er behandlet under
funn 4.

**Navn.** Engelsk i kode og kommentarer, norsk med ekte æøå i all synlig
tekst og i alle `aria-label`. `grep` etter venstre/høyre/left/right i
`src/views/` gir ingen treff.

## Til dirigenten

- **Spørsmål 4 er fortsatt ubesvart.** #2 har valgt at feltetiketten alltid er
  dimensjonsnavnet og at tilstanden («Alle valgt» / «3 av 6 valgt») står i
  `Field.Description`. Begrunnelsen i koden er god og bør bli Lars sitt svar,
  men noen må si det.
- **`ArrowLeftIcon as BackIcon` må inn i `src/components/icons.ts`** (#5) før
  funn 3 kan rettes.
- **Ingen branch monterer viewene.** `src/layout/viewComponents.ts` peker på
  `ViewPlaceholder` for alle fire på `main`, `feat/primary-sidebar`,
  `feat/chat` og `feat/secondary-sidebar`. Noen må eie den linja per merge,
  ellers merges tre paneler som ikke vises.
- **Første overskrift er h2** (funn 7). Dette er skallets rekkefølge og
  `PanelHeader` sin standard, ikke et view-problem. Enten må sidetittelen
  komme før panelene i DOM, eller så skal panelene ikke være h2.
- **`CONTRIBUTING.md` og `regler.md` er uenige om ikoner.** CONTRIBUTING sier
  «aldri fra `@navikt/aksel-icons` direkte», regler.md sier at bare ikoner med
  posisjon i navnet går via `icons.ts`. Regler.md er fasit. CONTRIBUTING bør
  rettes, ellers får neste arbeider motstridende beskjed.
- **Footer-lenkene «Endringslogg» og «Om prosjektet»** er tegnet i fasiten og
  står som «ja» i `skal-dette-implementeres.md` (rad 107–108), men er ikke
  bygget. Det er allerede notert i `visjon-og-beslutninger.md` som et åpent
  spørsmål til Lars om hvor de skal peke. Ikke et funn mot #2.
- **`--ds-font-size-6`, 21 px mot 30 px**, treffer «Filtrering» direkte og
  venter på #5 sitt tokens-arbeid (funn 10).

## Skjermbilder

`design/skjermbilder-frontend/`:

| Fil                                             | Hva                                               |
| ----------------------------------------------- | ------------------------------------------------- |
| `feat-primary-sidebar-filters--root--light.png` | filter, lys                                       |
| `feat-primary-sidebar-filters--root--dark.png`  | filter, mørk                                      |
| `feat-primary-sidebar-threads--root--light.png` | trådliste, lys                                    |
| `feat-primary-sidebar-threads--root--dark.png`  | trådliste, mørk                                   |
| `feat-primary-sidebar-chips-light.png`          | to virksomheter valgt, chips brutt over to linjer |
| `feat-primary-sidebar-chips-dark.png`           | samme, mørk                                       |

Rådata: `~/.cache/ka-review/runs/feat-primary-sidebar-filters/` og
`~/.cache/ka-review/runs/feat-primary-sidebar-threads/`.
