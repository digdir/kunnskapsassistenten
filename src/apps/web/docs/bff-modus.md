# BFF-modus

`VITE_API_MODE=bff` lar klienten snakke med Nikolais BFF (`src/apps/server` i
`digdir/kunnskapsassistenten`) i stedet for rett med backenden. BFF-en holder
API-nøkkelen og innloggingen, og identiteten kommer fra økta. Klienten sender
spørsmålet, samtale-id-en og filteret, ikke tenant, datasett eller
`X-User-Id`. Bakgrunnen står i `src/decisions/0005-client-behind-the-bff.md`.

| BFF-en                         | i klienten                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `POST /api/ask`                | `ask`, og samtale-id-en som svar på `createThread`                              |
| `GET /api/conversations[/:id]` | `listThreads`, `getThread`, med trådens filter i dimensjoner                    |
| `GET /api/facets`              | `listFacets`, og feltnavnene per dimensjon                                      |
| `GET /api/capabilities`        | filtrene slås av når `filters` er `false`, og korpusnavnet kommer fra `dataset` |
| 401 på et kall                 | til `/auth/login`, og tilbake til siden                                         |

BFF-en svarer fra ett datasett, satt i dens egen `.env`
(`DIGDIR_DATASET_CONFIG_KEY`). Feltene og korpusnavnet setter den med
`KA_FILTER_FIELDS` og `KA_DATASETS`, med samme grammatikk som klientens
variabler, og klienten henter dem derfra
(`src/decisions/0006-filter-fields-and-corpus-from-the-bff.md`). Klienten trenger da
verken `VITE_KA_FILTER_FIELDS`, `VITE_KA_DATASETS` eller
`VITE_KA_DATASET_CONFIG_KEY`. Mot en BFF som ikke sender `id` på fasettene,
bruker klienten fortsatt `VITE_KA_FILTER_FIELDS`. Det blir ingen
korpusvelger i bff-modus.

BFF-en har ingen rute for opplasting, så opplastingen sier fra at den ikke
finnes, som i live.

## Kjøre

I monorepoet står oppskriften i
[`src/README.md`, «Komme i gang»](../../../README.md#komme-i-gang). Steg 4
kjører BFF-en og klienten sammen, og steg 7 bygger bildet der BFF-en serverer
klienten fra samme origin.

BFF-en serverer bare `/assets/*` og `/favicon.ico` som filer; alt annet er
`index.html`. Derfor ligger fargetema-skriptet og favicon-en under `/assets/`
med hash, og derfor finnes ikke `/config.js` her: modusen må bygges inn, og
resten kommer fra BFF-en.
