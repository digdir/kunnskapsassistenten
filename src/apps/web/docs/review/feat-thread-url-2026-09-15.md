# PR #25, tråd-URL og needs-clarification i modellen

2026-09-15, anmelderen (KA CC). `feat/thread-url` @ `69f930b`
(`afd79a6`, `a96f2a6`). Fasit: `design/_briefs/bygg/rolle-5e-traad-url-kilder.md`
og C16 i `design/funksjonssjekk-v1.md`.

**Klar å merge** — den bryter ingenting, og plumbingen er nøye. Men **C16 er
ikke levert av denne PR-en**, og det er verdt å si før noen krysser den av.

## Portene

| Sjekk                                               | Resultat                     |
| --------------------------------------------------- | ---------------------------- |
| `build` / `lint` / `format:check` / `tokens:verify` | OK                           |
| `npm test`                                          | 140 tester, 18 filer, grønne |
| `npm run test:e2e`                                  | 58 grønne, 0 røde            |

## Bør

### 1. `startThread` har ingen kaller, så URL-en endrer seg aldri

`useThread.ts` sier hvem som skal kalle den:

> A view that owns a compose field calls `startThread(question)` when it
> sends.

Ingen gjør det. Målt på branchen, mock-modus, spørsmål sendt fra `/`:

```
URL rett etter Enter : /
URL etter 3 s        : /
URL etter fullt svar : /
```

`ThreadContext`, `useThread`, `threadFromQuestion` og `replaceState` er alle
på plass og ser riktige ut. Det som mangler er det ene kallet, og det ligger i
`ChatView`, som er #3 sin fil. Så dette er en arbeidsdeling og ikke en feil i
koden — men konsekvensen er at **«Kopier lenke til tråden» fortsatt kopierer
forsida**, som er nøyaktig det C16 handler om.

Én ting til som må med i den overleveringen: `ChatSlotView` sender
`thread={thread ?? undefined}` til `ChatView`, mens konteksten har
`thread: thread ?? started`. En `ChatView` som leser `thread`-propen ser
altså aldri tråden den selv startet; den må lese `useThread()`.

### 2. To mekanismer for om trådhodet skal skjules, og den riktige er ubrukt

Denne PR-en legger inn `titleFromQuestion?: boolean` på `Thread`, med en
begrunnelse som er helt riktig:

> The thread list needs SOMETHING to name the row … The conversation itself
> must not draw it … Measured by #3, 2026-09-15.

Samtidig avgjør `ChatView` (fra #23) det samme spørsmålet ved å sammenligne
strenger: `threadHeading()` lager en stand-in av **første setning, kappet på
80 tegn**, og skjuler hodet bare når tittelen sier akkurat det samme.

Tittelen denne PR-en lager er **hele spørsmålet**, urørt. De to er derfor
enige bare for korte spørsmål med én setning. Jeg prøvemerget #25 og #23 og
målte tre spørsmålsformer:

| Spørsmål                                          | Tittel (#25) | Stand-in (#23)      | Enige?  |
| ------------------------------------------------- | ------------ | ------------------- | ------- |
| «Hvordan jobber Nkom med måloppnåelse?» (37 tegn) | hele         | hele                | ja      |
| Kickstarteren fra forsida (110 tegn)              | hele         | kappet med « …»     | **nei** |
| «Hva sier årsrapporten …? Og hva endret seg …?»   | hele         | bare første setning | **nei** |

I dag er alle tre likevel skjult — men bare fordi funn 1 gjør at `ChatView`
aldri får tråden. **Den dagen kallet kommer på plass, blir hodet synlig for
de to siste**, og da står hele spørsmålet som en 36 px overskrift rett over
det samme spørsmålet. Det er brukerblikk-funn 5 tilbake, på en vei brukeren
når fra forsidas egne forslag.

Rettelsen er gratis og ligger allerede i denne PR-en: la `ChatView` lese
`thread.titleFromQuestion` i stedet for å utlede det på nytt.
`saysTheSame()` og stand-in-kappingen kan da fjernes helt.

## Kan

### 3. Cmd-klikk på en kildemarkør åpner ikke lenger ny fane

Kommentaren i `Markdown.tsx` sier at href-en blir stående for «open in new
tab … none of those go through this handler». Målt:

|               |                                                         |
| ------------- | ------------------------------------------------------- |
| vanlig klikk  | ingen navigering ✔ (det er det fiksen skal gjøre)       |
| **Cmd-klikk** | **ingen ny fane** — `preventDefault()` stopper også den |
| midtklikk     | ny fane åpnes (den går via `auxclick`, ikke `click`)    |

Så to av de tre veiene til «åpne i ny fane» oppfører seg ulikt, og
kommentaren lover den ene som ikke virker. Selve fiksen er riktig og viktig —
uten den blir markøren en ekte navigering så snart tråden har en adresse, og
chat-slotten remonteres midt i svaret. Det er bare setningen som er for vid.

## Det som er riktig, og hvor jeg sjekket det

- **`replaceState` og ikke `navigate()`** er riktig valg, og begrunnelsen i
  koden holder: routeren ville endret `useParams`, `ChatSlotView`-nøkkelen
  ville gått fra `new` til id-en, og komponenten ville remontert med svaret
  som strømmer i seg. Kostnaden — at routerens egen location blir stående på
  `/` — er skrevet ned, og alle lenker i appen er absolutte.
- **Ref og ikke state for «én gang»**: `startedRef` leses ikke fra en closure
  som er én render gammel, så spørsmål nummer to i samme samtale minter ikke
  en tråd til. Riktig, og begrunnet.
- **`key={threadId ?? 'new'}`** gjør at en rute med id aldri kan starte noe,
  som er det som lar `started` og `thread` være to separate tilstander uten
  at de kan kollidere.
- **`crypto.randomUUID` med fallback**, og fallbacken er begrunnet som «bare
  unik i denne fanen», ikke som sikkerhet.
- **`needs-clarification`** er lagt inn i `MessageStatus`, i `stream.ts` og i
  begge klientene med tester på begge. Ingen view tegner den ennå, som er
  riktig: det er rolle-3b og #3 sin del.
- **Markør-fiksen er målt riktig**: vanlig klikk navigerer ikke, og URL-en
  står stille.
- Ingen filer utenfor #5 sitt eierskap. `tests/` er urørt.

## Til dirigenten

1. **Ikke kryss av C16.** Den er fortsatt ❌ i frontenden til noen kaller
   `startThread`. PR-en leverer plumbingen, ikke oppførselen.
2. **Funn 2 er den som koster hvis den glemmes.** Når #3 kobler opp kallet,
   må `ChatView` samtidig bytte fra `threadHeading()`s strengsammenligning til
   `thread.titleFromQuestion`. Gjør de det i samme PR, er det gratis. Gjør de
   det ikke, kommer funn 5 tilbake for lange og flerdelte spørsmål, og det
   ser ut som en regresjon ingen har rørt.
3. E2E for C16 skriver jeg når det kallet er inne, som avtalt.
