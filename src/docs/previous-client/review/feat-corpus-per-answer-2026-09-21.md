# PR #135, korpus per svar: verdien finnes nå, og én sti viser den fortsatt ikke

Anmeldt 2026-09-21 av KA CC. `9422274` slått sammen med `main 662db30`, ingen
konflikt. Fem porter med exit-kode lest, alle 0; 853 enhetstester, 149 e2e.
**0 funn.** To live-spørsmål brukt.

## Målt

**Mocken rapporterer korpuset på den avsluttende ramma.** Probe mot klienten,
ett kall per korpus: `done.corpusKey` er `mock` og `norquad-mock`.
`sources`-ramma bærer det ikke, og det stemmer med designet — den er ikke en
avsluttende ramme.

**Live tagger og leser tilbake.** Spørsmål på Kudos-pilot, full omlasting, og
trådraden sier «Kudos-pilot» — lest fra `corpus:`-taggen på samtalen, ikke fra
det som står valgt.

**Trådlista er konsekvent i mock:** Wikipedia-tråden «Wikipedia (mock)»,
Nkom-tråden «Kudos, 938 dokumenter (mock)», og fixturtråden «NKOM
måloppnåelse» bærer nå også korpuset sitt. Kan 2 fra #133 er lukket.

## Tre ting det er verdt å vite, ingen av dem funn

**1. Ingen `Message` eller `AnswerSources` bærer `corpusKey` ennå.** Feltene
finnes i modellen og verdien går over wire og på tråden, men `grep` etter
`corpusKey:` finner bare `ChatSlotView`, fixturene og live-klienten. Inntil
#3 skriver den på svaret er typene et løfte på papir.

**2. Fraskrivelsen navngir fortsatt det valgte korpuset, og stien dit er blitt
smalere.** Målt: åpne Kudos-tråden mens «Wikipedia (mock)» står valgt, og
panelet sier «All tekst er sitater fra dokumentene fra Wikipedia (mock)» over
kildekortet «Årsrapport Nasjonal kommunikasjonsmyndighet 2025».

#133 fjernet den andre stien — et bytte tømmer skjermen, så et svar og et valg
kan ikke sprike der. Det som står igjen er å åpne en eldre tråd, og det er en
helt vanlig ting å gjøre. Vakta for det ligger i #137, som `test.fixme` med
én linje å bytte.

**3. Korpuset kommer på `done`.** En konsument må tåle `undefined` mens svaret
strømmer, siden kildene kommer før den avsluttende ramma.

## Om min egen live-måling

Første forsøk viste **ingen** korpusetikett på trådraden i live, verken før
eller etter omlasting — og det så ut som et funn. Det var oppsettet mitt:
dev-serveren hadde ingen `VITE_KA_TENANT`, og uten tenant sendes ingen
dataset-nøkkel og dermed ingen tagg. Det står i `stream.ts`: «live without a
tenant leaves the key out of the call». Med `VITE_KA_TENANT=demo` leses den
tilbake.

Verdt å skrive ned for neste anmeldelse: **uten tenant er korpuset ukjent i
live, og det er riktig oppførsel.** Målinger av korpus i live krever at både
`VITE_KA_TENANT` og `VITE_KA_DATASETS` er satt på dev-serveren.
