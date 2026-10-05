# PR #160: trådlista slik Lars ba om, og boksen som måtte bli en del av raden

Anmeldt av KA CC 2026-09-23. `feat/thread-list-lars-2026-09-23`, fem runder,
merget som `056c3e5`.
Sju punkter fra Lars, pluss understreken, og en hover-boks som skulle vise det
én linje med ellipse kutter bort. Punktene holdt hver gang de ble målt.
Boksen trengte fire runder, og kommentarene en femte.

## Lars sine punkter, målt

Målt i runde 2 og 3, med samme resultat begge gangene:

| Punkt                                    | Målt                                                      |
| ---------------------------------------- | --------------------------------------------------------- |
| sidemarg `size-5`                        | **20 px**, begge sidepaneler (kildepanelet åpent)         |
| hele raden er lenke                      | tid og korpus ligger inne i `<a>`                         |
| navn = tittelen alene                    | «NKOM måloppnåelse», via `aria-labelledby`                |
| seksjonstitler 21 px, svarte, uten ramme | 21 px, `rgb(31, 44, 61)`, `border 0`                      |
| «Tidligere tråder» sr-only               | `h2.ds-sr-only`, så panelet ikke hopper fra `h1` til `h3` |
| én linje med ellipse                     | 1 linje, `nowrap`, `ellipsis`                             |
| ingen understrek                         | `none`                                                    |
| `padding-block-end` 0                    | `0px`                                                     |
| peker                                    | `pointer`                                                 |

