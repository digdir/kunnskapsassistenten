# PR #114, korpuslinja på én linje: N2 tatt ut i sin helhet, og en funksjon som ikke lenger kalles

Anmeldt 2026-09-21 av KA CC. Sammenslåingen av `a5ed4ea` og `origin/main`
(`9b70ccc`) — `git merge-tree` melder ingen konflikt, og branchen inneholder
allerede main, så det målte er det som merges.

Alle fire portene grønne: `npm run build`, `npm run lint`,
`npm run format:check`, `npm run tokens:verify`. 697 enhetstester og 145 e2e
grønne (4173).

## Gevinsten, målt mot grunnlinja

Grunnlinja er målt på `main 0855670` med definisjonen Lars valgte 21.09
(leservindu = alt mellom hodet og skrivefeltet). Tallene her er målt på
sammenslåingen, i mock, på tre bredder.

| Del                             | Grunnlinje      | Nå (lukket) | Nå (åpen) |
| ------------------------------- | --------------- | ----------- | --------- |
| Filterhodet, 1280 / 1440 / 1920 | 179             | **137**     | 200       |
| Korpuslinja                     | 63              | **21**      | 84        |
| «Vis mer»-kontrollen            | —               | **21**      | 21        |
| Rullevinduet i panelet          | 598 / 778 / 958 | uendret     | uendret   |

**−42 px, ikke −32.** Forslaget regnet 63 → 31 og hodet 179 → 147; målt blir
linja 21 og hodet 137. De 10 ekstra kommer av at kontrollen ligger på tekstens
egen linje i stedet for å legge til en: `Link asChild` rundt en `button` er
21 px høy, mot 42 for en `Button data-size="sm"`. Avgjørelsen står begrunnet i
`CorpusLine.tsx`, med begge tallene.

Tre bredder gir samme tall, som ventet: hodet er tekst og knapper, ikke noe
som skalerer med vinduet.

**Åpen er hodet 200 px**, altså 21 px høyere enn de 179 det erstattet. Det er
ikke et funn — leseren har bedt om det selv, og tilstanden huskes ikke, så
panelet åpnes kort igjen — men det er verdt å vite at «Vis mer» koster mer
leservindu enn den korte linja sparer, så lenge den står åpen.

## WCAG AA

Målt med `docs/review/tools/a11y.sh feat-corpus-line-one-line /` og med en
egen axe-kjøring på den nye tilstanden.

- **0 brudd i lys og mørk**, både med detaljen lukket og åpen.
- De uavklarte er de samme tre + tre som står på `main` fra før
  (`aria-required-children` i Suggestions skyggemarkup,
  `color-contrast` på skrivefeltet, bunnteksten og hurtigtasthintet). Ingen av
  dem er i korpuslinja.
- **Fokusringen på «Vis mer» er ekte målt med Tab**, ikke med `focus()`:
  `:focus-visible` er på, `outline: solid 3px` pluss 3 px forskyvning, i begge
  moduser. Steg 7 i tabbvandringen, etter «Tråder» og før «Velg alle
  dokumenttyper» — den visuelle rekkefølgen.
- Kontrast målt mot panelflata: kontrollen 14,11:1 i lys og 12,6:1 i mørk,
  kildeteksten 6,58:1 og 6,21:1. AA krever 4,5:1.
- `aria-expanded` veksler false → true, og `aria-controls` peker på et element
  som finnes i dokumentet i begge tilstander. Detaljen skjules med `hidden`,
  ikke med `display: none` — det er regelen fra `funn-tverrgaaende.md`, og den
  er fulgt.
- «Første overskrift i DOM er h2, ikke h1» står i verktøyets rapport. Den er
  uendret fra `main` og fra tidligere kjøringer (`pr62-merge`, `blikk3`,
  `feat-filter-chips` har samme rekkefølge), altså ikke noe denne PR-en gjør.

## Designsystemet

- `Link asChild` rundt en `<button type="button">` er riktig vei rundt
  høydeproblemet: semantikken (knapp, `aria-expanded`) og størrelsen (tekst,
  ikke knappeflate) kommer hver fra sin komponent, og ingenting av
  Designsystemets stil er overstyrt for å få det til. Fokusringen arves, den
  tegnes ikke selv.
- `Field.Description` rendrer en `<div>` i 1.21.0 (slått opp i
  `field-description.js`), så `Paragraph asChild` → `<div>` inni den er
  gyldig nesting. Sjekket fordi et `<p>` rundt en `<div>` ville vært ugyldig.
