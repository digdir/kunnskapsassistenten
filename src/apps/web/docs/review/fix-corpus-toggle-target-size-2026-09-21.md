# PR #142, «Vis mer» får 24 px treffhøyde

Branch `fix/corpus-toggle-target-size`, sha `72a3442`, anmeldt 2026-09-21.
Én CSS-fil, `src/views/filters/filters.css`, 43 linjer, de fleste av dem
kommentar.

Knappen «Vis mer om korpuset» i korpuslinja var 47,2 × 21 px. WCAG 2.5.8
(Target Size, Minimum, AA) ber om 24. Høyden var ikke et uhell: en
Designsystemet-`Button` er 42 px på `data-size="sm"` og satte radhøyden, som
er det meste av det filterhodet sparte i #114, så kontrollen ble tegnet som en
`Link` rundt en `button` og ble dermed like høy som linja den står i.

Fiksen lar treffflata vokse og raden stå: `padding-block-end` tar boksen til
24 px, og en negativ `margin-block-end` av samme størrelse gir pikslene
tilbake til layouten.

## Portene

| Port            | Utfall                              |
| --------------- | ----------------------------------- |
| `build`         | exit 0                              |
| `lint`          | exit 0                              |
| `format:check`  | exit 0                              |
| `tokens:verify` | exit 0                              |
| `npm test`      | exit 0, 877 tester                  |
| e2e (4173)      | exit 0, 150 bestått + 1 hoppet over |

E2E-kjøringen var med **utvidet regelsett**, se siste seksjon.

## Funn

Ingen.

## Målt, ikke antatt

Samme script kjørt på `main` og på branchen, 1440 px:

| Mål                               | `main`        | #142          |
| --------------------------------- | ------------- | ------------- |
| knappen, lukket                   | 47,2 × **21** | 47,2 × **24** |
| raden, lukket                     | 21            | **21**        |
| korpuslinjas topp, lukket         | 272,2         | **272,2**     |
| rullevinduet                      | 96 → 772      | **96 → 772**  |
| raden, åpen                       | 63            | 67            |
| avstand knapp → detaljtekst, åpen | 0             | 1             |

Den lukkede tilstanden er uendret på hver piksel. Den åpne vokser 4 px, og
det er `row-gap`-en som holder detaljteksten klar av treffflata — men
**rullevinduet er 772 px i begge tilstander på begge sider**, så de fire
pikslene ligger inne i rulleregionen og koster ingenting av høydebudsjettet.

`elementFromPoint` på begge kanter, i begge tilstander:

| Punkt      | Lukket            | Åpen                               |
| ---------- | ----------------- | ---------------------------------- |
| øvre kant  | `button.ds-link`  | `button.ds-link`                   |
| nedre kant | `button.ds-link`  | `button.ds-link`                   |
| 2 px over  | `select.ds-input` | `select.ds-input`                  |
| 2 px under | `div.view-head`   | `span.filters-view__corpus-detail` |

Knappen eier begge sine egne kanter. Korpusvelgeren ligger 3 px over og er
ikke truffet — som er hele grunnen til at flata bare vokser nedover — og
under kanten er det tekst og en beholder, ingen kontroll å stjele klikk fra.

## Riktig, og hvor jeg sjekket det

- **`row-gap` gir ingen rad når det bare er én rad.** Kommentaren påstår det
  fordi detaljen er `display: none` når den er skjult; målingen viser det:
  raden er 21 px lukket på begge sider.
- **`24px` uten token er riktig nettopp her.** Det er suksesskriteriets eget
  tall og ikke en designverdi. En token som endret seg ville tatt kontrollen
  under 24 px uten at noen mente det, og `tokens:verify` er grønn.
- **Reservevegen er symmetrisk.** Begge erklæringene leser den samme
  egendefinerte egenskapen, så en nettleser uten `lh` gjør begge ugyldige ved
  beregning og faller til `0` — altså dagens linjehøye kontroll, ikke en halv
  fiks med padding og uten margin.
- **Unntaket ble ikke brukt som argument for å la være.** WCAG 2.5.8 har et
  unntak for en kontroll hvis størrelse er bundet av linjehøyden i teksten
  rundt, og det ville trolig dekket denne. Kommentaren sier hvorfor den
  likevel ble rettet, og det svaret er riktig: unntaket beskytter revisjonen,
  ikke leseren med skjelvinger.

## Og det den avdekket

Suiten kjørte med `RULE_SETS` utvidet til
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` — samme sett
`docs/review/tools/a11y.sh` har brukt hele tiden.

| Tre             | Røde | Grønne |
| --------------- | ---- | ------ |
| `main` før #142 | 29   | 121    |
| #142            | 0    | 150    |

Alle 29 er `target-size`, og alle 29 er denne ene knappen. WCAG 2.1 legger
til null røde. Hele kostnaden ved å måle mot 2.2 i dette repoet var én
kontroll, og denne PR-en betalte den.

Selve regelsettet er utvidet i #143, og formen på funnet — to målinger av det
samme kravet som aldri ble sammenlignet — står i `funksjonssjekk.md`.

## Samme dag: PR #140, den hoppede halvdelen av korpusvakta

Branch `test/corpus-per-answer-older-thread`, sha `0b102b4`, 2026-09-21.
Min egen, så dette er en notis og ikke en anmeldelse.

`test.fixme`-en i `tests/e2e/corpus-per-answer.spec.ts` er snudd til `test`.
Én linje, pluss kommentaren over den som beskrev hva som manglet.

### Hva den vokter nå

At en eldre tråd navngir sitt eget korpus og ikke det som står valgt. Det
krever to spørsmål og et trådbytte, og det er ikke omstendelighet: en test som
spør én gang per korpus er grønn i begge verdener — der setningen følger
svaret, og der den følger valget — fordi de to er like så lenge ingen har
byttet siden svaret kom. Etter #133 er det bare én vei til en tilstand som
skiller dem: åpne en eldre tråd.

### Hvorfor den sto som `test.fixme` i to dager

Fordi den var **rød med riktig grunn** da den ble skrevet, og det er verdt mer
enn en test som venter på disk. Målt på `main 3bbaf51`: «All tekst er sitater
fra dokumentene fra Wikipedia (mock)» over kildekortet «Årsrapport Nasjonal
kommunikasjonsmyndighet 2025». `SourcesView` leste korpuset fra butikken og
ikke fra svaret.

Den ble grønn da #138 skrev nøkkelen på svaret og #139 leste den, uten at noe
annet i fila ble rørt — som er det en vakt skal kunne love når den skrives
før fiksen.

| Tre                  | E2E                        |
| -------------------- | -------------------------- |
| `main 3bbaf51`       | rød, riktig grunn          |
| #138 + #139 + `main` | 151 bestått, 0 hoppet over |

## Til dirigenten

- Ingen funn. Klar for Lars.
- En advarsel fra `lint` står igjen etter #139 og er ikke denne PR-ens:
  `CorpusDisclaimer.tsx:24` eksporterer `sourcesDisclaimer` fra en fil som
  også eksporterer en komponent, som slår av Fast Refresh for den fila.
  Advarsel, ikke feil, og den sto der som `KudosDisclaimer.tsx` også. Verdt en
  linje til #4 neste gang de er i mappa.