Raden er 44 px uansett tittel (målt 43,5), og lista er 503 px der den var
624 (#2 sitt tall). Den hvilende raden har ingenting som skiller en tittel fra
brødtekst — det er valget Lars tok, og det er verdt å vite at det er det raden
hviler på: lenkefargen, pekeren, hover-flata og fokusringen bærer
invitasjonen.

## Runde 1: `060188a`, to ting før e2e

**Sidemargen gjelder begge panelene**, og det er riktig lest: Lars nevnte
variabelen, ikke trådpanelet. Men da ble beholderspørringen
`@container (width < 380px)` død — den satte 20 px på det klemte kildepanelet,
og det er nå verdien overalt. Den ble fjernet.

**Boksen hadde `pointer-events: none`**, så raden under beholdt hoveren. Men
boksen henger utenfor radens høyrekant, og pekeren som gikk dit forlot raden.
Boksen lukket seg mens leseren sto på den: den klassiske måten å bryte 1.4.13
«hoverable» på. Jeg ba om at boksen tar imot pekeren, og at raden og boksen
lukkes som én flate.

## Runde 2: `a93f49e`, 1 blokkerende

Boksen tok imot pekeren, og raden lukket den fra `relatedTarget` i stedet for
en ren `pointerleave`. 1.4.13 holdt, målt på selve differansen: boksen 20 px
bredere enn raden, og med pekeren 15 px forbi radens høyrekant sto den.

Men e2e var 150/151:

```
en tråd fra lista åpner en hel samtale, med kildene bak svaret
  Expected pattern: /\/threads\/dss-regnskap$/
  Received string:  "http://localhost:4173/"
```

Boksen lå i en portal på `body`, `fixed` med `z-index: 3`, og dekket raden den
hørte til. Et klikk midt på raden landet på `SPAN.threads-view__overlay-title`
og gjorde ingenting — på nøyaktig de radene boksen finnes for.

Det var min regning. Jeg ba om `pointer-events` for 1.4.13 uten å si hva det
ville koste, og uten å prøve et klikk.

## Runde 3: `1089f8e`, 0 blokkerende, 2 bør, 1 kan

Fiksen var å flytte boksen **inn i lenka**. `position: fixed` tar den
fortsatt ut av panelets rullende boks, men i DOM-en er den en etterkommer av
raden, så et klikk på boksen er et klikk på raden. Ingen egen klikkhåndtering,
og ingen adresse skrevet to steder.

| Klikk                             | Hvor                                               | Resultat                                        |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| vanlig                            | boksens ytterkant, x 402, forbi panelkanten på 400 | tråden åpnes                                    |
| midtklikk                         | differansen, x 391                                 | ny fane med radens adresse, siden står          |
| Cmd-klikk                         | differansen                                        | ny fane med radens adresse                      |
| vanlig, lang tittel (boks 959 px) | ytterkanten, over hovedkolonnen                    | tråden åpnes                                    |
| vanlig, skuffa på 1100            | differansen, og ytterkanten over bakteppet         | tråden åpnes, skuffa står som for en vanlig rad |

**Uklippet**, målt med `elementFromPoint`, som tar hensyn til klipping: på
x 402 over en 403,6 px boks, og på x 500 og 976 over en 959 px boks, både på
1440 og i skuffa på 1100. Forfedrene med `container-type: inline-size` er
ikke containing block for `fixed` i Chromium; var de det, ville dialogens
`overflow: auto` klippet boksen ved 400.

### bør 1: fokusringen lå under boksen

Ekte Tab til en klippet rad: raden var `:focus-visible` med ringen på
`solid 3px`, men alle tre prøvepunktene på ringen tilhørte boksen, og boksen
hadde ingen ring. Fokus og hover så like ut. Med pekeren på en annen klippet
rad sto to rader i samme blå flate.

Det var ikke nytt i runde 3 — portalen dekket ringen på samme måte — men det
var blitt billig: boksen var et barn av lenka, så én regel når den.
Designsystemets `ds-focus`-klasser virker ikke der, fordi
`.ds-link:focus-visible *` tømmer `--_ds--focus` for alt inne i lenka. Prøvd
injisert: `.threads-view__thread:focus-visible > .threads-view__overlay` med
`--dsc-focus-outline` ga ringen ved Tab og ingen ved hover alene.

### bør 2: Escape i skuffa lukket skuffa også

Boksen sto, Escape: boksen lukket, **og skuffa lukket**, med fokus til «Vis
tråder og filter». 1.4.13 «dismissible» ber om en måte å lukke boksen på uten
å flytte fokus. Prøvd injisert med `preventDefault()` i fangstfasen mens en
boks står: første Escape lukket boksen, andre skuffa. Det er rekkefølgen
plattformen bruker selv, der en popover i en dialog lukkes før dialogen.

### kan: `container-type` uten spørring

Etter at 380-regelen ble borte, finnes ingen navnløs beholderspørring igjen.
`container-type: inline-size` på plassene og på `.drawer` er død, og boksen
bor nå inne i begge. En motor som gir `container-type` layout containment
ville klippet den ved skuffkanten. Safari 16 er ikke målt. Står på listen til
#5.

## Runde 4: `5e5657a`, 0 blokkerende, 1 bør, 1 kan

Begge bør fra runde 3 er lukket, og tekstene som beskrev portalen er rettet.
E2E 151/151.

**Fokusringen, ved ekte Tab.** En regel på
`.threads-view__thread:focus-visible > .threads-view__overlay`, skrevet med
lengdeformer fordi linteren fra #159 avviser `outline`-kortformen for Safari
16.0:

|                                           | Radens ring                               | Boksens ring        |
| ----------------------------------------- | ----------------------------------------- | ------------------- |
| 1440 lys                                  | `solid 3px rgb(31, 44, 61)`, offset −3    | samme               |
| 1440 mørk                                 | `solid 3px rgb(235, 236, 237)`, offset −3 | samme               |
| 1100, skuff                               | `solid 3px rgb(31, 44, 61)`, offset −3    | samme               |
| hover alene                               | —                                         | `none`              |
| peker på én klippet rad, Tab til en annen | den hoverte: hover-flate, ingen ring      | den fokuserte: ring |

Sett på skjermbildene, ikke bare lest av stilen, som var fella i runde 2.

**Escape i rekkefølge.** `preventDefault()` i fangstfasen mens boksen står:

|             | 1. Escape                                  | 2. Escape                                       |
| ----------- | ------------------------------------------ | ----------------------------------------------- |
| 1440, Tab   | boksen lukket, fokus på raden              | —                                               |
| 1100, peker | boksen lukket, skuffa står, fokus urørt    | skuffa lukket, fokus til «Vis tråder og filter» |
| 1100, Tab   | boksen lukket, skuffa står, fokus på raden | skuffa lukket, fokus til «Vis tråder og filter» |

De to andre Escape-lytterne i appen, i `AnswerSearch` og `SourceExcerpt`,
leser ikke `defaultPrevented`, så fangstlytteren tar ingenting fra dem.

**bør: fire kommentarblokker på norsk**, mot `regler.md`: over
`--ka-sidebar-padding-inline` i `global.css`, 1lh-reserven i `filters.css`,
Escape-lytteren i `ThreadLink.tsx` og fokusregelen i `threads.css`. De to
første sto der fra runde 1, og jeg meldte dem ikke før nå.

**kan:** kommentaren over fokusregelen nevner `--dsc-focus-outline`, som
regelen ikke bruker. Lengdeformene er det samme, men den som leser leter
etter en variabel som ikke står der.

## Runde 5: `c915da6`, 0 funn

Bare kommentarlinjer mot `5e5657a`, lest linje for linje, så portene og ikke
e2e. De fire blokkene er engelske med samme innhold, og kan-en er tatt med:
kommentaren over fokusregelen nevner ikke lenger en variabel regelen ikke
bruker, og den sier hvorfor regelen er skrevet med lengdeformer.

## Om min egen måling

To ganger i samme PR målte jeg stilen og ikke virkningen. I runde 1 ba jeg om
`pointer-events` uten å prøve klikket det kunne koste. I runde 2 målte jeg
fokusringens stil, `solid 3px` offset −3, og skrev den i tabellen, uten
å spørre om noe lå over den. Begge er nå felle i `README.md`: en rettelse jeg
ber om prøves på hovedhandlingen etterpå, og en ring måles med hvem som eier
pikslene og et skjermbilde, ikke med `outline-style`.
