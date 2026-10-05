# PR #24, kildepanelet tåler 336 px

2026-09-15, anmelderen (KA CC). `feat/secondary-sidebar` @ `93023be`
(`7f81de7`, `93023be`). Fasit: `design/_briefs/bygg/rolle-4b-brukerblikk.md`,
funn 1 og 11 i `brukerblikk-2026-09-15.md`.

**Klar. Ingen blokkerende.** Begge funnene er rettet, og funn 1 er rettet så
langt det går uten å røre layoutbeslutningen.

## Portene

| Sjekk                                               | Resultat                                        |
| --------------------------------------------------- | ----------------------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | OK                                              |
| `npm test`                                          | 129 tester, 17 filer, grønne                    |
| `npm run test:e2e`                                  | 58 grønne, 0 røde                               |
| axe (`a11y.sh`, 1440, begge ruter, lys og mørk)     | **0 brudd**, 1 uavklart (`Suggestion`, fra før) |

## Funn 1: utdragsteksten, målt før og etter

|                            | Panel | Tekstkolonne | Linjer for ett kort avsnitt |
| -------------------------- | ----- | ------------ | --------------------------- |
| Før (main før denne PR-en) | 336   | **174 px**   | 30                          |
| Etter, 1440                | 336   | **246 px**   | **20**                      |
| Etter, 1536                | 432   | 270 px       | 18                          |

72 px hentet tilbake uten å endre panelbredden, ved å ta dem fra kortets egen
padding under 320 px containerbredde. Nøyaktig tallet dirigenten ventet.

**Verdt å si tydelig: funnet er kraftig forbedret, ikke borte.** 246 px er
rundt 30 tegn på linja, mot de 45–75 som er vanlig råd for brødtekst. Det er
det som er mulig så lenge panelet er 336 px på 1440, og panelbredden er
layoutbeslutningen — ikke #4 sin å endre. Ved 1536 og oppover, der panelet er
432, er kolonnen 270 px og saken er mindre.

Om noen vil lenger enn dette må det være beslutningen som flyttes, ikke
kortene: det er ikke mer padding igjen å ta.

## Funn 11: endene er ender

Målt gjennom hele søket, 8 treff:

| Tilstand  | Forrige                                                       | Neste                                                         |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| treff 1   | `aria-disabled="true"`, `opacity: 0.3`, `cursor: not-allowed` | aktiv                                                         |
| treff 2–7 | aktiv                                                         | aktiv                                                         |
| treff 8   | aktiv                                                         | `aria-disabled="true"`, `opacity: 0.3`, `cursor: not-allowed` |

`aria-disabled` og ikke `disabled`, som er riktig: knappen blir stående i
tabbrekkefølgen, så en tastaturbruker ikke faller ut av gruppa når hen kommer
til enden. Og forskjellen er **synlig**, som var hele funnet — 0.3 i opasitet
leses tydelig ved siden av den aktive.

Kontrasten på den nedtonede knappen faller under 4,5:1, og det er greit:
WCAG 1.4.3 unntar inaktive komponenter eksplisitt. Verdt å ha skrevet ned så
ingen «retter» det senere.

## Funn 15-nabo: orddeling på dokumenttitlene

`hyphens: auto` med `lang="nb"` på rota, og det virker: kortets tittel bryter
som «kommunikasjonsmyn-dighet» og metalinja som «kommunika-sjonsmyndighet»,
med ekte bindestrek. Sett i `skjermbilder-frontend/pr24-kildepanel-1440.png`.

`overflow-wrap: break-word` og ikke `anywhere` er riktig valg og begrunnet i
koden: det bryter bare et ord som ikke får plass på en linje alene, og lar
`min-content`-bredden være. Med `anywhere` ville kortet kunnet krympe under
det modellen lover.

## Det som er riktig, og hvor jeg sjekket det

- **Container query og ikke mediespørring.** `container: sources /
inline-size` på selve viewet, og terskelen `< 320px`. Det er det riktige
  spørsmålet: plassen er 432 eller 336 avhengig av vinduet, og viewet kan
  flyttes til en annen plass (svar 48), så en vindusbredde ville svart på feil
  spørsmål i begge retninger. Regnestykket i kommentaren stemmer med måling:
  336 − 72 padding = 264 (kompakt), 432 − 72 = 360 (romslig).
- **Én variabel for hele kortet.** `--dsc-card-padding` settes ett sted, så
  tittel, utdrag og fot holder takt. Ingen egne klasser per blokk.
- **`container-type: inline-size`** koster ingenting her, som kommentaren
  sier: bredden kommer fra plassen, aldri fra innholdet — og plassen har
  allerede `min-inline-size` fra modellen.
- Ingen heksfarger, ingen nye tallverdier i px, ingen `!important`.
- Alle filer i `src/views/sources/`. Ingenting utenfor #4 sitt eierskap.

## Til dirigenten

1. **Klar for Lars.**
2. **Funn 1 er ikke lukket, det er halvert.** 174 → 246 px er så langt kortene
   rekker. Skal utdragene leses komfortabelt på 1440, er neste trekk
   panelbredden, og det er din beslutning og ikke #4 sin. Jeg ville latt det
   stå til noen faktisk leser utdrag i bruk.
