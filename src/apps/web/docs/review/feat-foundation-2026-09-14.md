# PR #14, layout V1: kildepanelet gir etter, én åpen sidekolonne under 1440

2026-09-14, anmelderen (KA CC). Branch `feat/foundation` @ `a219e9d`
(`396a1e0`, `5c6a9ae`, `a219e9d`), mot `main` `8060c9b`. Fasit:
`design/_briefs/bygg/rolle-5c-layout-v1.md` med tillegget «hullet ved 1280»,
og `design/visjon-og-beslutninger.md`.

**Ett blokkerende funn.** Alt beslutningen ber om er bygget og målt riktig;
det som mangler er hva som skjer med tastaturet i det øyeblikket regelen tar
et panel fra brukeren.

## Portene

| Sjekk                                                   | Resultat                              |
| ------------------------------------------------------- | ------------------------------------- |
| `npm run build`                                         | OK                                    |
| `npm run lint`                                          | OK                                    |
| `npm run format:check`                                  | OK                                    |
| `npm run tokens:verify`                                 | OK                                    |
| `npm test`                                              | 121 tester, 16 filer, alle grønne     |
| `npm run test:e2e`                                      | 55 grønne, 1 rød — den røde er funn 1 |
| axe (`a11y.sh`, 1280, `/` og `/threads/…`, lys og mørk) | **0 brudd** i alle fire kjøringene    |

Det ene uavklarte axe-funnet er `aria-required-children` på tre noder, som er
Designsystemets `Suggestion` og står fra før i
[`feat-primary-sidebar-2026-09-11.md`](feat-primary-sidebar-2026-09-11.md).
Ikke innført her.

## Blokkerer

### 1. Regel B mister tastaturet når den tar panelet

Krymper vinduet forbi 1440 mens kildepanelet er åpent **og brukeren står inne
i det**, kollapses panelet, innholdet skjules med `hidden`, og
`document.activeElement` blir `<body>`. Brukeren kastes til toppen av
dokumentet uten at noe sier fra.

Målt på det bygde appet, 2026-09-14:

```
1536, begge åpne, fokus i kildepanelet:   input  [inne i kildepanelet]
1439, etter at regel B tok panelet:       BODY   ← fokus mistet
                                          sidebar-content hidden: true
```

De to andre veiene inn i regelen er **riktige**, og det er derfor denne
stikker seg ut: åpner brukeren et panel med knappen, står fokus på knappen som
overlever; åpner en kildemarkør panelet, flytter `showCitation` fokus til
utdraget. Bare overgangen har ingen som flytter fokus, fordi ingen trykket på
noe.

**Hvorfor blokkerende og ikke «bør».** Det er ikke bare vindusdragging.
Mediespørringen leser CSS-piksler, så **nettleserzoom krysser det samme
brytepunktet**: 1600 px på 125 % er 1280 CSS-piksler. Brukeren som zoomer er
uforholdsmessig ofte den samme som navigerer med tastatur, og WCAG 1.4.4
Resize Text (AA) er nettopp løftet om at appen skal virke under zoom. Å miste
fokus til `<body>` er dessuten mønsteret sjekklista i
[`README.md`](README.md) allerede kaller et funn, fra fire tilfeller i PR #3.

_Målt via resize. Zoom-veien er samme mekanisme, men jeg har ikke målt den
selv._

**Forslag til retting.** Når regelen kollapser en plass som inneholder
`document.activeElement`, flytt fokus til den plassens egen veksleknapp. Den
er det eneste riktige stedet: den står der panelet sto, den sier nå «Vis
kilder», og den er ett tastetrykk fra å gi panelet tilbake. Samme grep som
`switchedByUser` gjør for viewbytte i samme fil. Gjelder begge sidekolonner,
siden regelen kan ta hvilken som helst av dem.

Regresjonstest ligger klar: `regel B mister ikke tastaturet når den tar
panelet` i `tests/e2e/layout.spec.ts`. Den er rød nå og blir grønn av
rettelsen.

## Kan

### 2. Kommentaren i `layoutStyle()` lover mer enn koden gjør

`src/layout/viewModel.ts`, i `layoutStyle()`:

> Keyed on the SLOT, not on the sources view that sits in it today … Move
> sources elsewhere and the rule still asks about whatever took its place.

Koden leser `layout.slots['secondary-sidebar'].collapsed`, fast. Flyttes
`sources` til navigasjonspanelet med `withViewMoved`, står kildepanel-plassen
igjen tom og kollapset, og regelen svarer «ingenting ved siden av svaret» selv
om kildene da står i en åpen plass ved siden av svaret.

Oppførselen er forsvarlig — svaret får 618 mens kildene leses i et 400 px
panel — så dette er kommentaren og ikke koden. Men det er ingen UI for å
flytte views ennå, og den dagen det kommer er det denne setningen noen kommer
til å stole på. Enten stryk siste setning, eller la regelen spørre etter
plassen `sources` faktisk sitter i (`slotOf`).

