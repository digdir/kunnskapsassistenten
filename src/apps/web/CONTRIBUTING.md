# Bidra til kunnskapsassistenten-frontend

Kortversjonen av byggereglene. Fullversjonen er `design/_briefs/bygg/regler.md`
i Lars sin lokale `design/`-mappe, og den er fasit der de er uenige.

## Navn

Dette er den regelen det er lettest å bryte og dyrest å rette.

- **Engelsk:** kode, filnavn, mapper, CSS-klasser, CSS-variabler, typer, ruter,
  kommentarer.
- **Norsk bokmål med ekte æøå:** alt brukeren ser eller hører. UI-tekst,
  `aria-label`, `title`, feilmeldinger, `lang="nb"`. Også `README.md` og denne
  fila.
- **Plasser heter etter posisjon, views etter innhold**, som i VS Code.
  Plassene er `primary-sidebar`, `main` og `secondary-sidebar`. Viewene er
  `threads`, `filters`, `chat`, `sources`.
- **En plass har aldri en fast `aria-label`.** Navnet kommer fra viewet som
  står der, via `slotLabel()` i `src/layout/viewModel.ts`.
- **Ingen «venstre», «høyre», `left` eller `right` noe sted**, heller ikke i
  kommentarer. Kjør `grep -rin 'venstre\|høyre\|left\|right' src` før du
  pusher; det skal ikke gi treff utenom CSS-logiske egenskaper som
  `padding-inline` og **`src/components/icons.ts`**, som er den ene tillatte
  grensa mot leverandørens egne ikonnavn og døper dem om til våre.
- **Importer ikoner fra `src/components/icons.ts`**, aldri fra
  `@navikt/aksel-icons` direkte.