- Ingen heksfarger, ingen tallverdier med `px`/`rem` i de nye reglene.
  `.filters-view__corpus[hidden]` er parret med `display` slik CONTRIBUTING
  krever.

## Funn

### Bør

**1. `corpusSummary()` har ingen kaller igjen, men 22 påstander som sier hva
panelet viser.** `src/views/filters/corpusSummary.ts:200`. Funksjonen er nå en
tynn innpakning rundt `corpusLine()`, og eneste bruk i repoet er
`corpusSummary.test.ts`. Testfila påstår fortsatt hele setningen på én linje —
«Dokumenter fra Kudos: 938 dokumenter, …» — som er nøyaktig det panelet sluttet
å tegne i denne PR-en. En leser av testfila får vite feil om produktet, og
dekningen er falsk: ingen av de linjene beskytter noe som kjøres. Enten slett
innpakningen og pek testene på `corpusLine()`, eller la den stå og si i
testfila at den ikke er det panelet viser.

### Kan

**2. «Vis mer» sier ikke mer om hva.** `CorpusLine.tsx:60`. En skjermleserbruker
som lister knappene på sida hører «Vis mer» uten konteksten som står ved siden
av på skjermen. `aria-label="Vis mer om korpuset"` (og «Vis mindre om
korpuset») ville navngitt hva den åpner uten å endre det synlige. Ikke et
AA-brudd — 2.4.6 er AA for overskrifter og etiketter, og kontrollen har en
etikett — men det er billig.

**3. Detaljen kunne vært lukket når korpuset byttes.** Tilstanden lever i
`CorpusLine` og overlever et korpusbytte, så en åpen detalj bytter innhold
under leseren. Det er forsvarlig — det er samme kontroll og samme rolle — men
det er et valg som ikke står skrevet noe sted.

## Det som er riktig

- Navnet er halvdelen som blir stående, og begrunnelsen står i koden: det er
  den som endrer seg ved korpusbytte (#103, #106). Målt i live tidligere at
  det er nettopp navnet som skiller korpusene.
- Tilstanden huskes ikke, slik brief-en ba om, og det er sagt i koden hvorfor:
  høydebudsjettet forutsetter den korte linja ved neste åpning.
- E2E-testen er flyttet fra «linja inneholder tallene» til «navnet står, tallene
  ligger bak knappen, og knappen åpner dem» — påstanden følger oppførselen og
  ikke markupen.
- Fallbacken for live (ingen fasetter, A2) er beholdt med «Dokumenter fra X»
  som fast åpning, som er det linja fantes for (brukerreiser punkt 11).

## Til dirigenten

- `tests/e2e/primary-sidebar.spec.ts` er endret uten at unntaket ble bedt om i
  én linje. Endringen er nødvendig og riktig — DOM-en den leste finnes ikke
  lenger — så jeg ber ikke om at den rulles tilbake, men rutinen er verdt å
  minne om.
- Gevinsten er 42 px og ikke 32, så budsjettet etter N1 (48 px til) blir
  filterhodet **89 px**, ikke 99.

## Runde 2, `e15550e`

Alle tre tatt. `corpusSummary()` er slettet og `corpusSummary.test.ts` peker på
`corpusLine()`, så de 22 påstandene beskriver nå det panelet faktisk tegner.
Knappen har fått `aria-label` «Vis mer om korpuset» / «Vis mindre om korpuset»,
og valget om at en åpen detalj overlever et korpusbytte står skrevet i
`CorpusLine.tsx`.

To ting jeg sjekket fordi de kunne blitt ødelagt av rettelsen:

- **WCAG 2.5.3 Label in Name** krever at det tilgjengelige navnet inneholder den
  synlige teksten. «Vis mer om korpuset» inneholder «Vis mer», og «Vis mindre om
  korpuset» inneholder «Vis mindre». Begge veier holder.
- **E2E-oppslaget** `getByRole('button', { name: 'Vis mer' })` treffer fortsatt,
  fordi Playwright matcher delstreng på tilgjengelig navn. Et
  testing-library-oppslag ville brutt, og det er nettopp det `CorpusLine.test.tsx`
  måtte endres for.

Fire porter grønne, 698 enhetstester grønne. Ingen ny e2e-kjøring: rettelsen
rører ikke DOM-en suiten leser, utover navnet som er dekket over.
