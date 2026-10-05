# 0005 — Teksten i utdragene, og kildene etter ny innlasting, i live

**Status:** valgt · **Dato:** 2026-09-30 · **Endret:** 2026-10-05, stegene (Simens issue 88), tallene fra KA CC på #227, hva lageret inneholder (KA CC på #233) og at det tømmes ved Logg ut

## Kontekst

To av Simens punkter i runde 3 gjelder dataene bak kildepanelet i live-modus.
Det er modusen testmiljøet i Azure kjører.

- **86d:** et åpent utdrag viser overskriftsstien og lenka til Kudos, men ikke
  teksten fra dokumentet.
- **Ekstra 2:** laster man siden på nytt, også etter en utrulling, forsvinner
  alle kildene.

Dette ble målt mot den lokale stakken på :8080 (tenant `kudos`, datasett
`kudos-full`) 30.09, med tre spørsmål gjennom `/api/mcp` slik
`LiveChatClient` sender dem:

- `structuredContent.chunks` har feltene `chunk_id`, `doc_num`,
  `chunk_index`, `title` og `metadata`, men ikke teksten. Svarene hadde 6, 15
  og 3 biter. I koden velger headless-rag feltene med `select-keys` uten
  `content_markdown`, og den tar bare de 20 første bitene
  (`mcp/tools.clj:731-740`, lest, ikke målt).
- En samtale som leses tilbake med `GET /api/conversations/:id`, har
  `chunks: []` på alle meldinger. Det er headless-rag #21:
  `transact-used-data` (`data/db.cljc:1297`) blir aldri kalt.
- Den lagrede teksten i svaret er tegn for tegn lik teksten i `tools/call`,
  målt i ett svar på 621 tegn. Meldingen får en egen id i backenden, mens
  klienten gir svaret id-en `msg-<tid>` i `done`. Id-en fra strømmen kan
  altså ikke brukes til å kjenne igjen svaret etter innlasting, men samtalens
  id og teksten i svaret kan.
- Referansene til bitene i ett svar med 3 biter var 1041 tegn i JSON, med
  overskriftene. Det blir om lag 350 tegn per bit.

headless-rag har ingen rute der en klient med `X-API-Key` får teksten til
biter ut fra id-ene. Det er lest i koden, ikke målt. Utdraget ligger i
Typesense, i bitsamlingen til datasettet, i feltet `content_markdown`, og
`chunk_id` er også Typesense-id-en (`docs/loader.clj:521`). Nikolais BFF
henter teksten derfra, med id-ene fra svaret (`apps/server/src/excerpts.ts` i
poden). Tynnserveren vår spør allerede Typesense om fasettene (0001).

## Beslutning

**1. Teksten.** Tynnserveren får `GET /api/excerpts?dataset=<nøkkel>&ids=<id>,…`.
Den slår opp id-ene i bitsamlingen til datasettet og svarer
`{ "excerpts": { "<chunk_id>": "<content_markdown>" } }`. En id som ikke
finnes, er ikke med. Ruta bruker samme `TYPESENSE_URL` og `TYPESENSE_API_KEY`
som fasettene, og en ny `KA_CHUNK_COLLECTIONS` (`datasett=samling;…`), med
samme grammatikk som `KA_FACET_COLLECTIONS`. `LiveChatClient` spør ruta når
svaret er ferdig og før kildene sendes videre. Teksten havner i
`Excerpt.text`, i samme form som BFF-en gir i bff-modus. Mislykkes oppslaget,
eller mangler en id, blir `textUnavailable` satt, og panelet sier det med
ord, slik det gjør i bff-modus.

**2. Kildene etter innlasting.** Klienten lagrer referansene til bitene for
hvert svar i `localStorage`. Nøkkelen er samtalens id og et fingeravtrykk av
teksten i svaret. Når en tråd åpnes og backenden ikke har bitene, finner
klienten referansene igjen, bygger kildene på samme måte som i strømmen og
henter teksten fra ruta i punkt 1. Det lagres bare det strømmen ga, altså
id-er, dokumentnummer, tittel, adresse og overskrifter. Ingen tekst fra
dokumentene lagres i nettleseren.

