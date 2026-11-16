# PR #131, to korpus i mocken: og to ting det andre korpuset gjorde synlige

Anmeldt 2026-09-21 av KA CC. `97758f2` slått sammen med `main 2b27f97`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 818 enhetstester, 149 e2e.

## Det som virker, målt over et bytte uten omlasting

|             | Kudos-mock                                        | Wikipedia (mock)                             |
| ----------- | ------------------------------------------------- | -------------------------------------------- |
| Velgeren    | to valg, uten env-variabel                        | bytter begge veier                           |
| Korpuslinja | «Dokumenter fra Kudos»                            | «Dokumenter fra Wikipedia (mock)»            |
| Forslagene  | de tre Kudos-spørsmålene                          | de tre generelle                             |
| Svaret      | «Måloppnåelse i Nasjonal kommunikasjonsmyndighet» | «Artikler i dette korpuset …»                |
| Kildene     | Årsrapport, Tildelingsbrev, Instruks              | Vinter-OL 2010, Skottlands historie, Nordlys |

Svaret og kildene følger byttet med én gang. Det er dette PR-en finnes for.

## Funn: to ting som alltid har vært slik, og som ingen kunne se før nå

**1. Fasettene fulgte sidelastingen, ikke byttet.** Målt begge veier:

| Etter bytte til  | Korpuslinja      | «Vis mer»                           | Virksomheter tilbød           |
| ---------------- | ---------------- | ----------------------------------- | ----------------------------- |
| Wikipedia (mock) | Wikipedia (mock) | «938 dokumenter …»                  | Kudos' 259                    |
| Kudos-mock       | Kudos            | «8 dokumenter, artikkel, 1707–2010» | **én** verdi: «Wikipedia (8)» |

Etter omlasting stemte begge. En leser som byttet til Kudos kunne altså bare
filtrere på «Wikipedia», og valget gikk med spørringen mot et korpus uten den
verdien. Rettet i #134.

**2. Et bytte startet ikke en ny samtale når leseren sto på `/`.** Målt: spurte
på Kudos, byttet uten omlasting, spurte igjen — begge svarene havnet i samme
lagrede tråd, og de lå der fortsatt etter omlasting. `ThreadCorpus.test.tsx`
sier regelen i klartekst: en tråd er bundet til korpuset den ble startet i.
Rettet i #133.

Det viktige for runden som fulgte: **korpuset må henge på svaret og ikke på
tråden**, for en tråd kunne allerede holde begge.

## Modulnivå-funnet, og resten av sjekken

#5 fant selv at `import.meta.env` lest på modulnivå drepte hele e2e-kjøreren i
Node før første test, fordi en spec importerer `src/api/mock`. Jeg sjekket
resten av repoet: `src/api/index.ts` og `uploadFactory.ts` leser env **inne i
funksjoner** og er trygge, og `main.tsx` er nettleserinngangen ingen spec
importerer. `corpus.ts` var det eneste modulnivået.

`?.` med `{}`-fallback er riktig svar: «ingen miljø» er mock, som er det samme
svaret appen gir en utvikler som ikke har satt noe.
