# PR #130, egen fil ett sted: to lister som svarer på hvert sitt spørsmål

Anmeldt 2026-09-21 av KA CC. `06527a5` slått sammen med `main bd14439`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 811 enhetstester, 149 e2e.
**0 funn.**

## Målt i mock, med et vedlegg på spørsmålet

|                            |                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| «Dokumenter» → «Fra Kudos» | Årsrapport Nasjonal kommunikasjonsmyndighet 2025, Tildelingsbrev Nkom 2026 (DFD), Instruks for økonomi- og virksomhetsstyring i Nkom |
| «Dine dokumenter»          | Årsrapport 2025.pdf · PDF · 2 kB                                                                                                     |

Den egne fila står ett sted, og det er det stedet overskriften er sann. Funn 1
fra brukerblikk 6 er lukket.

**Kildepanelet er urørt:** fire kort med «Årsrapport 2025.pdf» først og «Ditt
dokument» under tittelen, fraskrivelsen med begge halvdelene, og fire unike
snarveinavn. At filterpanelet og kildepanelet nå sier forskjellige ting om den
samme fila er riktig — panelet viser hva svaret bygger på, lista viser hva
korpuset ga.

## Tellinga, og hvor den kunne måles

«Viser … av … dokumenter» tegnes aldri i mock: `initiallyVisible` er 5, og
mock-svaret har tre korpusdokumenter. Påstanden er dekket der den er målbar —
`DocumentsList.test.tsx` med «Viser 5 av 7 dokumenter.» og et eget dokument i
arrayet, altså åtte inn og sju talt.

Verdt å skrive ned for neste anmeldelse: en browsermåling som ikke kan nå
tilstanden er ikke en måling, og da er enhetstesten ikke et dårligere nivå —
den er det eneste nivået.

## Det som er verdt å si

Filteret leser `origin` fra modellen, ikke `isOwnDocument` fra kildepanelets
mappe. Samme svar på samme spørsmål, men uten å binde to views til hverandre —
og dermed motsatt vei av «kan»-funnet i #129, der `corpusDisplayName` gikk den
andre veien.
