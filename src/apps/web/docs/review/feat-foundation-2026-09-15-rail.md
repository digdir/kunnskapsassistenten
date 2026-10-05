# PR #20, kollapset sidekolonne som rail

2026-09-15, anmelderen (KA CC). `feat/foundation` @ `5ab63be`, prøvemerget med
`main` `51563ae` (ingen konflikt). Fasit:
`design/_briefs/bygg/rolle-5d-kollapset-rail.md`.

**Klar.** Ett «bør» og ett «kan», begge om kommentarer, ingen om oppførsel.
Alt beslutningen ber om er bygget og målt.

## Portene

| Sjekk                                                       | Resultat                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| `npm run build` / `lint` / `format:check` / `tokens:verify` | OK                                                       |
| `npm test`                                                  | 130 tester, 17 filer, grønne                             |
| `npm run test:e2e`                                          | 59 grønne, 0 røde (56 fra PR-en + 3 erstatninger, under) |
| axe (`a11y.sh`, 1280, `/` og `/threads/…`, lys og mørk)     | **0 brudd** i alle fire                                  |

## Bør

### 1. Kommentaren om Tooltip sier det motsatte av hva komponenten gjør

`src/layout/Shell.tsx`, over veksleknappen:

> … and it contributes no accessible name at all, which is why `aria-label` is
> on the button and not left to this.

Målt i `@digdir/designsystemet-web` 1.21.0, `setupText`:

```js
if (text !== (el.getAttribute('aria-label') || el.getAttribute('aria-description'))) {
  const hasText = attr(el, 'role') !== 'img' && el.textContent?.trim();
  attr(el, ARIA_LABEL, hasText ? null : text);
  attr(el, ARIA_DESC, hasText ? text : null);
}
```

Tooltipen **blir** det tilgjengelige navnet når elementet ikke har tekst, og
en beskrivelse når det har. En ikonknapp har ikke tekst, så her ville den blitt
navnet.

Grunnen til at den ikke gjør noe i denne PR-en er den første linja:
`data-tooltip` og `aria-label` er samme streng, så hele blokka hoppes over.
Verifisert i tilgjengelighetstreet: navn «Vis tråder og filter» fra
`aria-label`, ingen `aria-description`, ingenting lagt til etter at tooltipen
er tegnet, og ingen kunngjøring i en live-region ved tastaturfokus.

Koden er altså riktig, men av en grunn som ikke står noe sted. **Endres
tooltip-teksten uten at `aria-label` endres likt, overskrives `aria-label`
stille.** Skriv invarianten inn i kommentaren: de to strengene må være
identiske, og det er det som holder tooltipen unna navnet.

(Min egen `design/designsystemet/komponenter/tooltip.md` beskrev mekanismen,
men ikke kortslutningen. Rettet i samme slengen.)

## Kan

### 2. Utledningen av 67 leser som 24 px padding på hver side

`src/layout/viewModel.ts`:

> `+24` `--ds-size-3` on each side, so the button sits clear of both edges.

Summen under er 42 + 24 + 1 = 67, og målt er `padding-inline` 12 px på hver
side. 24 er altså totalen, ikke «on each side». I en fil der utledningene
_er_ dokumentasjonen er det verdt de to ordene.

## Om at to tester ble slettet i `tests/e2e/layout.spec.ts`

Unntaket i briefen gjaldt **konstantene**. #5 slettet også to tester. Jeg har
ingen innvending mot resultatet: begge premissene forsvant med railen, hver
sletting står igjen som en kommentar på samme sted som sier hvorfor, og
påstanden om at ingen dekning gikk tapt stemmer — tilstanden «1280,
nav-aapent» dekkes fortsatt av matrisen, som måler både bredder og gulv.

At det ble gjort synlig og overlatt til meg å skrive erstatningene er den
riktige måten å gå utover et unntak på. Verdt at dirigenten vet at det skjedde.

