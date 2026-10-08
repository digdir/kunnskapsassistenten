# PR #134, fasettene følger korpuset: og en setning som bare sier det som skjedde

Anmeldt 2026-09-21 av KA CC. `0d27009` slått sammen med `main`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 821 enhetstester, 149 e2e.
**0 funn.**

## Målt i mock, med et valg tatt før byttet

|                     | Kudos-mock, «Statens vegvesen» valgt | Etter bytte, uten omlasting                                                  |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| «Vis mer»           | «938 dokumenter, årsrapporter …»     | «8 dokumenter, artikkel, 1707–2010»                                          |
| Virksomheter tilbyr | 259 verdier                          | **1**: «Wikipedia (8)»                                                       |
| Chips               | «Statens vegvesen»                   | ingen                                                                        |
| Tilstandslinjene    | «1 av 259 valgt»                     | tre × «Ingen avgrensning»                                                    |
| Live-området        | tomt                                 | «Korpus: Wikipedia (mock). Filteret er nullstilt fordi korpuset ble byttet.» |

## Den detaljen som er lett å få galt

Byttet jeg **tilbake uten å ha valgt noe**, sto det bare «Korpus: Kudos, 938
dokumenter (mock)» — uten påstanden om at filteret ble nullstilt. Et
live-område som melder en hendelse som ikke fant sted, lærer leseren å overse
det, og her sier setningen bare det som skjedde.

`output.ds-sr-only` er montert tomt før byttet, ikke sammen med meldinga —
samme form som #124.

## «Én gang, med tomt utvalg»

Ikke observerbar i nettleseren: mocken går ikke over nett, så det finnes ingen
kall å telle. Dekket der den er målbar — `FiltersView.corpus.test.tsx` holder
`corpus.asked` og påstår både rekkefølgen `['norquad-docs', 'kudos-pilot']`
(én spørring per korpus, ikke to) og at den siste gikk med
`emptyFilterSelection`.

Andre gang på to dager at en påstand måtte måles i enhetstesten fordi
nettleseren ikke kan nå tilstanden (jf. tellinga i #130). Det er ikke et
dårligere nivå — det er det eneste.

## Verdt å si

Testen for at en dimensjon det nye korpuset **ikke** har forsvinner —
«Virksomheter» borte, ikke stående med verdier fra forrige korpus — er den som
fanger den virkelige regresjonsfaren. Det var nettopp en dimensjon med
fremmede verdier som var funnet i #131.
