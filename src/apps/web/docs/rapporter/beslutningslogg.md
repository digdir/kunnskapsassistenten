# Beslutningslogg

Beslutninger og milepæler for klienten, med den nyeste øverst. Hvordan loggen
føres, står i [README](README.md). PR-numrene uten repo foran er i dette repoet.

## 2026-10-06

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
  ([ADR 0005](../arkitektur/0005-utdragstekst-og-kilder-etter-innlasting.md),
  [#227](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/227),
  [#233](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/233)).

## 2026-09-30

- **Et punkt fra designgjennomgangen er ferdig når det kan sees i
  testmiljøet.** Main rulles ut dit etter hver runde, og punktet kvitteres ut
  med en lenke til PR-en.
- **Visningsnivå, og en skjult meny å velge det i**
  ([ADR 0004](../arkitektur/0004-visningsnivaa.md)).
- **En feil React ikke kommer seg fra, gir en side med «Last inn på nytt»** og
  ikke en hvit skjerm
  ([#221](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/221)).

## 2026-09-29

- **Filterfelt og korpusnavn kommer fra BFF-en**
  ([ADR 0003](../arkitektur/0003-felt-og-korpus-fra-bff.md)).
- **Filterlåsen og navnet og «Logg ut» bak BFF-en**
  ([#181](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/181),
  [#183](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/183)).

## 2026-09-28

- **Klienten vår skal bli `apps/web` i digdir/kunnskapsassistenten, bak BFF-en
  som står** ([ADR 0002](../arkitektur/0002-klienten-bak-bff.md),
  [#163](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/163)).
- **Testmiljøet får sin egen headless-rag** med hele Kudos og databasen i
  Postgres ([deploy-backend.md](../deploy-backend.md)). Det delte testmiljøet
  tok ikke imot filteret og svarte ikke med agentene.
- **Hvor kunnskapen om et korpus skal bo** er foreslått, men ikke valgt
  ([ADR 0001](../arkitektur/0001-fasetter-og-korpuskunnskap.md), skrevet 24.09
  og merget med #163).