## Erstatningene, skrevet nå

Tre tester i `tests/e2e/layout.spec.ts`, på `chore/e2e-rail`:

1. **«en kollapset sidekolonne er en rail på 67 px, med panelflate i begge
   moduser»** — bredde, kant og flate for begge sidekolonner, i lys og mørk.
   Flata sammenlignes med det _åpne_ panelets flate i samme modus, ikke med en
   farge skrevet ned i testen.
2. **«rail-knappen bærer etiketten som tilgjengelig navn og som tooltip»** —
   `toHaveAccessibleName`, ingen synlig tekst, `data-tooltip`, og at
   `.ds-tooltip` faktisk tegnes ved hover. Begge sidekolonner.
3. **«fokus overlever at veksleknappen byttes ut ved kollaps»** — begge
   retninger, begge sidekolonner. Dette er den nye feilveien i PR-en: railen
   pakker knappen i en `Tooltip`, og en wrapper som dukker opp rundt et element
   er et annet element for React, så knappen brukeren står på avmonteres.

## Det som er riktig, og hvor jeg sjekket det

- **Railen er 67 px**, begge sidekolonner, begge moduser. Målt: knapp 42 × 42,
  `padding-inline` 12/12, kant 1 px. 42 + 12 + 12 + 1 = 67.
- **Panelflate i begge moduser.** Railen har samme `background-color` som et
  åpent panel (lys `rgb(255,255,255)`, mørk `rgb(32,40,52)`) og ikke
  sideflatas (`rgb(243,244,244)` / `rgb(25,32,41)`), pluss kant. Begge
  sidekolonner; kildepanelet har fått kant det ikke hadde før.
- **Gapet mot en rail er 0**, målt og ikke bare påstått: ved 1280 med
  navigasjonspanelet åpent er raden 400 + 32 + 781 + 0 + 67 = 1280, og
  `main`-kantens avstand til railen er 0.
- **Gulvet er 640 igjen overalt.** `minWidthAlone` og 618 er borte fra modell,
  CSS, test og README. Den tilstanden som trengte unntaket har nå 141 px å gå
  på.
- **Fokusreparasjonen dekker begge veiene inn.** `useLayoutEffect` i stedet
  for `useEffect` er riktig valg og begrunnet i koden: en layout-effekt kjører
  før stilberegningen, så klausulen om `content.contains(active)` er den som
  faktisk fanger tilfellet. `hasFocus` som state og ikke ref er også riktig —
  effekten må lese verdien fra renderen den hører til.
- **Tilgjengelig navn er uendret mellom tilstandene**: «Vis tråder og filter» /
  «Skjul tråder og filter» fra samme utledning som før, og tooltipen vises
  også ved tastaturfokus (WCAG 1.4.13).
- **Designsystemet brukt som dokumentert**: `Button` med `icon` er
  ikon-bare-styling med ikonet som children og `aria-label` ved siden av, som
  `button.md` foreskriver. `Tooltip` med `content` som streng, som `tooltip.md`
  foreskriver.
- **README** har breddetabellen, rail-seksjonen med utledningen, gap-0-regelen
  og garantitabellen. Alle seks radene i garantitabellen stemmer med måling.
- **Ingen heksfarger, ingen nye px-tall i CSS, ingen `!important`.**

## Til dirigenten

1. **Klar for Lars.** De to funnene er kommentarer, ikke oppførsel, og kan
   like gjerne tas som en liten oppfølging som før merge.
2. **Erstatningstestene ligger på `chore/e2e-rail`** og er grønne mot denne
   branchen. De er røde mot `main` til #20 er inne, så merg #20 først.
3. Brukerblikk-funn 4 og 15 (panelflate i mørk, kildepanelet uten egen flate)
   er **ikke** løst av denne PR-en og hører fortsatt til rolle-5f. Railen har
   fått flate; det åpne kildepanelet har det fortsatt ikke.
