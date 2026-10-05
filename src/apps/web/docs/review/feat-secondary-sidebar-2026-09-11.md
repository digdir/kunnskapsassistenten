# Review: `feat/secondary-sidebar`, PR #2

**Commit:** `5040004` «Kildepanel: utdrag gruppert per dokument, nummerert mot [n]»
**Dato:** 2026-09-11 · **Anmelder:** KA CC
**Omfang:** 18 nye filer, 1272 linjer. `SourcesView` med søk, snarveisliste,
dokumentkort, utdrag, tre tilstander, og en dev-only forhåndsvisning.

## Porter

| Port                    | Resultat |
| ----------------------- | -------- |
| `npm run build`         | grønn    |
| `npm run lint`          | grønn    |
| `npm run format:check`  | grønn    |
| `npm run tokens:verify` | grønn    |

Bygget inneholder bare `dist/index.html`, så `preview/` havner ikke i
produksjonsbunten, som PR-beskrivelsen sier.

## WCAG headless, begge moduser

Kjørt mot `/src/views/sources/preview/index.html`, 1440×900, axe-core 4.13.0.

- **Null axe-brudd og null uavklarte**, i både lys og mørk modus, 35 regler
  passert.
- **Overskriftshierarkiet er riktig hele veien:** h1 → h2 «Kilder» → h3 per
  dokument → h4 «Utdrag n». Ingen hopp.
- **21 av 21 synlig fokuserbare elementer nås med Tab**, i begge moduser.
  Ingen kontroll er utilgjengelig.
- **Feltetiketten virker:** søkefeltet får navnet «Søk i kildene» fra
  `<Label htmlFor>`.
- `aria-live="polite"` på treffelleren er på plass.
- `data-color-scheme="auto"` i forhåndsvisningens `index.html`, altså
  beslutningen fra 2026-09-11. Rot-`index.html` står fortsatt på `light`; det
  er funn 1 i `main-2026-09-11.md`, ikke noe denne PR-en eier.

Skjermbilder:
`design/skjermbilder-frontend/feat-secondary-sidebar--src-views-sources-preview-index.html--{light,dark}.png`

## Det som er riktig, og som jeg prøvde i nettleser

- **`[n]`-koblingen virker, og den er den viktigste tingen i hele PR-en**
  (svar 19). Jeg klikket «[3]» i forhåndsvisningen: utdraget fikk
  `data-active="true"`, `Details` åpnet seg, panelet rullet dit, og fokus
  havnet på `#kilde-utdrag-3`. Et **nytt klikk på samme markør** rullet dit
  igjen, så `activeCitationNonce` gjør jobben den er laget for.
- **`aria-controls` er ryddig.** Åpen: `aria-expanded="true"` og
  `aria-controls="kildepanel"`. Kollapset: `aria-expanded="false"` og
  attributtet fjernet. Jeg telte hengende `aria-controls`-referanser i
  dokumentet: **null**. Kommentaren på linje 153-155 gjør det den sier.
- **Lukket `Details` skjuler innholdet på ordentlig.** Jeg trodde først det
  motsatte, fordi `getBoundingClientRect()` ga 190 px høyde på innholdet i et
  lukket utdrag. Det er en måleartefakt: innholdet ligger bak
  `content-visibility: hidden`, og da returnerer `getClientRects()` siste
  kjente størrelse. `checkVisibility()` og Playwrights egen `isVisible()` sier
  begge `false`, og `details` måler 58 px, altså bare sammendraget. Ingen
  feil, men verdt å vite for neste måling; jeg rettet verktøyet mitt.
- **CSS-en er ren.** Ingen `px`, ingen heksfarger, ingen fontnavn: hver verdi
  er `var(--ds-*)`. Utenfor alle layers, som README krever, og
  `data-active`-båndet er en `inset box-shadow` så ingenting flytter seg når
  det dukker opp.
- **Designsystemet-valgene er riktige og godt begrunnet:** `Details` framfor
  egen bryter (svar 38), `Search` med `Search.Clear` framfor håndtegnet felt,
  `List.Ordered` med native markør framfor Figmas nummersirkel (fordi egen
  `li::before` slår ut VoiceOver-fiksen i `list.css`), `Tag` med `data-color`
  framfor farge i CSS, og lenka holdt **utenfor** overskriften i `Card` for å
  slå av klikkdelegeringen. Det siste er nettopp fella i
  `funn-tverrgaaende.md`, og den er unngått med vilje.