Se [README, Naming](README.md#naming) for begrunnelsen.

## Eierskap etter mappe

Rør aldri en mappe du ikke eier. Trenger du noe der, meld behovet til
dirigenten, som gir det til eieren.

| Mappe                                                                                        | Eier              |
| -------------------------------------------------------------------------------------------- | ----------------- |
| `src/api/`, `src/model/`, `src/layout/`, `src/components/`, `vite.config.ts`, `package.json` | grunnmur          |
| `src/routes/`, `src/App.tsx`, `src/main.tsx`                                                 | grunnmur (#5)     |
| `src/views/threads/`, `src/views/filters/`                                                   | primary sidebar   |
| `src/views/chat/`                                                                            | main              |
| `src/views/sources/`                                                                         | secondary sidebar |
| `docs/review/`                                                                               | anmelder          |

- **Bare grunnmuren legger til avhengigheter.** Andre melder behov.
- Delte typer bor i `src/model/`. Kod mot dem, be om endringer.
- Før grunnmuren er merget: bruk mock-data fra `src/api/mock/`, eller egne
  fixtures i din egen mappe.

## View-hodet: det som står stille mens resten ruller

Hver plass har én **view-hode-plass**, øverst i den rullende regionen, eid av
skallet (`src/layout/ViewHead.tsx`). Et view fyller den:

```tsx
<ViewHead>
  <Button onClick={() => onShowView('threads')}>Tråder</Button>
  <PanelHeader title="Filtrering" />
</ViewHead>
```

**Ikke lag ditt eget `position: sticky` i toppen av et panel.** Et klebrig
hode dekker alt som ligger over det i samme rullende boks, og «over» gjelder
tab-rekkefølgen også: nettleseren ruller en kontroll som får fokus til toppen
av regionen, som er nøyaktig der hodet står. Kontrollen lander under hodet,
klikkene havner på hodet og fokusringen er usynlig (WCAG 2.4.11). Målt i
PR #55, der «Tråder»-knappen ble uklikkbar av et view-lokalt hode.

Derfor plasserer skallet boksen først i regionen, og et view som vil ha en
knapp stående legger **knappen i hodet** i stedet for over det. Skriv
`ViewHead` først i viewet, så er DOM-rekkefølgen og tab-rekkefølgen den samme.
Skallet setter også `scroll-padding-block-start` lik hodets høyde, så
`scrollIntoView` og fokus stopper under det.

Ett hode per plass. To views i samme plass er moduser av ett panel, og bare
ett av dem er montert om gangen. Et tomt hode tegner ingen strek
(`.view-head:empty`). Utenfor skallet — preview-sidene, de fleste unit-testene
— tegnes hodet der det står.

## Designsystemet først, alltid

Bygg aldri en komponent Designsystemet allerede har. Det koster dyrt å rette
senere.

1. Slå opp behovet i `design/designsystemet/behov-til-komponent.md`.
2. Les komponenten i `design/designsystemet/komponenter/<navn>.md`.
3. Først da, hvis Designsystemet ikke har noe: egen konstruksjon, med
   semantikk og tastaturstøtte fra dag én.

- **Ingen hardkodede farger, størrelser eller fonter.** `var(--ds-*)`.
  Tallverdier fra `design/tokens/`, aldri fra Figma Dev Mode. Én hardkodet
  farge er nok til å ødelegge mørk modus, se README.
- Egen CSS skrives **utenfor alle layers**, se README.
- **Setter du `display` på noe som kan skjules med `hidden`, må du skrive
  `[hidden] { display: none }` selv.** Egen CSS ligger utenfor layers og slår
  nettleserens egen `[hidden]`-regel, så elementet blir stående synlig mens
  knappen sier at det er skjult. Målt i skallet.
- Hover, fokus og tastaturfokus **arves** fra Designsystemet og tegnes ikke
  selv. Trenger et eget element fokusring, bruk klassen `ds-focus--visible`.

### Color-mode: accent på rot, neutral på kromet

`data-color="accent"` står på `<body>`. Det gjelder de **interaktive** rollene
— knapper, rammer som skal trekke blikket, aktive chips, lenketekst — og de
skrives med rolletokens uten familie: `var(--ds-color-base-default)`,
`var(--ds-color-text-subtle)`.

**Kromet skrives med eksplisitt neutral-familie.** Brødtekst, skjemarammer,
flater og bakgrunner:

```css
color: var(--ds-color-neutral-text-default);
border-color: var(--ds-color-neutral-border-subtle);
background: var(--ds-color-neutral-surface-default);
```

Grunnen står i `design/tokens/figma-til-tokens.md` punkt 8.2: med accent på
rot og bare rolletokens blir brødteksten mørk marine (#002c54) og
skjemarammene blå (#2a7cc5). Det har ingen tegnet, og det er ikke det
designet viser.

## WCAG 2.x AA er et krav

Ikke et mål. Offentlig sektor og uu-kravene. Enhver snarvei som gir utseende
uten tilgjengelighet er utelukket.

- `npm run lint` kjører `jsx-a11y`-reglene som feil, ikke advarsler. Skal en
  regel fravikes, skriv `// oxlint-disable-next-line <regel>` med én linje om
  hvorfor fraviket er det tilgjengelige valget. Det finnes ett i dag.
- Ikonknapper må ha `aria-label`.
- **En kontroll som forsvinner av handlingen sin må si hvor fokus skal.**
  «Prøv igjen», «Lukk», «Slett», «Vis mer» som avmonterer seg selv: fokus
  faller til `<body>`, og neste Tab starter på nytt på hopp-lenka, en hel side
  unna det brukeren holdt på med. WCAG 2.4.3. Flytt fokus til det handlingen
  lagde, ikke til toppen av sida. `ErrorState` tar det som `focusAfterRetry`,
  en ref til lista eller svaret som kom; uten den lander fokus på
  varselregionen, som holder tab-rekkefølgen men ikke sier noe.
- Landemerker og overskriftsnivåer skal henge sammen.
- Kjør appen headless og ta et accessibility-snapshot av det du bygde før du
  melder ferdig. Skjermbilde til
  `design/skjermbilder-frontend/<branch>-<slug>.png`.

## TypeScript

`strict: true` står i begge tsconfig-ene. Ikke slå den av, og ikke legg inn
`any` for å komme rundt den.

## Git og PR

- Branch `feat/<område>` fra `main`. Små commits.
- Commit-melding på **norsk** med ekte æøå, trailer
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Push til origin, **åpne PR som draft tidlig**, og oppdater den.
- **Aldri merge.** Lars merger. Rebase på `main` når dirigenten sier det.
- PR-beskrivelsen dekker **kun** det som er i PR-en. Kort. Ingen
  AI-attribusjon, ingen «oppfølging» eller «test-plan» — sånt sier du til
  dirigenten.
- Kommentarer i egen PR er greit. Ingen andre GitHub-poster uten ja fra Lars.

## Grønt før push

```sh
npm run build
npm run lint
npm run format:check
npm run test
npm run tokens:verify
```

Alle fem, hver gang.

## Hooks: det maskinen sjekker for deg

`npm install` setter opp to git-hooks (`simple-git-hooks`, via `prepare`).
De erstatter ikke lista over — de fanger det billigste av den før du rekker
å glemme det.

| når          | hva                                                                                                    | målt                              |
| ------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `git commit` | bare de **stagede** filene: `stylelint` på `.css`, `oxlint` på `.ts`/`.tsx`, `prettier --check` på alt | 0,9 s for to filer, 1,8 s for sju |
| `git push`   | `tsc -b`                                                                                               | 3 s varm, 8,6 s første gang       |

`stylelint` her er kompatibilitetsregelen: den stopper en commit med en
CSS-egenskap nettleserne i `.browserslistrc` ikke støtter. Det var det den
ble installert for — en uprefikset `line-clamp` stoppes på 1,9 sekunder, med
nettleser og versjon i meldinga.

**Vitest er ikke i hookene**, og det er et valg med et tall bak: suiten tar
47,9 sekunder, fjorten ganger `tsc`. En hook som legger et minutt på hver
push er en hook folk slår av, og da mister vi `tsc` også. Suiten kjøres av
deg før push (lista over) og av CI på hver PR.

**Hookene er delte mellom arbeidstrærne.** Vi har hver vår `.git`-fil, men de
peker på den samme `commondir`, og det er den git leter i etter hooks — så en
`npm install` i ett arbeidstre setter dem opp for alle. Det gjelder også
arbeidstrær som står på en gren fra før verktøyet fantes, og det var en ekte
smell: den første utgaven kjørte `lint-staged` rett fra hooken, og de andre
kunne ikke committe i det hele tatt (23.09).

Derfor sjekker hookene at verktøyet finnes før de bruker det:

| situasjon                                              | hva hooken gjør                      |
| ------------------------------------------------------ | ------------------------------------ |
| verktøyet er der                                       | kjører, som i tabellen over          |
| `package.json` kjenner det, men `node_modules` mangler | stopper og sier «kjør `npm install`» |
| grenen kjenner det ikke                                | går videre, uten en lyd              |

Den siste raden er poenget: en gren som ikke har bedt om hooken skal ikke
stoppes av den.

Hopp over i nød:

```sh
git commit --no-verify
git push --no-verify
```

Det er en nødutgang og ikke en snarvei: CI kjører alt likevel, så det du
hopper over her møter deg der.

## Delte ressurser

- Dev-server: 5173 er grunnmurens. Primary sidebar bruker 5174, main 5175,
  secondary sidebar 5176 (`--port`). Sjekk
  `lsof -nP -iTCP -sTCP:LISTEN | grep 517` før du starter, og **stopp etter
  deg**.
- Ingen nettleservinduer på skjermen. Headless.
- Ikke rør RAG-stacken (8080 og 3030). Les, ikke restart.

## Spesifikasjonene

- `design/omraader/september-2026/` er **fasit**.
- `design/omraader/molecules/` og `organisms/` for komponentdetaljer.
- `design/svar-skjema.md` og `design/visjon-og-beslutninger.md` for
  beslutninger.
- `design/skal-dette-implementeres.md` for hva som er ja, senere og nei, og
  for bygg-rekkefølgen.
