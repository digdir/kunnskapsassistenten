# PR #83, `fix/view-head-padding`: hovedkolonnens view-hode fester seg i toppen

2026-09-16, anmelderen (KA CC). Anmeldt på `9e451ff` slått sammen med
`origin/main` (`a0cd76b`, som inneholder #82). Sammenslåingen er det som
måles, og den er viktig her: PR-en ble laget mens hovedkolonnens view-hode
fortsatt var tomt, og #82 er det som fyller det. Bygget app på `vite preview`
5184, 1280 × 720, 1440 × 900 og 1536 × 900, lys og mørk.

Svarer på funnet i anmeldelsen av #82.

## Portene

| Port                        | Resultat                                    |
| --------------------------- | ------------------------------------------- |
| `build`                     | grønt                                       |
| `lint`                      | grønt                                       |
| `format:check`              | grønt                                       |
| `tokens:verify`             | grønt                                       |
| `test` (vitest)             | 546 av 546, 54 filer                        |
| `test:e2e`                  | **128 av 128**, 1,9 min, port 4173, CI=true |
| axe, rullet med stripa åpen | **0 brudd**, lys og mørk                    |

Beskrivelsen sier «Ingen e2e kjørt», så jeg kjørte den: en regel som flytter
et klebrig element er nettopp den typen `layout.spec.ts` måler. Den er grønn.
Én fil, `src/styles/global.css`, som beskrivelsen sier.

## Målt

Samme side, samme rullestilling (600), med regelen på og med den slått av i
nettleseren — så det er bare denne ene egenskapen som skiller de to:

|              | `inset-block-start` | hodets topp | bånd over hodet | hva som lå i båndet     |
| ------------ | ------------------- | ----------- | --------------- | ----------------------- |
| uten regelen | `0px`               | y = 32      | 32 px           | `TD` fra svarets tabell |
| med regelen  | `-32px`             | **y = 0**   | **0**           | stripas eget `INPUT`    |

Og over tre bredder, med søkestripa åpen:

| Vindu      | urullet                                               | rullet 200    | rullet 600    | vannrett rulling |
| ---------- | ----------------------------------------------------- | ------------- | ------------- | ---------------- |
| 1280 × 720 | hode y = 32, 32 px luft (`MAIN.main`, altså bakgrunn) | y = 0, bånd 0 | y = 0, bånd 0 | nei              |
| 1440 × 900 | samme                                                 | y = 0, bånd 0 | y = 0, bånd 0 | nei              |
| 1536 × 900 | samme                                                 | y = 0, bånd 0 | y = 0, bånd 0 | nei              |

Begge påstandene i beskrivelsen holder altså: lufta står igjen når leseren er
på toppen, og den er borte når hodet fester seg. Navigasjonspanelets eget
view-hode står på y = 90 med `inset-block-start: 0px` i alle tilfellene, før
som etter — sidepanelene er ikke rørt.

`--ds-size-8` måler 32 px, så regelen er tokens og ikke en hardkodet piksel.

## En felle i min egen måling, skrevet ned

Hovedkolonnen ruller på `main` selv (`overflow-y: auto`), ikke på en boks
inni. Min vanlige hjelper leter etter en rullende etterkommer med
`main.querySelectorAll('*')`, og den finner ingen her — så tre «målinger» ved
rulling 0, 200 og 600 ga tre identiske tall uten at noe hadde rullet. Det så
ut som et svar. Det var ingen måling.

Tallene over er tatt opp igjen med `main.scrollTop` og med `scrollTop` lest
tilbake i samme avlesning. Hører hjemme i `README.md` under fellene i
målingen, og jeg legger den inn der.

## Funn

### 1. To uavhengige referanser til den samme 32-er — kan

`.main` setter `padding-block: var(--ds-size-8)` (linje 549) og regelen setter
`inset-block-start: calc(-1 * var(--ds-size-8))` (linje 539). Samme token, så
de er enige i dag, men ingenting knytter dem sammen: gir noen hovedkolonnen en
annen `padding-block`, glir hodet stille 32 piksler ned igjen — og hele
poenget med denne PR-en er at akkurat det avviket er usynlig til noen ruller.

En delt egenskap på `.main` — `--ka-main-padding-block`, brukt av begge —
gjør at de ikke kan skille lag. Eierens avgjørelse; det er to linjer.

## Til dirigenten

Ingen blokkerende, ingen bør. Ett «kan» som er maintainability, ikke
oppførsel.

Funnet fra #82 er lukket, målt før og etter på samme side, og e2e-suiten er
grønn på sammenslåingen — den var ikke kjørt i PR-en.