**3. Stegene etter innlasting** (endret 2026-10-05). Fremgangsmåte-boksen
forsvant av samme grunn (Simens issue 88). Det samme lageret tar derfor også
vare på det strømmen sa om stegene, ved siden av bitene: stegene slik de kom
(`thinkingSteps`), treffene, dokumentene og søkeordene (`retrieval`) og hvor
lenge agenten tenkte (`thoughtMs`). Det er agentens egne ord om hva den
gjorde, og søkestrengene den brukte, ikke tekst fra dokumentene. De kommer av
spørsmålet leseren stilte; se «Hva som ligger i lageret» under. Tenketiden
måles i klienten på samme hendelser og i samme rekkefølge som chatten måler
den, så tallet etter innlasting er det som sto på skjermen. Svaret skrives
ned før teksten slås opp, slik at en ny innlasting midt i oppslaget ikke
mister noe.

Grunnen til punkt 2 er at det er den eneste veien som virker nå uten en
endring i headless-rag. Oppslaget på id-ene er det samme i begge situasjonene,
så et nytt svar og et svar som leses tilbake, kan ikke vise ulik tekst for
samme bit.

## Alternativer som ble vurdert

- **Lagre kildene med teksten i `localStorage`.** Da trengs ikke noe oppslag
  ved innlasting. Men teksten fra dokumentene blir liggende i nettleseren, og
  den tar mer plass. Hvor mye er ikke målt, fordi teksten ikke finnes i
  live. Det er det bff-modus kunne gjort, fordi BFF-en
  gir teksten, men BFF-en har ingen rute for oppslag på id-er.
- **`POST /api/skills/enrichment-fetch-chunk-context/execute` i
  headless-rag.** Den tar én bit per kall, og ifølge sin egen dokumentasjon er
  den verktøy for arbeid utenfor kjøringen, ikke en del av søket. Den er ikke
  målt. Den ville gitt 3 til 20 kall per svar gjennom en flate som ikke er
  laget for oss.
- **`/v1/chat/completions`.** Den gir teksten for de bitene svaret siterer,
  men bare ved å kjøre en ny tur med agenten.
- **`sessionStorage`.** Den overlever at siden lastes på nytt, men ikke at
  fanen lukkes. Simen vil ha kildene tilbake også dagen etter.
- **Vente på headless-rag #21.** Det er den riktige rettelsen, men den er
  ikke på plass.

## Konsekvenser

- **Testmiljøet trenger en nøkkel som kan søke i bitsamlingen.** Søkenøkkelen
  frontenden har der i dag (id 2), har bare `documents:search` på
  `KUDOS_preprod_v4_documents_.*`. Da svarer oppslaget med feil, og alle
  utdragene får `textUnavailable`. En ny nøkkel er en skriving mot Typesense,
  og den må Lars eller Benjamin lage. Navnet på bitsamlingen må også inn i
  `KA_CHUNK_COLLECTIONS`. Uten disse to fungerer punkt 2 fortsatt, men uten
  tekst.
- **Id-ene fra nettleseren går inn i et filter i Typesense.** Ruta tar bare id-er
  som består av `A–Z`, `a–z`, `0–9`, `.`, `_`, `:` og `-`, og høyst 20 om
  gangen, det samme som headless-rag gir per svar (`shared/excerpts.ts`).
  Klienten deler en lengre liste i forespørsler på 20, så et svar med flere
  biter får teksten sin den dagen headless-rag gir flere. Hver id settes i
  backticks i `filter_by`. Nøkkelen forlater aldri serveren. Datasettet må
  være et av dem som er satt opp.
- **Kildene kommer litt senere enn svaret,** med den tiden oppslaget tar.
  KA CC målte på #227: 150–155 ms mens svaret kom, og 45–155 ms etter ny
  innlasting. En tråd som lastes på nytt, tegnes når alle oppslagene er
  ferdige, og den sto 237 ms etter innlastingen. Henger Typesense, svarer
  ruta 502 etter 5 sekunder (målt: 5011 ms), og så lenge venter både kildene
  i et nytt svar og en tråd som åpnes. Klienten gir selv opp etter 6
  sekunder. Å tegne tråden først og fylle inn teksten etterpå ville kreve en
  ny vei for oppdateringer gjennom chatten og kildepanelet. Med 237 ms
  vanligvis er det ikke verdt det nå.
