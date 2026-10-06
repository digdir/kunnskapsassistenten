# Kunnskapsassistenten, frontend

Klienten til Kunnskapsassistenten (KA) i Digdir. Vite, React, TypeScript,
React Router 8.3.1 i klientmodus, Designsystemet 1.21.0. Node 24 eller nyere, som i CI og bildet.
Mer i `README.md`, kortversjonen av reglene i `CONTRIBUTING.md`. Stier og
kommandoer under gjelder fra mappa denne fila ligger i.

## Kommandoer

| Kommando                | Hva                                                                          |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm ci`                | Avhengighetene, akkurat som i `package-lock.json`.                           |
| `npm run dev`           | Utviklingsserver på http://localhost:5173, i mock.                           |
| `npm run build`         | `tsc -b` og produksjonsbygg til `dist/`.                                     |
| `npm run lint`          | oxlint med `jsx-a11y`, og stylelint på CSS-en. Den verste exit-koden vinner. |
| `npm run format:check`  | Prettier. `npm run format` skriver.                                          |
| `npm test`              | vitest, klient og server.                                                    |
| `npm run test:e2e`      | Playwright mot bygget app. Se under om porten.                               |
| `npm run tokens:verify` | At temaet i `design-tokens-build/` er det som er sjekket inn.                |
| `npm start`             | Serveren i `server/` mot `dist/`, slik containeren kjører.                   |

Før push: `lint`, `format:check`, `npm test` og `build` grønne. Les exit-koden,
ikke bare summeringslinja: vitest kan avslutte med 1 selv når alle tester står
som bestått.

## Hvor ting ligger

- `src/api/`: grensesnittet mot backenden. `mock/` er fixturene, `live/` den
  ekte klienten.
- `src/model/`: delte typer.
- `src/layout/`: skallet og de tre plassene.
- `src/views/`: innholdet i plassene (`threads`, `filters`, `chat`, `sources`).
- `src/routes/`, `src/App.tsx`: rutene.
- `src/components/`: delte komponenter, og `icons.ts`.
- `server/`: serveren i containeren. Proxy med nøkkel, statiske filer, `/healthz`.
- `deploy/`, `Dockerfile`, `.github/workflows/deploy.yml`: testmiljøet. Se
  `docs/deploy.md`.
- `tests/e2e/`: Playwright.

## Konvensjoner

- **Engelsk** i kode, filnavn, CSS-klasser, typer, ruter og kommentarer.
- **Norsk bokmål med ekte æøå** i alt brukeren ser eller hører: UI-tekst,
  `aria-label`, `title`, feilmeldinger. Også i README og docs.
- **Plasser heter etter posisjon, views etter innhold.** Plassene er
  `primary-sidebar`, `main` og `secondary-sidebar`. Ikke `left`/`right`,
  «venstre»/«høyre» i egne navn eller kommentarer; CSS-logiske egenskaper
  (`padding-inline-start`) og leverandørers egne navn er unntatt.
- **Ikoner** fra `@navikt/aksel-icons`. De med side i navnet (`ArrowLeft`,
  `SidebarRight`) går via `src/components/icons.ts` under rollenavn.
- **Designsystemet først** (`@digdir/designsystemet-react`). Egen markup bare
  der det ikke har noe, og da med semantikk og tastatur fra start. WCAG 2.x AA
  er et krav.
- **Ingen faste farger, størrelser eller fonter.** Bruk `var(--ds-*)` fra
  temaet.

## Mock og live

Standard er mock: svar fra `src/api/mock/`, ingen backend, ingen nøkkel. Live
lokalt trenger en kjørende backend og en nøkkel i `.env.local` (se
`.env.example`), og startes med `VITE_API_MODE=live npm run dev`.
`VITE_API_MODE=bff` går mot BFF-en i digdir/kunnskapsassistenten i stedet; se
`docs/bff-modus.md`.

## Utrulling

Merge til `main` ruller ut til testmiljøet i Azure Container Apps
(`.github/workflows/deploy.yml`). CI bygger og starter Docker-bildet på hver PR.
Oppsett, rollback og logger: `docs/deploy.md`.

## Ikke gjør

- **Aldri hemmeligheter i repoet.** Ingen nøkler i kode, commits eller
  `VITE_`-variabler; `.env.local` er gitignored og blir der.
- **E2E på egen port** når noe annet kan kjøre på maskinen:
  `KA_E2E_PORT=<ledig port> CI=true npm run test:e2e`. Serveren starter med
  `--strictPort`, så en annen kjøring på samme port får e2e til å feile på
  porten før en eneste test har kjørt.
- Ikke overstyr taket på vitest- og Playwright-arbeidere lokalt.
- Legg til filer eksplisitt i commits, ikke `git add -A`.
