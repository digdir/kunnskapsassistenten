# PR #129, fraskrivelsen i korpusets navn: sann om valget, ikke om det den står over

Anmeldt 2026-09-21 av KA CC. `5af5275` slått sammen med `main 9a016af`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 809 enhetstester, 149 e2e på 4173. To live-spørsmål brukt, ett per korpus, som er taket.

## Funnet fra brukerblikk 6 er lukket

| Hvor              | Korpus              | Fraskrivelsen                                                                           |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------- |
| Live              | Wikipedia (NorQuAD) | «… sitater fra dokumentene **fra Wikipedia (NorQuAD)**…», over kortet «Oldtidens egypt» |
| Live              | Kudos-pilot         | «… **fra Kudos-pilot**…»                                                                |
| Mock              | Kudos               | «… **fra Kudos**…», og korpuslinja i filterpanelet sier det samme                       |
| Mock, med vedlegg | Kudos               | «… både fra **Kudos** og fra **dine egne dokumenter**…»                                 |

Setningen er bygget av samme oppslag som korpuslinja (`corpusDisplayName`,
#110), så de to kan ikke gli fra hverandre. #123-halvdelen står.

**Korpusbytte finnes ikke i mock.** `corpus.ts:162` leser `VITE_KA_DATASETS`
bare når `VITE_API_MODE` er `live`; ellers er det ett fast mock-korpus. Derfor
måtte begge korpusnavnene måles live, og derfor gikk hele live-budsjettet med.

## Funn

### Bør

**Fraskrivelsen beskriver korpuset som er valgt nå, ikke korpuset utdragene
kom fra.** Målt i live: med et ferdig Wikipedia-svar på skjermen byttet jeg
korpus til Kudos-pilot **uten å spørre om noe nytt**, og setningen sto
umiddelbart som

> All tekst er sitater fra dokumentene fra Kudos-pilot. Ikke generert av
> kunstig intelligens.

rett over kildekortet «Oldtidens egypt», en Wikipedia-artikkel.

For et ferskt svar er de to alltid like, så dette er ikke en regresjon — det
er den samme feilen ett hakk dypere: en setning som navngir en kilde den ikke
beskriver. Korpuset hører til svaret på samme måte som `appliedFilters` gjør i
`useChat`. Det gjelder også svarbytteren: et eldre svar i tråden kan være
hentet fra et annet korpus enn det som står valgt.

Dirigenten har gjort dette til en egen runde (#5 → #3 → #4).

### Kan

**`corpusDisplayName` krysser nå en eiergrense.** `SourcesView.tsx` henter den
fra `../filters/corpusText`: #4 leser fra #2. Å importere slår å kopiere, og
kommentaren sier hvorfor — men funksjonen har to brukere nå, og reglene setter
delte ting i en delt mappe. Til #5 sin neste skallrunde, ikke en endring her.

## Det som er riktig

`useSyncExternalStore` framfor `useCorpus` er kallet jeg ville gjort, og
begrunnelsen er den beste i PR-en: `useCorpus` bærer setteren og dermed
`useNavigate`, og en lesning som drar inn en Router gjør viewet umonterbart
utenfor en — også i `preview/`, som er nettopp der «Eget dokument»-tilstanden
måtte måles i #123.
