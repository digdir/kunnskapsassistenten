# Kunnskapsassistenten, frontend

The client for Kunnskapsassistenten (KA) at Digdir. Vite, React, TypeScript,
React Router 8.3.1 in client mode, Designsystemet 1.21.0. Node 24 or newer, as in CI and the image.
More in `README.md`, the short version of the rules in `CONTRIBUTING.md`. Paths
and commands below apply from the folder this file is in.

## Commands

| Command                 | What                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| `npm ci`                | The dependencies, exactly as in `package-lock.json`.                             |
| `npm run dev`           | Development server on http://localhost:5173, against the backend (live).         |
| `npm run build`         | `tsc -b` and a production build to `dist/`, for the BFF without `VITE_API_MODE`. |
| `npm run lint`          | oxlint with `jsx-a11y`, and stylelint on the CSS. The worst exit code wins.      |
| `npm run format:check`  | Prettier. `npm run format` writes.                                               |
| `npm test`              | vitest, client and server.                                                       |
| `npm run test:e2e`      | Playwright against the built app. See below about the port.                      |
| `npm run tokens:verify` | That the theme in `design-tokens-build/` is the one checked in.                  |
| `npm start`             | The server in `server/` against `dist/`, as the container runs it.               |

Before you push: `lint`, `format:check`, `npm test` and `build` green. Read the
exit code, not just the summary line: vitest can exit with 1 even when every
test is listed as passed.

## Where things are

- `src/api/`: the interface to the backend. `mock/` is the fixtures, `live/`
  the real client.
- `src/model/`: shared types.
- `src/layout/`: the shell and the three slots.
- `src/views/`: the content of the slots (`threads`, `filters`, `chat`, `sources`).
- `src/routes/`, `src/App.tsx`: the routes.
- `src/components/`: shared components, and `icons.ts`.
- `server/`: the server in the container. Proxy with the key, static files, `/healthz`.
- `deploy/`, `Dockerfile`, `.github/workflows/deploy.yml`: the test environment.
  See `docs/deploy.md`.
- `tests/e2e/`: Playwright.

## Conventions

- **English** in code, file names, CSS classes, types, routes, comments and
  test names, and in commit messages, branch names, PRs, issues, reviews and
  docs, this file included. Norwegian docs are translated when a PR touches
  them.
- **Norwegian bokmål with real æøå** in everything users see or hear: UI text,
  `aria-label`, `title`, error messages, `lang="nb"`. Quoted UI text stays
  Norwegian wherever it is quoted, in a test name too. KA terms may be quoted
  in Norwegian in code comments where needed («tråd», «kilde»).
- **Slots are named for position, views for content.** The slots are
  `primary-sidebar`, `main` and `secondary-sidebar`. No `left`/`right` or
  «venstre»/«høyre» in our own names or comments; CSS logical properties
  (`padding-inline-start`) and vendors' own names are exempt.
- **Icons** from `@navikt/aksel-icons`. The ones with a side in the name
  (`ArrowLeft`, `SidebarRight`) go through `src/components/icons.ts` under role
  names.
- **Designsystemet first** (`@digdir/designsystemet-react`). Our own markup
  only where it has nothing, and then with semantics and keyboard support from
  the start. WCAG 2.x AA is a requirement.
- **No fixed colours, sizes or fonts.** Use `var(--ds-*)` from the theme.
- **Component docs.** A PR that changes a component listed in #167 also
  updates its page in `docs/components/` (phase, variants, what we learned),
  its badges in `docs/components/index.html`, and the change log there. Only
  components from #167 get a page; the design canvas is a source of learnings,
  not the list. The pages are an internal working document and use their own
  colours, so they open from disk without the theme.

## Live, bff and mock

The default in development is live, as in the test environment: the Vite proxy
sends `/api` to `KA_API_URL` with `KA_API_KEY`, and `/api/facets` and
`/api/excerpts` are answered from Typesense with a search key. The values are in
`.env.local` (see `.env.example`), and the dev server says at startup if
anything is missing. `VITE_API_MODE=bff` goes to the BFF in
digdir/kunnskapsassistenten instead; see `docs/bff-modus.md`. `mock` is the
tests' mode, and Playwright and vitest set it themselves. A value that is not
`live`, `bff` or `mock` stops the dev server and the build.

## Deployment

The test environment in Azure Container Apps is deployed by hand. The
workflows in `.github/` here do not run, because GitHub reads only
`.github/workflows/` at the repo root. The image is built with `src/` as the
context and `--file apps/web/Dockerfile`, because the lockfile is in `src/`.
Commands, rollback and logs: `docs/deploy.md`.

## Don't

- **Never secrets in the repo.** No keys in code, commits or `VITE_`
  variables; `.env.local` is gitignored and stays that way.
- **E2E on a port of your own** when something else may be running on the
  machine: `KA_E2E_PORT=<free port> CI=true npm run test:e2e`. The server
  starts with `--strictPort`, so another run on the same port makes e2e fail on
  the port before a single test has run.
- Don't override the cap on vitest and Playwright workers locally.
- Add files to commits explicitly, not with `git add -A`.