- **Norsk hele veien** i det brukeren møter, inkludert «(åpnes i ny fane)» som
  sr-only, «Åpne utdrag 3» som tilgjengelig navn der Figma bare har «Åpne»,
  og «Utdrag 1–2» med tankestrek. Ingen treff på `venstre`, `høyre`, `left`
  eller `right`.

Kvaliteten er høy. De tre blokkerende funnene er alle av samme slag: `reveal()`
flytter fokus, og den kalles fra tre steder som ikke skal flytte fokus.

---

## Blokkerer

### 1. Søkefeltet låser seg etter to tegn

`src/views/sources/SourcesView.tsx:132-139` og `22-34`

`changeQuery` kaller `revealHit` på hvert tastetrykk, og `reveal()` avslutter
med `element.focus()`. Så snart spørringen når `MIN_QUERY_LENGTH` flyttes
fokus ut av søkefeltet og inn på utdraget.

Målt i nettleser, tegn for tegn i `#kilder-sok`:

| Tastetrykk | Feltverdi | Fokus etterpå    | Teller       |
| ---------- | --------- | ---------------- | ------------ |
| `r`        | `r`       | `kilder-sok`     | (tom)        |
| `i`        | `ri`      | `kilde-utdrag-1` | 1 av 9 treff |
| `s`        | `ri`      | `kilde-utdrag-1` | 1 av 9 treff |
| `i`        | `ri`      | `kilde-utdrag-1` | 1 av 9 treff |
| `k`        | `ri`      | `kilde-utdrag-1` | 1 av 9 treff |
| `o`        | `ri`      | `kilde-utdrag-1` | 1 av 9 treff |

De fire siste tegnene forsvinner. Det er ikke mulig å søke på noe som er
lengre enn to tegn, verken med tastatur eller mus. «risiko» kan ikke skrives.

WCAG 2.1.1 og 3.2.2: en kontroll som gjør seg selv ubrukelig ved bruk.

**Fikk:** `changeQuery` skal rulle, ikke fokusere. Skill de to: `reveal()`
for «brukeren ba om å bli flyttet hit» (markør-klikk), og en variant uten
`focus()` for «innholdet flyttet seg under deg» (søk mens du skriver). Det er
`focus()`-linja som er feil her, ikke `scrollIntoView`.

### 2. «Skjul kilder» mister fokus til `<body>`

`src/views/sources/SourcesView.tsx:147-164`

Målt: med panelet åpent står fokus på knappen «Skjul kilder». Etter klikk er
`document.activeElement` **body**.

Grunnen er at `toggle` rendres i to forskjellige subtrær: inni
`<div className="sources-view__toggle">` når panelet er åpent, og inni
`<div className="sources-view sources-view--collapsed">` når det er kollapset.
React avmonterer knappen brukeren nettopp trykket på og monterer en ny et
annet sted, og fokus faller til dokumentroten.

For en tastaturbruker betyr det at å skjule kildepanelet kaster deg til toppen
av sida, og neste Tab starter forfra. WCAG 2.4.3.

**Fikk:** render knappen **én gang**, utenfor forgreiningen, og bytt bare det
som ligger rundt den. Alternativt behold en `ref` og flytt fokus til den nye
knappen etter byttet, men én knapp er enklere og har ingen kant å gå på.

### 3. En `[n]`-markør gjør ingenting når panelet er kollapset, og kollapset er standard

`src/views/sources/SourcesView.tsx:107-110` og `162-164` ·
`src/layout/viewModel.ts` (`defaultLayout`)

Målt: kollaps panelet, klikk «[2]». Panelet forblir kollapset,
`#kilde-utdrag-2` finnes ikke i DOM-en, og fokus står igjen på markøren.
Ingenting skjer, og ingenting sier hvorfor.

`defaultLayout` setter `collapsed: true` på `secondary-sidebar`, så dette er
**førstegangstilstanden**, ikke et hjørnetilfelle: det første svaret kommer
med markører i et panel som er lukket.

