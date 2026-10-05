# PR #116, plass i panelhodet: plassen finnes ikke i skuffa

Anmeldt 2026-09-21 av KA CC. Sammenslåingen av `75a23c1` og `origin/main`
(`9b70ccc`) — ingen konflikt, branchen inneholder allerede main.

Alle fire portene grønne. 697 enhetstester og **145 e2e grønne på 4173**,
inkludert tabbvandringen med den nye hopplenketeksten.

## Funn

### Blokkerer

**1. Under 1139 finnes plassen ikke, og det er der viewet faktisk står.**
`src/layout/Shell.tsx:472` og `:687`. `railed` er `state.collapsed || drawer`,
og slotten tegnes bare når `railed` er usann — så i skuffemodus finnes den
aldri. Samtidig er det nettopp i skuffa viewet bor: `{drawer ? null :
panelContent}` flytter hele viewet inn i `<Dialog className="drawer">`.

Målt på branchen, mock, to bredder:

| Bredde | `.panel-head-slot` i DOM | Skuff i DOM | `.filters-view` inne i skuffa |
| ------ | ------------------------ | ----------- | ----------------------------- |
| 1440   | ja                       | nei         | —                             |
| 1100   | **nei**                  | ja          | ja                            |

Begrunnelsen i koden er at «en rail er én knapp bred, og en kontroll til ville
ikke hatt noe sted å gjøre av seg». Det stemmer for en rail. En skuff er ikke
en rail: den er hele panelet, 400 px bredt, tegnet over svaret — det er den ene
tilstanden der det er rikelig plass.

Konsekvensen treffer neste PR, ikke denne. Når #2 gjør det brief-en ber om —
`<PanelHead>` rundt «Tråder»-knappen, rolle-2i del 2 — finner `PanelHead` ingen
plass under 1139 og tegner ingenting. Da er veien tilbake fra filtervisningen
til trådlista borte på hver bredde under brytepunktet, i den layouten som også
er 1440 på 200 % zoom (WCAG 1.4.4). Brief-en til #2 sier «på rail: ingen
endring» og nevner ikke skuffa, så ingen ville sett det før det var merget.

Dette er grunnen til at det er blokkerende og ikke «bør»: PR-en finnes for å
være plassen #2 bygger på, og plassen mangler i den ene av to layouter appen
sender ut. Enten tegnes slotten også inne i skuffas `.panel`, eller så skrives
kontrakten ned og #2 får en regel for hva viewet gjør når plassen ikke finnes.
Det første er det som gjør `PanelHead` til «plassen».

### Bør

**2. En kommentar lover en test som ikke finnes.** `src/App.test.tsx:239` sier
«Hvilket ord som velges, er `shortcutModifier()` sitt, og den har sin egen
test». Det har den ikke: `PanelHead.test.tsx:19` sier tvert imot at den ikke
prøves der, og `grep` finner ingen `shortcutModifier.test.ts`. Funksjonen velger
et ord brukeren ser, og den har null dekning. To linjer med en stubbet
`navigator.userAgent` lukker både kommentaren og hullet.

### Kan

**3. `display` uten `[hidden]`-par.** `src/styles/global.css:296`.
CONTRIBUTING krever paret fordi egen CSS ligger utenfor alle layers og slår
nettleserens egen `[hidden]`-regel; begge naboene i samme fil har det
(`.sidebar-content[hidden]:583`, `.view-head[hidden]:636`). Slotten kan ikke
skjules med attributtet i dag, så dette er konvensjon og ikke en feil.

**4. Testen måler elementer, men påstanden er «ingenting».**
`PanelHead.test.tsx:102` sier at det er tomheten `:empty` hviler på, og måler
`childElementCount`. En tekstnode ville bestått den og brutt `:empty`.
`hasChildNodes()` er akkurat det påstanden sier.

**5. Skråstreken i et tilgjengelig navn.** `Shell.tsx:153`. Repoet har alt
avgjort at «/» lest høyt er «skråstrek» i noen stemmer og stillhet i andre —
det er hele grunnen til at `SHORTCUT_DESCRIPTION` i `src/views/chat/text.ts`
staver den ut. Nå står «(Ctrl + /)» i navnet på en hopplenke. Det er ingen
opplagt fiks: en `aria-label` som staver ut skråstreken ville brutt WCAG 2.5.3
Label in Name, som krever at det tilgjengelige navnet inneholder den synlige
teksten. Så dette er en avgjørelse — behold, eller la parentesen stå bare som
`title` på feltet — og ikke en kodefeil.

## Det som er riktig

- **Mønsteret er `ViewHead` sitt, og forskjellen er begrunnet der den er.**
  `panelHeadContext.ts` sier hvorfor dette er en annen plass enn view-hodet:
  den ene er toppen av rulleregionen, den andre er raden over den. Og
  `PanelHead` tegner **ingenting** uten en plass, motsatt av `ViewHead` som
  tegner seg selv der den står — riktig, av grunnen som står i koden: dette er
  skallets krom, ikke viewets eget hode.
- **Tabbrekkefølgen holder.** Målt i full suite: «Skjul tråder og filter» og
  «Tråder» kommer begge før rulleregionen, og hvert steg har norsk navn og
  synlig ring i begge moduser.
