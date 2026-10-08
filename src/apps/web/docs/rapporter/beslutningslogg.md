# Beslutningslogg

Beslutninger og milepæler for klienten, med den nyeste øverst. Hvordan loggen
føres, står i [README](README.md). PR-numrene uten repo foran er i dette repoet.

## 2026-10-07

- **Mobil med knappene for panelene i en rad øverst**, i stedet for skinnene på
  sidene, bak flagget `mobile-top-row` ([#276](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/276),
  [digdir#120](https://github.com/digdir/kunnskapsassistenten/issues/120)).
- **Feltet sier «Alle valgt» når hver verdi i lista er krysset av**, slik
  spørsmålet regner, og «Velg alle» legger til uten å ta bort
  ([#275](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/275)). Før kunne feltet si «259 av 136 valgt».

## 2026-10-06

- **Et svar uten kilder får én kort linje med et info-ikon** over svaret
  ([#257](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/257), punkt 3 i [rapporten](2026-10-06-gjenstaar-foer-sammenslaaing.html#valg-advarsel)).
  Designsystemet har ingen egen komponent for en kort statusmelding.
- **Valg av agent i skrivefeltet er laget** ([#265](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/265)). Bak BFF-en kommer
  lista fra `/api/models`. I live vises ikke valget.
- **Foten i navigasjonspanelet ruller med innholdet som standard**
  ([#267](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/267), [digdir#123](https://github.com/digdir/kunnskapsassistenten/issues/123)). Den festede foten kan fortsatt velges i
  innstillingene.
- **Samtalen følger med ned bare når leseren er nederst eller nesten nederst**,
  også når leseren selv sender ([#271](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/271), [digdir#126](https://github.com/digdir/kunnskapsassistenten/issues/126)). Grensen
  er 80 px.
- **Ingenting ruller sidelengs på telefon**, og UI-tester på tolv bruddpunkter
  passer på det ([#270](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/270)).
- **Funksjonsflagg i en skjult meny, `#feature-flags`** ([#269](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/269)), for
  forsøk som skal prøves side om side før de velges. Det første flagget var
  `mobile-top-row`, som ikke gjorde noe før #276. De første som virket, var
  årsfilter med perioder og samlede merkelapper ([#272](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/272),
  [digdir#115](https://github.com/digdir/kunnskapsassistenten/issues/115) og [digdir#116](https://github.com/digdir/kunnskapsassistenten/issues/116)), og filtrene over kildene i
  høyre panel ([#274](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/274), [digdir#84](https://github.com/digdir/kunnskapsassistenten/issues/84)).
- **Ingen personnavn i det som deles** ([#268](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/268)). Valg skrives med dato
  og grunn.
- **Node 24 og TypeScript 6 over hele linja**, både her (`engines` `>=24`,
  [#263](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/263)) og i [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129) (`mise.toml`, Dockerfile, CI og rota). Målt uten
  feil, og ingen kode måtte endres.
- **Valg av agent står i skrivefeltet**, som modellvalget i claude.ai: tekst uten
  ramme og bakgrunn, som åpner en meny med navn og beskrivelse (punkt 1 i
  [rapporten](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **I navigasjonspanelet står «← Tråder» til venstre og «Skjul» til høyre**, og
  foten er like høy som innholdet ([#262](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/262)).
- **ADR-ene er oversatt til engelsk** og ligger i `src/decisions` i
  [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129) som
  0004–0008, etter de som var der fra før. Der står også én kom-i-gang for
  prosjektet etter sammenslåingen, i `src/README.md` (punkt 7 i
  [rapporten](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **En feil i BFF-en er rettet i [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129):** et svar uten kilder fikk kildene til
  svaret før etter ny innlasting, fordi et tomt sett kilder ikke ble lagret.
- **Lenken til tilbakemelding under hvert svar tas etter sammenslåingen** og
  skal tenkes nytt, fordi den gir mye støy under hvert svar (punkt 2 i
  [rapporten](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **Svarteksten kan ikke kjøre skript, og det er nå testet**
  ([#254](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/254), [#258](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/258)): skript, `onerror`, iframe, og lenker med
  `javascript:`, `vbscript:` og `data:`. En `javascript:`-lenke blir tekst og
  ikke en tom lenke ([#256](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/256)).
- **Kontrakttypene i klienten er like `packages/contract` i digdir#129** ([#255](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/255)),
  så byttet til pakken i monorepoet blir en import. Pakken trenger `sources` på
  `ConversationDetail`.
- **Utkastet i skrivefeltet tas vare på når økta går ut** ([#259](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/259)), og
  settes inn igjen etter innloggingen.
- **Et ukjent filterfelt gir en egen feilmelding** ([#260](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/260)) og ikke
  «svarte med feil (400)».
- **Rapporter og beslutningslogg i `docs/rapporter/`.** Valg og milepæler skal
  kunne leses senere uten konteksten fra da de ble gjort. Den første rapporten
  er [det som gjenstår før sammenslåingen](2026-10-06-gjenstaar-foer-sammenslaaing.html).

## 2026-10-05

- **Klienten er foreslått inn i digdir/kunnskapsassistenten** som utkast-PR
  [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129). Den
  erstatter `src/apps/web`, bak BFF-en som står. Kopien er tatt i én commit og
  uten historikken, med kilden og SHA-en i meldingen og i README-en, så
  historikken blir værende her. BFF-endringene klienten trenger, er egne
  commits i den samme PR-en.
- **CodeQL kjører også her**
  ([#252](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/252)).
  Den første kjøringen i digdir#129 fant 13 varsler i koden vår. Ingen av dem
  kunne utnyttes, men de er rettet, og arbeidsflyten bruker den samme
  spørringspakken som digdir, så vi ser varslene før de kommer dit.
- **Testmiljøets backend kjører upstream headless-rag** (`main` `1c65865`) i
  stedet for vår egen gren (`a836b91`), nå som filterrettelsene er der.
  Oppskriften og tilbakerullingen står i [deploy-backend.md](../deploy-backend.md).
  Underveis viste det seg at malen setter en deaktivert revisjon i gang igjen,
  så den gamle må deaktiveres etter at malen har kjørt.
- **En tråd som er startet med et filter, er låst til det, også i live**
  ([#247](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/247)).
  Endres filteret i en tråd uten lås, får leseren en beskjed med «Ny tråd».
- **Kildene står under svaret, og snarveiene er ute av kildepanelet**
  ([#246](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/246),
  [#248](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/248)).
- **To dokumenter med samme tittel får dokumentnummeret etter tittelen**
  ([#249](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/249)).
  Det er nummeret og ikke «1 av 2», fordi nummeret er det samme fra svar til
  svar og stemmer med adressen i Kudos.
- **Et filter backenden avviser, vises som det og ikke som en generell feil**
  ([#240](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/240)).
- **Teksten i utdragene, og kildene og stegene etter ny innlasting, i live**
  ([ADR 0008](../../../../decisions/0008-excerpt-text-and-sources-after-reload.md),
  [#227](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/227),
  [#233](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/233)).

## 2026-09-30

- **Et punkt fra designgjennomgangen er ferdig når det kan sees i
  testmiljøet.** Main rulles ut dit etter hver runde, og punktet kvitteres ut
  med en lenke til PR-en.
- **Visningsnivå, og en skjult meny å velge det i**
  ([ADR 0007](../../../../decisions/0007-display-level.md)).
- **En feil React ikke kommer seg fra, gir en side med «Last inn på nytt»** og
  ikke en hvit skjerm
  ([#221](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/221)).

## 2026-09-29

- **Filterfelt og korpusnavn kommer fra BFF-en**
  ([ADR 0006](../../../../decisions/0006-filter-fields-and-corpus-from-the-bff.md)).
- **Filterlåsen og navnet og «Logg ut» bak BFF-en**
  ([#181](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/181),
  [#183](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/183)).

## 2026-09-28

- **Klienten vår skal bli `apps/web` i digdir/kunnskapsassistenten, bak BFF-en
  som står** ([ADR 0005](../../../../decisions/0005-client-behind-the-bff.md),
  [#163](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/163)).
- **Testmiljøet får sin egen headless-rag** med hele Kudos og databasen i
  Postgres ([deploy-backend.md](../deploy-backend.md)). Det delte testmiljøet
  tok ikke imot filteret og svarte ikke med agentene.
- **Hvor kunnskapen om et korpus skal bo** er foreslått, men ikke valgt
  ([ADR 0004](../../../../decisions/0004-corpus-knowledge-and-facets.md), skrevet 24.09
  og merget med #163).
