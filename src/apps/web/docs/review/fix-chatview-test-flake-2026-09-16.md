# PR #89, `fix/chatview-test-flake`: testene venter på rapporten

Anmeldt 2026-09-16. Hode `8b0b0a8`, base `main` (`109ede0` da PR-en ble laget,
`d97d376` nå — det som kom i mellom er min egen `#88`, én fil i `docs/review/`).
`git merge-tree --write-tree origin/main 8b0b0a8` går rent mot begge.

Én fil, `src/views/chat/ChatView.test.tsx`, 23 linjer inn og 11 ut. Ingen
produksjonskode, ingen e2e. Fillista stemmer med beskrivelsen.

**Ingen blokkerende funn. Ingen «bør». To «kan».**

## Portene

| Port                       | Resultat                     |
| -------------------------- | ---------------------------- |
| `npm run build`            | grønn                        |
| `npm run lint`             | grønn                        |
| `npm run format:check`     | grønn                        |
| `npm run tokens:verify`    | grønn                        |
| `npm test`                 | 55 filer, 574/574 på 15,85 s |
| CI («Lint, tests and e2e») | grønn, 6 m 2 s               |

Ingen WCAG-kjøring: PR-en endrer ikke DOM. Ingen full e2e-suite, etter avtale.

## Det som er riktig

1. **Premisset stemmer i kildekoden.** Rapporten kommer fra en `useEffect` i
   `src/views/chat/ChatView.tsx:182-232`, som sammenlikner `messages` mot det
   skallet holder og kaller `setAnswerSources`. En effekt kjører etter renderen,
   så teksten og rapporten er to avklaringer, akkurat som beskrivelsen sier.
   Dette er ikke tatt på tro fra PR-teksten; det er lest.
2. **Den utdaterte bindingen er borte.** Alle fire stedene leser
   `reported.at(-1)` på nytt etter ventingen i stedet for å holde på en
   `const last` fra før. Det var den formen som gjorde at feilen kunne bli
   stående usett.
3. **Ingen av de fire ventingene svekker påstanden de venter på.**
   - `ChatView.test.tsx:1119`, «to tilstander, ikke seks»: `waitFor` på hele
     rekka `['streaming', 'complete']`. En regresjon som rapporterer per token
     gir `['streaming', 'streaming', …]`, som aldri blir lik — testen ryker på
     tidsavbrudd i stedet for på første lesning. Vakten består.
   - `ChatView.test.tsx:1043-1047`, «én id hele veien»: ventingen er heist opp
     foran `ids`, og `reported.at(0)` står urørt. Sterkere enn før, ikke
     svakere.
4. **Å vente på `complete` og så lese `documents` synkront er trygt her.**
   Effekten sender `documents` og `status` i samme objekt
   (`ChatView.tsx:214-218`), og fixturen `sourcedAnswer` gir `sources` før
   `done`. Rapporten som bærer `complete` bærer derfor utdragene. Det er ikke
   en ny variant av den samme fella.
5. **Mønsteret fantes alt i fila**, `ChatView.test.tsx:1089`. PR-en gjør resten
   lik den, den finner ikke på noe nytt.
6. **Ingen glemte steder.** Alle fem testene i fila som samler `reported`
   (linje 295, 767, 1030, 1058, 1099) venter nå før de leser.

## Rød uten fiksen: ikke bevist, og det skal stå slik

Regelen er å se diffen, ikke bare kjøre. Jeg tilbakestilte fila til `origin/main`
i mitt eget arbeidstre og bekreftet at tilbakestillingen traff: diffen mot hodet
ble 11 inn og 23 ut, nøyaktig speilvendt av fiksen, og antallet
`waitFor(() => expect(reported` i fila gikk fra fire til **én** — den ene som
skal være igjen, den fra før på linje 1089. Null hadde vært feil tall, og det er
det som skiller en ekte tilbakestilling fra et søk som ikke traff.

Så kjørte jeg den gamle koden:

| Kjøring                                                           | Røde |
| ----------------------------------------------------------------- | ---- |
| `ChatView.test.tsx` alene, 10 ganger                              | 0    |
| Full unit-suite, 3 ganger (load ~4)                               | 0    |
| Full unit-suite, 2 ganger under åtte opptatte kjerner (load ~9,4) | 0    |

15 kjøringer, null røde. #3 melder 18 kjøringer med samme resultat. **Rasen er
altså ikke gjenskapt på bestilling, verken av eieren eller av meg.**

Det som bærer fiksen er derfor ikke en frekvens, men to andre ting: mekanismen
er lest i kildekoden (punkt 1), og tilstanden er observert direkte én gang av #5
med en probe på påstandsstedet — `reported` var `['streaming']`. PR-beskrivelsen
sier dette selv, uten å pynte på det, og det er riktig gjort.

At ventingen ikke kan skjule en ekte feil (punkt 3) er det som gjør at en
ubevist rase likevel er verdt å tette: kostnaden ved å ta feil er null.

## Kan

1. **`ChatView.test.tsx:1089` er en lengdevakt der de fire andre er
   tilstandsvakter.** `waitFor(() => expect(reported.length).toBeGreaterThan(0))`
   og så `at(-1)` synkront er trygt i dag, fordi fixturen har nøyaktig én
   assistentmelding og dermed nøyaktig én rapport. Får den tråden en
   assistentmelding til, er den gamle fella tilbake på det stedet. Eieren
   avgjør om den skal legges om nå eller merkes.
2. **`waitFor` på linje 1119 slipper i det øyeblikket rekka er
   `['streaming', 'complete']`.** En ekstra rapport som kommer etterpå blir ikke
   sett. Det er ikke en regresjon — den synkrone lesningen før leste også bare
   ett øyeblikk — men det er verdt å vite at testen ikke er en vakt mot en
   rapport for mye på slutten.

## Til dirigenten

Klar for Lars. Ingen blokkerende, ingen «bør». De to «kan» kan tas når noen
likevel er inne i fila; de er ikke verdt en runde alene.
