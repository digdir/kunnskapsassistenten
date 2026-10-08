# PR #80, `fix/threads-title-clamp`: trådtittelen stopper etter to linjer

2026-09-16, anmelderen (KA CC). Anmeldt på `f124528` slått sammen med
`origin/main` (`a241fc7`) — sammenslåingen er allerede fast-forward, så det som
måles er det som merges. Bygget app på `vite preview` 5184, 1440 × 900, lys og
mørk.

Svarer på brukerblikk runde 3 funn 5.

## Portene

| Port             | Resultat                 |
| ---------------- | ------------------------ |
| `build`          | grønt                    |
| `lint`           | grønt                    |
| `format:check`   | grønt                    |
| `tokens:verify`  | grønt                    |
| `test` (vitest)  | 535 av 535, 53 filer     |
| axe på trådlista | **0 brudd**, lys og mørk |

Fillista er de fire filene beskrivelsen omtaler: `ThreadLink.tsx`,
`ThreadLink.test.tsx`, `ThreadsView.tsx`, `threads.css`. Ingenting annet.

## Det som virker

Målt på 1440 × 900 med den nye tråden øverst:

```
«Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine
 årsrapporter for 2022 og 2023?»     78 → 54 px, scrollHeight 78, tooltip
«Regnskap og bevilgning i DSS sine årsrapporter»   54 px, ingen tooltip
«NKOM måloppnåelse»                               30 px, ingen tooltip
```

Funn 5 er dermed lukket: den nye raden er like høy som nabolinja med to
linjer, og ingen av radene som får plass har fått en tooltip de ikke trenger.
Hele tittelen står i DOM-en og er lenkas navn.

**Fokusringen overlever `overflow: hidden`**, som beskrivelsen lover. Målt med
fokus på den klippede raden: `outline: 3px` med `outline-offset: 3px`, tegnet
utenfor boksen i begge moduser. At ringen når ned i tidsstempelet er sant
(radens underkant og tidas overkant er begge y = 451), men avstanden er ikke
rørt i denne PR-en — bare `display` og `overflow` er endret på lenka.

**`display: -webkit-box` er ikke overstyrt, selv om det ser sånn ut.**
`getComputedStyle(...).display` gir `flow-root`, ikke `-webkit-box`, og det
skremte meg til å måle tre kontroller i samme Chrome (153.0.8010.12):

| Oppsett                                    | computed `display` | klipper |
| ------------------------------------------ | ------------------ | ------- |
| `-webkit-box` + `-webkit-line-clamp: 2`    | `flow-root`        | ja      |
| `-webkit-box` alene                        | `-webkit-box`      | nei     |
| `display: block` + `-webkit-line-clamp: 2` | `block`            | nei     |

Altså: `flow-root` er bare måten en `-webkit-box` med aktiv klamp serialiseres
på, og klippingen kommer fra den `-webkit-`-veien beskrivelsen beskriver — ikke
fra den uprefiksede `line-clamp: 2`, som denne Chrome-en avviser som
parsefeil (`parsedOk: false`). Kommentaren i CSS-en sier akkurat dette, og den
har rett.

## Funn

### 1. Målingen kjøres ikke på nytt når raden blir den åpne — bør

`src/views/threads/ThreadLink.tsx:34–54`. `useEffect` har `[thread.title]` som
avhengighet, og `ResizeObserver` ser elementets egen boks. Men
`threads.css:144` gir den åpne tråden `font-weight: var(--ds-font-weight-semibold)`.
Vekten endrer tekstens bredde uten å endre boksen: samme rad måler 265 px
tekst på vekt 400 og 271 px på 600. Klampen låser høyden til to linjer, så
`ResizeObserver` får aldri noe å rapportere.

Reprodusert i appen med et spørsmål på 79 tegn, som er innenfor to linjer på
vekt 400 og utenfor på 600:

```
montert som ikke-åpen    vekt 400  scrollHeight 54 = clientHeight 54   tooltip: nei
klikket, nå åpen         vekt 600  scrollHeight 78 > clientHeight 54   tooltip: NEI   ← mangler
```

og motsatt vei, samme rad i samme økt:

```
laget, er åpen           vekt 600  scrollHeight 78 > clientHeight 54   tooltip: ja
åpnet en annen tråd      vekt 400  scrollHeight 54 = clientHeight 54   tooltip: JA    ← står igjen
```

Begge tilfellene er nøyaktig de to tingene komponentens egen kommentar sier den
vil unngå: en tooltip på en rad som ikke er klippet, og en rad som må si
tittelen sin to ganger for skjermleseren. Den første raden mister dessuten
slutten av tittelen bak en ellipse uten at noe tilbyr den.

Rettelsen er å ta `current` med i avhengighetene.

`blikk3/pr80-04-klippet-uten-tooltip-1440-light.png`

### 2. Den samme målingen skjer før Inter er lastet — bør

Samme årsak, annen utløser. `index.html:9` henter Inter fra
`altinncdn.no` som et eksternt stilark, og `document.fonts.status` er
`loading` i det trådradene monteres og måler seg (målt). Når skriften byttes
inn, endres tekstmetrikken — og igjen uten at elementets boks endrer seg, så
`ResizeObserver` tier.

Ingen rad i dagens fixtures vipper på dette, så det er ikke synlig nå. Men det
er den samme klassen feil som funn 1, og dekkes av det samme grepet:
`document.fonts.ready.then(measure)` ved siden av den første `measure()`.

### 3. En klippet rad sier fortsatt tittelen sin to ganger — kan

Når tooltipen er riktig satt, er `title` tegn for tegn lik lenkas
tilgjengelige navn, som kommer fra innholdet. Skjermlesere som leser `title`
som beskrivelse leser da den samme setningen to ganger på rad.

Kommentaren i `ThreadLink.tsx:24–29` begrunner den betingede tooltipen med
nettopp dette — men begrunnelsen dekker bare radene som **ikke** er klippet.
På de klippede står dobbeltlesingen igjen, og det er de radene som har de
lengste titlene.

Ikke et AA-brudd, og en tooltip er den eneste pekerveien til den skjulte
teksten, så alternativene er ikke gratis. Eierens avgjørelse. Verdt å vite at
prisen er betalt på de lengste radene, ikke spart.

### 4. Unit-testene kan ikke fange funn 1 — kan

`ThreadLink.test.tsx` setter `scrollHeight` og `clientHeight` selv, som er den
eneste måten i jsdom. Det gjør at de fem testene beviser logikken —
terskelen på én piksel, navnet, `aria-current` — men ikke at målingen skjer
til riktig tid. Funn 1 var usynlig for dem og synlig i nettleseren på første
klikk.

En e2e-linje i `primary-sidebar.spec.ts` som klikker en lang rad og leser av
`title` ville låst begge retningene. Jeg legger den gjerne inn i min egen PR
hvis dirigenten vil.

## Til dirigenten

Ingen blokkerende. Funn 1 er en linje i avhengighetslista og bør med før
merge, siden den slår ut på første klikk i den tilstanden PR-en er laget for.
Funn 2 er en linje til på samme sted. Funn 3 og 4 er avgjørelser.
