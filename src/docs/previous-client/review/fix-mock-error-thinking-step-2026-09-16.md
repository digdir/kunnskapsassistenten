# PR #81, `fix/mock-error-thinking-step`: feilstien tenker på spørsmålet som ble stilt

2026-09-16, anmelderen (KA CC). Anmeldt på den rebasede `9fa39ef` slått
sammen med `origin/main` (`29923de`, som har #80, #82 og #83). Rent
sammenslått. Bygget app på `vite preview` 5184, 1440 × 900.

Svarer på brukerblikk runde 3, funn 4.

## Rebasen løste konflikten riktig

Den forrige shaen (`a4ac3e0`) kolliderte med #82 i nøyaktig de to hunkene
#82 hadde rørt, og den farlige utgangen var å ta HEAD rått: da forsvant
`stepsSent.push(...)` fra begge stiene, og en tur som stoppes i vinduet
mellom tenkesteget og feilramma ville mistet tenkepanelet sitt etter en
oppfriskning — #82 sitt funn 6, i stillhet. Den rebasede utgaven gjør begge
deler:

```
333  const failureStep = failureThinkingStep(simulated, params.query, this.#delays.firstTokenMs);
334  stepsSent.push(failureStep);
350  const clarificationStep = clarificationThinkingStep(this.#delays.firstTokenMs);
351  stepsSent.push(clarificationStep);
```

`nkomThinkingSteps` er fortsatt importert og brukt på den vanlige stien
(linje 413), så importen er ikke blitt død.

## Portene

| Port            | Resultat                                    |
| --------------- | ------------------------------------------- |
| `build`         | grønt                                       |
| `lint`          | grønt                                       |
| `format:check`  | grønt                                       |
| `tokens:verify` | grønt                                       |
| `test` (vitest) | 549 av 549, 54 filer                        |
| `test:e2e`      | **128 av 128**, 1,8 min, port 4173, CI=true |

E2E var ikke kjørt etter rebasen, så jeg kjørte den. To filer, som
beskrivelsen sier.

## Funn 4 er lukket

Alle sju inngangene målt i bygget app:

| Spørsmål                | Tenkepanel                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `simuler ingen treff`   | «Jeg søker i korpuset» + «Ingen utdrag kom over relevansterskelen.» |
| `simuler avklaring`     | «Jeg leser spørsmålet» + begrunnelsen for å spørre tilbake          |
| `simuler tidsavbrudd`   | intet panel                                                         |
| `simuler feil korpus`   | intet panel                                                         |
| `simuler feil modell`   | intet panel                                                         |
| `simuler avvist nøkkel` | intet panel                                                         |
| `simuler feil`          | intet panel                                                         |

«Jeg deler spørsmålet i to: hvordan måloppnåelse gjøres opp …» er borte fra
alle sju. At bare to av dem tegner panel stemmer med beskrivelsen.

Mockens forsinkelser målt mot det den erklærer, på `fast`:

```
Enter → tenkesteg   536 ms   (thinkingStepMs: 500)
tenkesteg → svar    303 ms   (firstTokenMs: 300)
```

`durationMs` er satt til `firstTokenMs`, altså det samme intervallet. Det
stemmer.

### Sjekket, og det er riktig

- **«Tenkte i 1 sekund» for en ventetid på 0,3 s** er ikke denne PR-ens
  avrunding. `thoughtForLabel` i `thinkingTime.ts` har et gulv på ett sekund,
  med begrunnelsen skrevet ved siden av: «Tenkte i 0 sekunder» leses som en
  feil. Gulvet er eldre enn PR-en.
- **Avklaringssteget nevner måloppnåelse** selv om spørsmålet var «simuler
  avklaring». Det så ut som funn 4 om igjen, men `clarificationMarkdown` sier
  det samme ett steg senere — hele den scriptede avklaringen handler om
  måloppnåelse, uavhengig av hva som ble skrevet. Steget og svaret er enige,
  som beskrivelsen sier.

## Funn

### 1. `queries` vises ikke noe sted — kan

Beskrivelsen og kommentaren i `MockChatClient.ts:160` bygger sikkerheten på
`queries`: «leserens egne ord … så panelet ikke kan handle om noe annet
uansett hvilken kode det ble». Men ingen visning tegner det feltet.
`ThinkingPanel.tsx:106–109` tegner `step.label` og `step.detail`, og ikke noe
mer:

```html
<li class="ka-thinking__step">
  <p class="ds-paragraph">Jeg søker i korpuset</p>
  <p class="ds-paragraph ka-thinking__detail">Ingen utdrag kom over relevansterskelen.</p>
</li>
```

Chipsene «Nøkkelord som ble brukt i søket» kommer fra `RetrievalPanel` og
`Retrieval.queries` — et annet objekt på et annet sted i svaret, ikke
`ThinkingStep.queries`. `grep -rn queries src` gir null treff i noen `.tsx`
utenom den.

Det gjør ikke funnet uløst: det som faktisk står på skjermen er «Jeg søker i
korpuset», som er generisk og aldri galt. Men vernet er etiketten, ikke
`queries`, og det er verdt å si rett ut — ellers leser neste person
kommentaren og tror leserens ord står der.

Ikke innført her: `nkomThinkingSteps[1]` har hatt `queries` hele tida uten at
det er vist. Enten tegn feltet i `ThinkingPanel` (det er en liste under
detaljen), eller skriv kommentaren slik at den lover det den holder.

### 2. Ingenting dekker `stepsSent` på de to nye stiene — kan

De tre nye testene treffer det de skal: steget hører til spørsmålet, tida er
mockens egen, og avklaringen har sitt eget steg. Men `stepsSent.push(...)` —
det rebasen la til, og det som holder #82 sitt funn 6 i live for en tur som
stoppes mellom tenkesteget og feilramma — har ingen test. Det er et smalt
vindu (300 ms på `fast`), og jeg klarte ikke å treffe det pålitelig i
nettleseren; en unit-test på strømmen med et `AbortSignal` som utløses etter
tenkesteget ville låst det.

## Til dirigenten

Ingen blokkerende, ingen bør. To «kan», begge om tekst og dekning, ikke om
oppførsel.

Funn 4 er lukket på alle sju inngangene, rebasen løste konflikten på den
riktige måten, og suiten er grønn på sammenslåingen — den var ikke kjørt
etter rebasen.