### 3. De to kollapsede sidekolonnene er ikke lenger like brede

236 mot 198. Det er riktig etter utledningen — etikettene er ulike lange og
navigasjonspanelet betaler for sin egen ramme — og `global.css` sier det rett
ut: «the slots share the derivation, not the result». Verdt å vite at den
gamle begrunnelsen for 198 var det motsatte, symmetri, og at forskjellen er
synlig: `layout-1280-begge-kollapset-lys.png`. Ingen endring foreslått, men
Lars bør se bildet.

## Det som er riktig, og hvor jeg sjekket det

- **Garantien holder.** `scrollWidth === innerWidth` på 1280, 1440 og 1536 ×
  hver tilstand beslutningen tillater × lys og mørk, målt med samme tall i
  begge moduser. 19 tester, alle grønne. Tilstanden appen åpner i ved 1280 —
  den som trengte 1302 før — måler nå 400 + 32 + 618 + 32 + 198 = 1280.
- **618 er nøklet på PLASSEN.** `layoutStyle()` leser
  `layout.slots['secondary-sidebar'].collapsed`, ikke om `sources`-viewet
  finnes, og ikke om det er kilder i det. Enhetstest:
  «lowers the answer column floor when nothing stands beside it». Se likevel
  funn 2 om kommentaren.
- **Regel B i alle tre veiene**: åpning kollapser den andre, krymping
  kollapser kildepanelet og ikke navigasjonspanelet, og `showCitation` går
  gjennom samme `fitted()` som knappene. Åtte enhetstester pluss tre e2e.
  Vinduet gir ikke noe tilbake når det vokser igjen, og det er med vilje.
- **Brytepunktet er regnet ut, ikke skrevet ned.** `bothSidebarsMinViewport`
  summeres fra `defaultLayout` gjennom `slotFloor()`, så en endret bredde
  flytter brytepunktet med seg. `narrowViewportQuery` bruker
  `(width < 1440px)` og ikke `max-width: 1439px`, så 1440 selv fortsatt
  rommer begge — verifisert både i enhetstest og ved at matrisen min har
  «1440, begge sidekolonner åpne» grønn.
- **Rekkefølgen når plassen blir knapp** ligger i tre `flex`-linjer og ingen
  mediespørring. Målt: ved 1440 med begge åpne blir hovedkolonnen klemt til
  gulvet 640 og kildepanelet til 336, som er nøyaktig summen.
- **236 stemmer.** «Vis tråder og filter» står på én linje i det kollapsede
  panelet, med fonten lastet. Utledningen i `viewModel.ts` har alle leddene:
  195,78 + 36 + 1 = 232,78, altså gulv 233 og 236 som neste 4 px-steg.
- **README** har «Layout og brytepunkter» med breddetabellen, rekkefølgen,
  brytepunktet og garantitabellen, og «V1 hører til spørsmål 26» er borte.
  Under 1280 står som **kjent avvik fra WCAG 1.4.10 Reflow (AA)** med
  skuffeløsningen som planlagt fiks, slik dirigenten ba om.
- **Navn og tokens**: ingen heksfarger, ingen nye tallverdier i px i CSS,
  ingen `!important`, egen CSS fortsatt utenfor alle `ds`-layer. Treffene på
  «left»/«right» er engelsk prosa («what is left») og Figma-organismen
  `right-sidebar` sitert som kilde, ikke egne navn.
- **`.env.example` og README** sier nå at `VITE_API_MODE` ikke hører hjemme i
  `.env.local`. Det var fella dirigenten noterte i
  `verifisering-2026-09-14.md`, og den er lukket.
- **Ingen filer utenfor #5 sitt eierskap.** `tests/` er urørt.

## Rettet i mine egne filer underveis

`saveScreenshot()` blurret fokus, men flyttet ikke musepekeren. Playwright lar
pekeren stå der den sist klikket, så knappen som ble trykket beholdt
hover-flata si og referansebildet påsto at brukeren peker på noe. Synlig i den
første runden med `layout-1280-begge-kollapset-lys.png`, der nav-knappen sto
uthevet og kildeknappen ved siden av ikke gjorde det. `page.mouse.move(0, 0)`
er lagt til. Alle 22 layoutbildene er tatt om igjen.

## Til dirigenten

1. **Funn 1 må rettes før merge.** Det er en liten endring i `LayoutProvider`
   og testen ligger klar.
2. **`rolle-5c-layout-v1.md` sier fortsatt 232** fire steder, inkludert
   kontrollregnestykket i tillegget (`232 + 32 + 648 + 32 + 336`). Bygget er
   236, og tallene ved 1280 med kildepanelet åpent er
   236 + 32 + 640 + 32 + 340. Briefen er din; to filer som er uenige om det
   samme tallet er verdt fem minutter nå.
3. **Ikke klar for Lars ennå.** Med funn 1 rettet er den det: alt annet i
   beslutningen er bygget, målt og grønt.
