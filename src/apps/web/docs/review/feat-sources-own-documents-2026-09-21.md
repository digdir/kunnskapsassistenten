# PR #123, eget dokument som kilde: to setninger som må si forskjellige ting

Anmeldt 2026-09-21 av KA CC. `d7efda8` slått sammen med `main 4b1d5f2`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 772 enhetstester, 145 e2e.

Ingen UI-vei inn i tilstanden før #125, så alt er målt i preview-inngangen
(`src/views/sources/preview/index.html`), som er dev-only.

## Målt i «Eget dokument»

|                                 |                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Kortets tittel                  | «Notat om måloppnåelse 2026.pdf»                                                                               |
| Undertittel                     | «Ditt dokument»                                                                                                |
| Lenke i kortet                  | ingen                                                                                                          |
| Foten                           | «Bare du har dette dokumentet, så det finnes ingen lenke til det.»                                             |
| Mappekorpus-kortet ved siden av | «Dokumentet har ingen offentlig lenke.»                                                                        |
| Fraskrivelsen                   | «All tekst er sitater fra dokumentene, både fra Kudos og fra dine egne. Ikke generert av kunstig intelligens.» |

De to setningene i foten står i samme panel og sier forskjellige ting, og det
er poenget: den ene er et korpus uten offentlige adresser, den andre er en fil
bare leseren har. Forskjellen er ikke synlig i koden hver for seg — den måtte
måles i samme tilstand.

**Snarveislista skiller radene:** «Notat om måloppnåelse 2026.pdf, ditt
dokument» mot de tre korpustitlene, fire unike navn. Det er kravet fra #92, og
det holder også når et filnavn ligner en korpustittel — som er hele grunnen
til at `origin` og ikke tittelen er det som skiller.

**WCAG:** 0 axe-brudd **og 0 uavklarte** i lys og mørk. Tabbvandringen gir 13
stopp, alle med navn og synlig ring.

## Funn

Ett «kan»: `OWN_DOCUMENT_LABEL.toLowerCase()` i `SourcesOverview.tsx:82` bruker
ikke `toLocaleLowerCase('nb-NO')`, som er formen resten av koden bruker. Samme
streng i dag, men det er den typen som blir en feil den dagen etiketten
inneholder en tyrkisk i.

## Det som er verdt å si

Skillet leses av `origin` og aldri av tittelen, gjort helt ut: `isOwnDocument`
er ett sted, og kortet, snarveislista, fraskrivelsen og foten spør alle den.

Begrunnelsen for at fraskrivelsen måtte utvides er den sterkeste i PR-en.
Setningen er en påstand om hvor hvert ord i panelet kommer fra, og med et
opplastet dokument i lista var den usann. Et panel som finnes for å kunne
etterprøves, kan ikke si noe leseren kan se er galt.