- **Ingen visuell endring før noen fyller plassen.** Slotten er `:empty` og
  dermed `display: none`, og enhetstesten måler at React ikke legger noe i den.
  Målt på 1440: filterhodet er 137 px, nøyaktig som i #114 — panelhodet har
  ikke vokst.
- **Hopplenketeksten er stabil i CI og lokalt, og det er verdt å vite hvorfor.**
  Jeg forventet at `'Hopp til skrivefeltet (Ctrl + /)'` i klartekst ville være
  rød på en Mac, siden `shortcutModifier()` leser `navigator.userAgent` og
  denne maskinen melder «Macintosh» — målt 14:09, der `a11y.sh` leste «Trykk
  Cmd + / for å hoppe hit». Det er ikke tilfelle: `devices['Desktop Chrome']` i
  `playwright.config.ts` setter sin egen user agent, og den er Windows. Målt i
  suiten: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) … Chrome/153`, lenketekst
  «Hopp til skrivefeltet (Ctrl + /)», hint «Trykk Ctrl + / for å hoppe hit».
  Påstanden i klartekst er altså portabel, og de tre prefiks-oppslagene er
  riktige uansett.

## Til dirigenten

- **En påstand i min egen fil er feil.** `docs/review/funksjonssjekk.md` sier at
  skjermbildene fra denne maskinen og fra CI er ulike på Ctrl/Cmd. Det gjelder
  `a11y.sh` (playwright-cli, ekte Mac-UA → «Cmd»), men **ikke** e2e-suiten, som
  alltid sier «Ctrl» fordi enhetsbeskrivelsen setter en Windows-UA. Jeg retter
  den linja i neste rapport-PR.
- Funn 1 er en avgjørelse for #5 og ikke bare en rettelse: skuffa har ingen
  hoderad i dag, så plassen der må tegnes et sted.

## Runde 2, `17f1bc6`

Blokkeringen er løst på den måten som gjør `PanelHead` til «plassen»: skuffas
`.panel` har fått sin egen hoderad, og slotten ligger i den. Ingen
sammenleggingsknapp ved siden av — skuffa har Designsystemets egen lukkeknapp,
og to kontroller som begge lukker panelet ville vært én for mye.

Målt på nytt:

| Bredde             | Slotter i DOM                         | Slot inne i skuffa | `display` når tom |
| ------------------ | ------------------------------------- | ------------------ | ----------------- |
| 1440               | 1 (kildepanelet er rail og har ingen) | —                  | `none`            |
| 1100, skuff lukket | 2, én per panel                       | ja                 | `none`            |
| 1100, skuff åpen   | 2                                     | ja                 | `none`            |

De tre nye enhetstestene måler en **fylt** slot inne i `<dialog>`, ikke bare at
boksen finnes — som er forskjellen på å teste plassen og å teste at den virker.
`hasChildNodes()`, `[hidden]`-paret og `shortcutModifier.test.ts` er også inne,
så kommentaren i `App.test.tsx` er sann nå.

### Ett nytt funn, bør: den tomme raden kostet 16 px

`.panel-head-slot:empty` er `display: none` og koster ingenting. Men omslaget
rundt den — `.sidebar-header` — var fortsatt et flex-element i en `.panel` med
`gap: 16px`, og en boks på null høyde får gapet sitt likevel.

|                             | main    | 17f1bc6 |
| --------------------------- | ------- | ------- |
| `.view-head` i skuffa, 1100 | y = 60  | y = 76  |
| `.sidebar-content`          | h = 808 | h = 792 |

Altså 16 px av rullevinduet i den layouten der hodet allerede tar 26 % av det,
og i et panel som ruller på hver bredde vi tegner. PR-en lovet ingen visuell
endring før et view fyller plassen; i skuffa stemte det ikke.

## Runde 3, `f1717ff`

Tatt med `.drawer .sidebar-header:has(> .panel-head-slot:empty)` — og
`[hidden]` ved siden av, av samme grunn som slotten har begge.

|                             | main (før plassen) | 17f1bc6 | f1717ff     |
| --------------------------- | ------------------ | ------- | ----------- |
| `.view-head` i skuffa, 1100 | y = 60             | y = 76  | **y = 60**  |
| `.sidebar-content`          | h = 808            | h = 792 | **h = 808** |

Tilbake til null, og slotten står fortsatt i DOM-en så et view kan fylle den.
1440 er uendret: view-hodet på y = 90, innholdet 778.

`:has` er riktig verktøy: vilkåret er nøyaktig «det ene i denne raden er tomt»,
og det er noe CSS kan si selv, uten en ekstra klasse skallet måtte holde
oppdatert. De to siste enhetstestene sier ærlig hva de måler — jsdom kjører
ikke stilarket, så det de sikrer er forutsetningen selektoren hviler på.
Effekten er målt i nettleseren, her.

## Hva serien har spart så langt

Mot grunnlinja på `main 0855670`, med definisjonen Lars valgte 21.09:

| Del                           | Grunnlinje | Nå (main `3dc64a3`) |
| ----------------------------- | ---------- | ------------------- |
| Filterhodet, alle tre bredder | 179        | 137 (#114)          |
| Klebrig nederst               | 302        | 214 (#115)          |
| Leservindu 1280               | 418        | 506                 |
| Leservindu 1440               | 598        | 686                 |

N1 gjenstår: når #2 flytter «Tråder» opp i plassen, går filterhodet fra 137 til
89 — ikke 99, fordi korpuslinja ble 42 px billigere enn regnet.