- **Lageret i nettleseren har en grense.** Referansene tar om lag 380 tegn per
  bit (KA CC målte 5308 tegn for 14 biter på #227) og høyst 20 biter per
  svar, altså om lag 7 600 tegn per svar, pluss stegene. Klienten
  holder lageret under 1 000 000 tegn ved å fjerne tråden som ble brukt
  lengst siden. Går det ikke å skrive, er alt som før: kildene forsvinner ved
  innlasting, og det er det eneste som skjer.
- **Hva som ligger i lageret** (`ka.sources.v1`, rettet 2026-10-05 etter KA CC
  på #233). Nøkkelen er samtalens id fra backenden og et fingeravtrykk av
  svarteksten, altså lengden og en hash, ikke selve teksten. For hvert svar
  ligger dette der:
  - **bitene**: id, dokumentnummer, tittel, adresse og overskriftsstien. Det er
    det svaret selv bar, og det kommer fra et offentlig korpus.
  - **stegene**: hvert steg med id, slag, etikett, detalj, søkestrenger og
    varighet. Det er agentens plan i første person (etiketten på et tenkesteg),
    søkestrengene den brukte (`queries`) og verktøyets oppsummering
    (`result-summary`, som ligger i `detail`). Alt dette kommer av spørsmålet
    leseren stilte.
  - **søkeordene** i `retrieval.keywords`. Målt 5.10: det første søkeordet
    var spørsmålet, ordrett.
  - **tallene**: treff, dokumenter, tenketiden i millisekunder, og når tråden
    sist ble brukt.

  Svarteksten, spørsmålet som eget felt og tekst fra dokumentene ligger ikke
  der. Spørsmålet kan likevel leses ut av søkeordene og agentens plan.

- **Lageret er per nettleser, ikke per bruker, og det blir liggende.** Det har
  ingen utløpstid. Det ryddes bare når det blir for stort (tråden som ble brukt
  lengst siden, går først), når leseren tømmer dataene for nettstedet, eller
  når koden fjerner det. I live uten innlogging, som i testmiljøet i dag, er
  også identiteten per nettleser (`ka.user.v1`). Da ser den som bruker
  nettleseren, trådene uansett. Med innlogging har hver bruker sine egne
  tråder, og appen tar bare fram kilder og steg for tråder backenden gir den
  som er logget inn. Lageret er likevel felles, så den neste som bruker samme
  nettleser, kan lese de forriges søkeord og agentens plan i
  utviklerverktøyene. Hva en utlogging i Azure gjør med `localStorage`, er
  ikke målt.
- **Lageret tømmes ved «Logg ut»** (Lars sa ja 5.10). Det gjelder der det
  finnes en utlogging, altså i bff-modus (`/auth/logout`, `beforeLogout` i
  `src/api/session.ts`). Lageret tømmes i klikket, før nettleseren følger
  lenka. I dag skriver bare live-modus til lageret, og live har ingen
  utlogging, så bak BFF-en tømmes det en nettleser har med seg fra live.
  Tømmingen er dermed på plass den dagen lageret tas i bruk bak BFF-en. Får
  live innlogging, må den samme tømmingen inn der.
- **Et svar kjennes igjen på teksten.** Endrer backenden teksten etter at den
  er lagret, får svaret ikke kildene tilbake, og panelet er da som i dag. Det
  er tryggere enn å sette kilder på feil svar.
- **Bare live-modus.** Mock har egne data. Bak BFF-en er problemet det samme,
  og det samme lageret kan brukes der, men det er ikke en del av denne
  beslutningen.
- **Tynnserveren skal ut** (0002). Ruta er en bro, som fasettene i 0001. I
  monorepoet er det BFF-en som eier oppslaget.

## Hva som ville endret beslutningen

- **headless-rag lagrer bitene per melding (#21).** `GET /api/conversations/:id`
  gir da `contentMarkdown` for hver bit, og `sourcesFromChunks` leser den
  allerede. Da kan lageret i nettleseren fjernes.
- **headless-rag tar med `content_markdown` i `structuredContent.chunks`.**
  Da trengs ikke punkt 1 for et nytt svar. Det er API-bestilling A1, og i
  koden er det å legge til ett felt i en `select-keys`.
- **Fingeravtrykket treffer ikke.** Viser det seg at lagret tekst og strømmet
  tekst er ulike for mange svar, må nøkkelen bli noe annet. Da kan det være
  spørsmålets tekst og plassen i samtalen. Dette er målt i ett svar.
