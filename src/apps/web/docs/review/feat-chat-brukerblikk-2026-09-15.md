# PR #23, brukerblikk-funnene i hovedkolonnen

2026-09-15, anmelderen (KA CC). `feat/chat-brukerblikk` @ `089dd1b`
(`e1ec8bc`, `6dd6275`, med `main` merget inn). Fasit:
`design/_briefs/bygg/rolle-3c-brukerblikk.md` og funn 5, 6, 9 og 10 i
`brukerblikk-2026-09-15.md`.

**Klar. Ingen blokkerende.** Alle fire funnene er rettet, og målt rettet.

## Portene

| Sjekk                                                   | Resultat                            |
| ------------------------------------------------------- | ----------------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify`     | OK                                  |
| `npm test`                                              | 147 tester, 20 filer, grønne        |
| `npm run test:e2e`                                      | 56 grønne, 0 røde                   |
| axe (`a11y.sh`, 1440, `/` og `/threads/…`, lys og mørk) | **0 brudd**, 2 uavklarte (se under) |

## De fire funnene, målt

| Funn                                         | Før                                                                        | Etter                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **5** samme samtale ulik på de to rutene     | `/` hadde ingen `h2`; første synlige overskrift var svarets `h3`           | `h2` på begge ruter. Trådruta viser «NKOM måloppnåelse» på 36 px; `/` har samme `h2` med spørsmålet som tekst, `ds-sr-only`                                  |
| **6** kortet kuttet hardt under skrivefeltet | Hvit flate stoppet dødt midt i en setning                                  | `scroll-padding-block-end: 278px` målt på `.main`, og en 24 px uttoning over det klebrige feltet. Siste linje forsvinner i grunnen i stedet for å bli kappet |
| **9** «Prøv igjen» to ganger                 | Teksten sa «Noe gikk galt. Prøv igjen.» én linje over knappen «Prøv igjen» | «Svaret kom ikke fram / Noe gikk galt.» Målt: **én** forekomst av «Prøv igjen» i hovedkolonnen, og den er knappen                                            |
| **10** avbryt var et umerket kvadrat         | Bare ikon                                                                  | Synlig «Avbryt», tilgjengelig navn «Avbryt genereringen». Navnet begynner med den synlige teksten, som WCAG 2.5.3 krever                                     |

## De to uavklarte axe-funnene, vurdert manuelt

Sjekklista sier at `incomplete` skal vurderes, ikke ignoreres. Det ene,
`aria-required-children` på tre noder, er Designsystemets `Suggestion` og står
fra før. Det andre er **nytt i denne PR-en**: `color-contrast` på fem noder,
alle inne i det nye `.ka-composer-area`.

Årsaken er uttoningen: et `::before` med `linear-gradient` er et posisjonert,
delvis gjennomsiktig element, og da kan ikke axe regne ut hva som ligger bak
naboene. Det er verktøyet som gir opp, ikke fargene. Målt for hånd, mot første
ugjennomsiktige forelder:

| Element                  | Lys     | Mørk    |
| ------------------------ | ------- | ------- |
| Skrivefeltets tekst      | 14,13:1 | 12,55:1 |
| Oppfølgingschipene (× 3) | 11,54:1 | 11,54:1 |
| Ansvarsfraskrivelsen     | 5,97:1  | 6,86:1  |

Alle over 4,5:1. Plassholderfargen er `color(srgb … / 0.7)`, som måleren min
ikke leser; komponert for hånd mot hvit gir den ≈ 5,2:1. Ingen reell endring i
kontrast, men verdt å vite hvorfor tallet i rapporten gikk fra 1 til 2 —
neste gang noen ser «2 uavklarte» skal de slippe å regne på nytt.

## Kan

### 1. Skjermleseren hører spørsmålet to ganger på `/`

Målt på hovedkolonnens tekst etter et spørsmål:

```
Kunnskapsassistenten        ← h1, ds-sr-only
Hvordan jobber Nkom …       ← h2, ds-sr-only (trådhodet)
Du skrev:                   ← ds-sr-only
Hvordan jobber Nkom …?      ← brukerens melding
```

Det er en villet avveining, og den står skrevet i `threadHeading.ts`:
overskriften blir i dokumentet så disposisjonen er lik på begge ruter, og det
er den andre kopien _på skjermen_ som forsvinner. Poenget står. Men prisen er
at den som navigerer på overskrifter hører spørsmålet, og så hører det igjen
med én gang.

Ikke et brudd, og ikke noe jeg foreslår å endre nå — men dirigenten avgjorde
dette før noen hadde hørt hvordan det ble, og nå er det målt.

### 2. Forkortelser kutter stand-in-tittelen

`firstSentence()` deler på «tegn + mellomrom», så «bl.a. », «f.eks. » og
«ca. » leses som slutten på setningen. «Hva rapporterer Nkom om bl.a.
måloppnåelse?» gir tittelen «Hva rapporterer Nkom om bl.a».

Den tittelen er alltid `ds-sr-only` — stand-in-en vises aldri, siden
`repeatsQuestion` er sann per konstruksjon når det ikke finnes en ekte tittel
— så dette er noe en skjermleserbruker hører, ikke noe som vises. Lav
alvorlighet, men det er norsk tekst og forkortelser er vanlige.

## Det som er riktig, og hvor jeg sjekket det

- **`threadHeading()` skjuler bare når tittelen faktisk gjentar spørsmålet.**
  `saysTheSame` normaliserer store bokstaver, mellomrom og sluttegn og
  ingenting mer, som er riktig gjerrig: en løsere sammenligning ville skjult
  en ekte tittel som tilfeldigvis starter likt.
- **`withoutRetryPrompt` er forankret til slutten** (`…$`), så «Prøv igjen
  senere» og setninger som nevner ordene midt inni står urørt, og
  `GENERIC_CHAT_ERROR` fanger tilfellet der trimmingen ikke etterlater noe.
- **Uttoningen tar ikke pekerhendelser** (`pointer-events: none`), så teksten
  under er fortsatt tekst du kan merke.
- **`scroll-padding` måles i stedet for å skrives ned.** Feltet vokser med
  spørsmålet (`field-sizing: content`) og chipene kommer og går, så høyden er
  ikke et tall dette viewet vet. `ResizeObserver` med opprydding i
  `useEffect`, og `scrollPaddingBlockEnd` nullstilles når chatten forlater
  plassen — den tilhører skallet, ikke viewet.
- **WCAG 2.4.11 er den riktige begrunnelsen** for `scroll-padding`: uten den
  kan en kildemarkør eller en handlingsknapp nådd med Tab havne bak feltet.
- **Alt ligger i `src/views/chat/`.** Ingen filer utenfor #3 sitt eierskap.

## Rettet i min egen fil

`chat.spec.ts` lette etter spørsmålet hvor som helst på sida. Etter denne
PR-en finnes samme tekst også i trådhodet, uten spørsmålstegnet — så testen
passerte bare fordi strengen min hadde et «?». Det er en grunn til at en test
passerer, ikke grunnen den burde passere av. Nå er den låst til
`.ka-message--user`. Grønn både mot `main` og mot denne branchen. Takk til #3
for å se det.

## Til dirigenten

1. **Klar for Lars.** De to «kan»-ene kan tas når som helst, eller ikke.
2. **PR #26 var ikke merget** da du sa den var det — den sto åpen, så `main`
   hadde railen uten erstatningstestene mine. Den er nå rebaset på ny `main`,
   viser bare mine to filer, og er `MERGEABLE`.
3. `chore/e2e-chat` har den ene testrettelsen og denne rapporten.
