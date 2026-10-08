# PR #117, grunnmur for filopplasting: kildene flyttet, markørene ble stående

Anmeldt 2026-09-21 av KA CC. To runder: `8328e62` og `0221a4d`, begge slått
sammen med `main` uten konflikt. Fire porter grønne i begge; 751 og 755
enhetstester, 145 e2e på 4173.

Ingen UI i PR-en, så alt her er målt mot klienten og storet slik appen bruker
dem — ikke gjennom skjermen.

## Runde 1: ett blokkerende funn

**Markørene i svaret fulgte ikke med da kildene ble omnummerert.**

`renumber()` flytter korpusets utdrag bakover når et eget dokument settes
først. Teksten i svaret er en fixture med faste `[1]`, `[2]`, …, og
`withOnlyCitations()` fjerner bare markører som ikke finnes — den flytter dem
ikke. Målt med ett vedlegg på «Hvordan jobber Nkom med måloppnåelse?»:

|                    |                                             |
| ------------------ | ------------------------------------------- |
| Markører i teksten | `[1] [2] [3] [4] [5]`                       |
| Kilde 1            | «Min egen rapport.pdf» (`origin: user`)     |
| Kilde 2–3          | Årsrapport Nkom 2025                        |
| Kilde 4–5          | Tildelingsbrev Nkom 2026                    |
| Kilde 6            | Instruks for økonomi- og virksomhetsstyring |

Setningen «resultater, tilsynsaktivitet og ressursbruk **[1]**» handler om
årsrapporten, men `[1]` pekte på leserens egen PDF. Hver påstand pekte ett
dokument for tidlig, og kilde 6 var foreldreløs.

Det er mocken hele teamet bygger og demonstrerer mot, og #4 skal tegne nettopp
denne koblingen — derfor blokkerende. Ingen test dekket det:
`MockChatClient.test.ts` var urørt, og `upload.test.ts` måler klienten, ikke
svaret.

### En måling som var min egen feil

Første gang målte jeg ved å kalle `MockUploadClient` direkte, og fikk ingen
vedlegg i det hele tatt — `attachedSources()` leser `userDocuments()`, storet,
ikke klienten. Det var probe-en som var gal, ikke koden. Tallene over er fra
andre forsøk, via `uploadUserDocument()` slik appen gjør det. Verdt å skrive
ned: i dette laget er storet inngangen, og en måling som går utenom det måler
noe annet enn produktet.

## Runde 2: løst, og verifisert

`shiftCitations(markdown, offset)` flytter hver `[n]` i én pass — ikke en
løkke av replaces, som ville flyttet samme markør to ganger. Og svaret får en
første setning som siterer vedlegget, slik at kilde 1 har noe som peker på
den.

| Nr  | Kilde                    | Markør                                                       |
| --- | ------------------------ | ------------------------------------------------------------ |
| 1   | Min egen rapport.pdf     | «Svaret er også bygget på dokumentet du la ved, «…».**[1]**» |
| 2–3 | Årsrapport Nkom 2025     | «resultater, tilsynsaktivitet og ressursbruk **[2]**»        |
| 4–5 | Tildelingsbrev Nkom 2026 |                                                              |
| 6   | Instruks                 |                                                              |

Markører 1–6, kilder 1–6, **ingen foreldreløse**. Uten vedlegg er svaret
uendret: markører 1–5, første linje er overskriften.

Førstesetningen er den riktige avgjørelsen, og grunnen står i koden: uten den
står kilde 1 igjen uten markør, som er samme uorden speilvendt.

## Målt, og riktig

- **Live-klienten kaller ingenting.** 0 kall med `fetch` stubbet, kode
  `unavailable`, status `failed`, tom `list()`. En `.png` får fortsatt
  `wrong-type` — den ærlige feilen, ikke den om manglende endepunkt.
- **Lageret har ingen filbytes.** Etter opplasting av en fil med kjent innhold
  er nøklene i `ka.documents.v1` bare `id, name, type, size, uploadedAt,
status, progress`, og innholdsstrengen finnes ikke i lageret.
- **Framdrift:** 15 steg, 7 → 100.
- **`origin: 'user'` ligger på modellen**, ikke utledet av tittelen, slik #4 ba
  om — målt i kildehendelsen.

## De tre mindre funnene, og hva som ble av dem

1. **To feilstier lagret ulikt** (bør). En avvist fil havnet ikke i lageret, men
   en som feilet sent ble skrevet med `progress: 100` og overlevde en
   omlasting som en død rad uten retry. Rettet: én regel for begge — en feilet
   opplasting lever i økta, aldri i lageret.
2. **Cache-begrunnelsen i `uploadFactory.ts` stemte ikke** (kan). To instanser
   ville ikke blitt «to lister av én sannhet»: klienten holder ingen tilstand
   og leser `localStorage` hver gang. Rettet, og den nye teksten sier mindre
   enn den gamle med vilje. Det er måten å rette en begrunnelse på.
3. **Brief-ens `UPLOAD_UNAVAILABLE` heter `unavailable` i koden** (kan). Ett
   vokabular med `ChatErrorCode` slår to, men #2, #3 og #4 leser kontrakten fra
   brief-en. Notert i PR-beskrivelsen.
