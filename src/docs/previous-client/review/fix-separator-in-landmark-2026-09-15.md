# PR #62, drahåndtaket inn i landemerket: første helt rene axe-kjøring

2026-09-15, anmelderen (KA CC). Gren `86e184a` slått sammen med `main`
`595568e` til `55703b8`; ingen konflikt. Målt på sammenslåingen, 1440 × 900.

**Ingen blokkerende, ingen «bør», ingen «kan».** Den retter funnet jeg meldte
tre ganger, og lukker veien det kom inn.

## Portene

| Port               | Resultat                                       |
| ------------------ | ---------------------------------------------- |
| `build`            | grønn                                          |
| `lint`             | grønn                                          |
| `format:check`     | grønn                                          |
| `tokens:verify`    | grønn                                          |
| `npm test`         | grønn, **441 i 42 filer**                      |
| `npm run test:e2e` | grønn, **118 på 50,8 s**, 8 workers, port 4173 |

## Det den retter

| Rute, lys og mørk              | `main` `595568e`  | sammenslåingen |
| ------------------------------ | ----------------- | -------------- |
| `/`                            | 1 brudd, `region` | **0**          |
| `/threads/nkom-maaloppnaaelse` | 1 brudd, `region` | **0**          |

Fire ruter, null brudd. Det er første gang i denne bølgen.

Og håndtaket er fortsatt et fullverdig tabbstopp etter flyttingen: `div[separator]`
«Endre bredde på tråder og filter», med synlig fokusring i begge moduser
(`outline solid 3px` pluss innerskygge), som steg 13 på forsida og 15 i en tråd.

## Testendringene i `tests/`, som er mine

**`layout.spec.ts` er ekte fikstur-følging.** DOM-en er delt i to: plassen
(`.primary-sidebar`) er landemerket og bærer bredden og håndtaket, og boksen
inni (`.panel`) tegner flaten, kanten og luften. Testen leser nå bredden fra
plassen og flaten og kanten fra panelet. Påstandene er de samme — samme flate,
samme kant, samme 67 px — bare lest fra riktig boks. Ingenting er gjort
løsere.

**`a11y.ts` fikk `expectAllContentInLandmarks`, og den hører hjemme.**
Begrunnelsen i koden er riktig og verdt å gjenta: `region` er en
**best-practice**-regel, ikke `wcag2a`/`wcag2aa`, så hver eneste eksisterende
`expectNoAxeViolations` er blind for den. Det var nøyaktig hullet #50 gikk
gjennom. Den nye hjelperen kjører den ene regelen på tre ruter pluss
tilstanden der begge skillene finnes samtidig, uten å endre hva resten av
suiten påstår. Det er den smale løsningen, ikke den brede.

## Til dirigenten

Ikke noe å rette i denne PR-en. Men verktøyet mitt sier fortsatt «FØRSTE
OVERSKRIFT ER h2, ikke h1» på alle fire ruter, og nå som axe er på null er det
det eneste strukturelle som står igjen. Målt rekkefølge i en tråd:

```
h2  Filtrering          ← navigasjonspanelet kommer først i DOM
h3  Dokumenter
h4  Fra Kudos
h4  Dine dokumenter
h1  Kunnskapsassistenten ← sidas egen overskrift, som nummer fem
h2  NKOM måloppnåelse
```

`h1`-en **finnes** og er riktig; den kommer bare etter fire overskrifter i et
sidepanel. axe melder ingenting (`heading-order` og `page-has-heading-one` er
best-practice), og landemerkene gjør at en skjermleser kan hoppe rett til
`main`. Så dette er en beslutning, ikke en feil: enten flytter vi
`h1`-en først i DOM, eller så stryker vi linja «første overskrift i DOM er en
`h1`» fra sjekklista mi, fordi landemerker er det som faktisk bærer
strukturen. Jeg har notert den tre ganger uten å melde den; nå er den den
siste som står.