Viewet kan løse det selv. Det har `onCollapsedChange`, og det eier allerede
avgjørelsen om å åpne et utdrag når en markør peker på det (linje 95-105).
Å åpne panelet er samme slags avgjørelse.

**Fikk:** når `activeCitationNonce` endrer seg og panelet er kollapset, kall
`setCollapsed(false)` og rull deretter. Merk at rekkefølgen betyr noe:
`revealNextFrame` venter alt én frame, men panelet må være montert før
`getElementById` finner noe, så det kan hende det trengs to.

---

## Bør

### 4. «Neste treff» åpner ikke utdraget treffet ligger i

`src/views/sources/SourcesView.tsx:141-145`

`changeQuery` åpner hvert utdrag som har treff, og begrunner det godt i
kommentaren på linje 126-131: «3 av 26 treff» betyr ingenting hvis treffene
ligger bak lukkede brytere. `stepToHit` gjør ikke det samme.

Målt: søk «ri» (9 treff, 3 utdrag åpnes), lukk alle tre utdragene, trykk
«Neste treff». Telleren går til «2 av 9 treff», antall åpne `details` er
**0**, og ingen `<mark>` er synlig. Fokus havner på utdragsbeholderen, men
treffet står bak en lukket bryter.

**Fikk:** samme åpning i `stepToHit` som i `changeQuery`, for treffet det
steppes til.

### 5. «Forrige» og «Neste» flytter fokus bort fra knappen

`src/views/sources/SourcesView.tsx:141-145`

Målt: etter klikk på «Neste treff» står fokus på `kilde-utdrag-1`, ikke på
knappen. For å gå til treff nummer tre må brukeren Tab-e tilbake til knappen
først, hver gang.

Dette er samme rot som funn 1: `reveal()` fokuserer alltid. For «neste treff»
er det rulling som er ønsket, ikke fokusflytting — telleren i live-regionen er
det som forteller en skjermleserbruker hva som skjedde, og den er allerede på
plass.

**Fikk:** rull uten `focus()` her også. Da løses funn 1 og 5 av samme
oppdeling.

### 6. `index.ts` sier at rullemålene eksporteres, men de gjør det ikke

`src/views/sources/index.ts:4-8` · `src/views/sources/ids.ts`

Kommentaren sier «The scroll-target helpers are exported too, because the
`[n]` markers in the answer need to point at them», og `ids.ts` sier «Keeping
them in one file means the main column can import the helper instead of
guessing the string». Fila eksporterer bare `SourcesView` og
`SourcesViewProps`.

#3 bygger markørene nå, og må da enten gjette strengen eller importere fra
`../sources/ids`, altså inn i en mappe som ikke er #3 sin.

**Fikk:** `export { SOURCES_PANEL_ID, documentDomId, excerptDomId } from './ids';`

### 7. Effekten på linje 107 kan flytte fokus ved montering

`src/views/sources/SourcesView.tsx:107-110`

Render-fasen på linje 94-105 er riktig gjerdet: `handledNonce` starter som
`activeCitationNonce`, så den kjører ikke ved montering. Effekten har ikke
samme gjerde. React kjører effekter ved montering, så er
`activeCitationNumber` alt satt når viewet monteres, flyttes fokus inn i
panelet uten at brukeren har gjort noe.

Det skjer den dagen skallet monterer viewet etter at et svar har kommet, eller
når viewet flyttes mellom plasser — som layout-abstraksjonen eksplisitt er
laget for.

**Dette fikk jeg ikke demonstrert i nettleser**: forhåndsvisningen starter
alltid uten markør, så jeg melder det som en kodesti, ikke som en måling.

**Fikk:** samme gjerde som render-fasen bruker. En `ref` med forrige
behandlede nonce, satt til startverdien.

### 8. Lokal variabel `document` skygger DOM-globalen

`SourcesView.tsx:36-37,98,201` · `SourceDocumentCard.tsx:31-84` ·
`SourcesOverview.tsx:48-63` · `search.ts:42-47`

`documents.flatMap((document) => document.excerpts)` står i de samme filene
som `document.getElementById(domId)`. Det virker, fordi skyggingen er
funksjonslokal, men det er nettopp kollisjonen PR #1 navnga typen
`SourceDocument` for å unngå — begrunnelsen står i PR #1-beskrivelsen:
«`Document` kolliderer med DOM-globalen».

