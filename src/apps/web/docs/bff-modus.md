# BFF-modus

`VITE_API_MODE=bff` lar klienten snakke med Nikolais BFF (`src/apps/server` i
`digdir/kunnskapsassistenten`) i stedet for rett med backenden. BFF-en holder
API-nøkkelen og innloggingen, og identiteten kommer fra økta. Klienten sender
spørsmålet, samtale-id-en og filteret, ikke tenant, datasett eller
`X-User-Id`. Bakgrunnen står i `docs/arkitektur/0002-klienten-bak-bff.md`.

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
(`docs/arkitektur/0003-felt-og-korpus-fra-bff.md`). Klienten trenger da
verken `VITE_KA_FILTER_FIELDS`, `VITE_KA_DATASETS` eller
`VITE_KA_DATASET_CONFIG_KEY`. Mot en BFF som ikke sender `id` på fasettene,
bruker klienten fortsatt `VITE_KA_FILTER_FIELDS`. Det blir ingen
korpusvelger i bff-modus.

BFF-en har ingen rute for opplasting, så opplastingen sier fra at den ikke
finnes, som i live.

## Kjøre

BFF-en fra `src/` i sitt eget arbeidstre, på `:8788` med `AUTH_MODE=off`.
Feltene og korpusnavnet står i dens `apps/server/.env`, som
`KA_FILTER_FIELDS=kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer`
og `KA_DATASETS=kudos-full=Kudos|10 064 dokumenter fra kudos.dfo.no`:

```sh
npm run start --workspace apps/server
```

Klienten i utvikling, med `/api` og `/auth` proxyet til BFF-en. Adressen er
`KA_BFF_URL`, med `http://localhost:8788` som standard. `KA_API_URL` og
`KA_API_KEY` i `.env.local` leses ikke i bff-modus, så de kan bli stående for
live.

```sh
VITE_API_MODE=bff npm run dev
```

Slik det skal kjøre, med klienten servert av BFF-en fra samme origin og under
dens CSP: bygg i bff-modus, og start BFF-en med `WEB_ROOT` pekt på `dist/`.
Stien under er hovedsjekkouten i paraplymappa; juster den hvis bygget ligger
et annet sted.

```sh
VITE_API_MODE=bff npm run build
```

```sh
WEB_ROOT="$HOME/projects/kunnskapsassistenten/kunnskapsassistenten-frontend/dist" npm run start --workspace apps/server
```

Mot en BFF uten `KA_FILTER_FIELDS`, som den på `8639267`, må feltene bygges
inn i klienten som før:

```sh
VITE_API_MODE=bff VITE_KA_DATASET_CONFIG_KEY=kudos-full VITE_KA_FILTER_FIELDS='kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer' npm run build
```

BFF-en serverer bare `/assets/*` og `/favicon.ico` som filer; alt annet er
`index.html`. Derfor ligger fargetema-skriptet og favicon-en under `/assets/`
med hash, og derfor finnes ikke `/config.js` her: modusen må bygges inn, og
resten kommer fra BFF-en.