**Fikk:** `source`, `doc` eller `sourceDocument` som parameternavn. Billig nå,
og det holder begrunnelsen fra grunnmuren i hevd.

### 9. Faste DOM-id-er tåler ikke to instanser av viewet

`ExcerptSearch.tsx:4-5` (`kilder-sok`, `kilder-sok-beskrivelse`) ·
`SourcesOverview.tsx:42-45` (`kilder-snarveier`)

Id-ene er konstanter i modulen. `SourcesView` sier selv i sin egen
dokumentasjon at «Nothing here assumes it is alone in the slot», og
`viewModel.ts` er bygget for at views skal kunne flyttes og bo sammen. To
`SourcesView` samtidig gir duplikate id-er, og da peker `htmlFor` og
`aria-labelledby` på feil element.

Rullemålene i `ids.ts` er en annen sak: de **skal** være globale, siden de er
fragmenter i adressefeltet.

**Fikk:** `useId()` for feltet, etiketten og beskrivelsen. Det er én linje per
id og fjerner hele klassen.

---

## Kan

### 10. Én bokstav i søkefeltet ser ut som ingenting

`search.ts:32` · `ExcerptSearch.tsx:51-56`

`MIN_QUERY_LENGTH = 2` er et godt valg, men under grensen er `status` tom
streng. Brukeren skriver «r», ingenting skjer, og ingenting sier hvorfor.
En setning («Skriv minst to tegn») koster ingenting og står i en live-region
som alt finnes.

### 11. Telleren blir snakkesalig når funn 1 er rettet

`ExcerptSearch.tsx:89-91`

`aria-live="polite"` på treffelleren er riktig, og er det eneste som forteller
en skjermleserbruker at søket gjorde noe, siden `<mark>` ikke annonseres. Men
når feltet først kan skrives i, annonseres et nytt treffantall per tastetrykk.
Vurder å oppdatere telleren etter et kort opphold i skrivingen, ikke per tegn.

### 12. Snarveislista lager et eget landemerke

`SourcesOverview.tsx:42`

`<section aria-labelledby>` blir et `region`-landemerke. Målt i
landemerkelista: `main`, `aside «Kilder»`, `section «Snarveier til
dokumentene»`. For en liste på tre lenker inne i et panel som alt er et
landemerke, er det ett navigasjonsnivå mer enn innholdet bærer. En `div` med
overskriften over ville gitt samme struktur uten landemerket.

---

## Til dirigenten

- **PR-en er ikke klar for Lars.** Funn 1 til 3 er alle i `SourcesView.tsx` og
  har samme rot: `reveal()` gjør to ting (rull og fokuser), og tre av fire
  kallsteder vil bare ha det ene. Å dele den i to funksjoner løser funn 1, 4
  og 5 samtidig.
- **Funn 3 krever at #5 sender `collapsed` og `onCollapsedChange` inn** når
  viewet monteres i skallet. Kontrakten finnes i `types.ts`, men skallet
  bruker den ikke ennå. Verdt å koble samtidig, ellers er markørene døde i
  den virkelige appen selv etter at funn 3 er rettet her.
- **Funn 6 trenger #3 nå.** `excerptDomId` må eksporteres før #3 kan rendre
  markørene mot den; jeg har ikke sett #3 sin kode ennå.
- **Kudos-ordlyden (spørsmål 25) er avgjort i praksis** av denne PR-en: «All
  tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig
  intelligens.» og feltetiketten «Søk i kildene». Begrunnelsen står i
  `ExcerptSearch.tsx:7-16`. Verdt å føre inn i
  `visjon-og-beslutninger.md` så det ikke avgjøres på nytt.
- **Verktøyfunn, gjelder alle framtidige reviews:** `getBoundingClientRect()`
  og `getClientRects()` lyver om innhold bak `content-visibility: hidden`, som
  er det en lukket `Details` bruker. `checkVisibility()` er svaret. Det ga meg
  ett falskt blokkerende funn og fire falske «uåbare kontroller» før jeg
  rettet det, og rettelsen ligger i `tools/a11y.sh` i denne PR-en.
