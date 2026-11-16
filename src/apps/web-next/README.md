# apps/web-next: the client

Kunnskapsassistenten built from genki's UI blocks: `<Assistant>` from `@genai/ui-assembly` with
the template `knowledge-assistant-next`. It is the only client (`src/decisions/0019`); the server
in `apps/server` serves it at every page address. The name is kept from when it ran beside the
previous client.

## Where things are

- `src/main.tsx` and `src/Root.tsx`: the page. Who is signed in comes from `GET /api/next/me`
  (`session.ts`), then the address picks what is drawn (`pages/paths.ts`): the assistant at `/`
  and `/innstillinger`, KA's pages at `/endringslogg` and `/om-prosjektet`, and «Siden finnes
  ikke» anywhere else. `previousClient.ts` forgets what the previous client kept in the browser.
- `src/App.tsx`: the assistant. genki is reached through the server's proxy at `/api/next/genki`
  (`api.ts`), and the choices kept in the browser use keys that start with `ka-next.`.
- `src/profile.ts`: what KA knows that genki does not say: Kudos's fields and words, the
  suggestions, the document links and the experiments. UI text is Norwegian bokmål.
  `hostProfileFor` is the part only the host can give, which is all the page uses of it when
  the server hands it a layout from genki's builder (`KA_NEXT_LAYOUT`, `src/decisions/0017`).
  `drawingFor` in `src/App.tsx` chooses.
- `src/menu.tsx`: KA's entries in genki's profile menu, «Endringslogg» and «Om prosjektet»,
  opened with the assistant's address in `?fra=`, so their way back returns to the thread. Only
  for KA's service: another service drawn from a layout gets genki's entries only.
- `src/pages/`: KA's pages. `changelog.ts` and `about.ts` hold their text as Markdown,
  `markdown.tsx` draws the little of it they use with Designsystemet, and `Page.tsx` is the page
  around it. A new entry in «Endringslogg» goes on top of `changelog.ts`, in the same form.
- `src/feedback.ts`: feedback on an answer, to the server's `POST /api/next/feedback`, which
  checks that the run is in the person's own thread and takes it only with a person's token.
- `src/theme.css`: Designsystemet's theme, made from `designsystemet.config.json` by
  `npm run tokens:build`. `npm run tokens:verify` checks it, in CI too.
- `vendor/genki`: genki's `client`, `i18n`, `ui-blocks` and `ui-assembly` as source, at the
  commit in `vendor/genki/GENKI_COMMIT`. Resolved by the aliases in `vite.config.ts` and the
  `paths` in `tsconfig.json`.

## vendor/genki is never edited by hand

A fix goes to digdir/genki as a pull request, and comes back with the script:

```sh
git -C <genki checkout> fetch origin
sh scripts/sync-genki.sh <genki checkout> origin/main
# or a pull request's head, naming its branch:
sh scripts/sync-genki.sh <genki checkout> <sha> <branch>
```

CI takes the snapshot again at the recorded commit and fails on any difference, and a test fails
on a local marker or a test file in `vendor/`.

## Running it

From `src/`, `npm run web` builds it and starts the server serving it, and `npm run dev` serves
it with Vite and sends `/api` and `/auth` to the server in `KA_SERVER_URL`
(`http://localhost:8787` by default). See `src/README.md`. With `KA_NEXT_LAYOUT` on the server,
the JSON of a layout from genki's builder or a file's path, the page draws that layout in its own
words instead of KA's (`src/decisions/0017`).

```sh
npm run build --workspace apps/web-next
npm run test --workspace apps/web-next
npm run tokens:verify --workspace apps/web-next
node apps/web-next/scripts/check-bundle-size.mjs apps/web-next/dist
```

## Conventions

- **English** in code, file names, CSS classes, types, comments and test names. **Norwegian
  bokmål with real æøå** in everything users see or hear: UI text, `aria-label`, `title`, error
  messages. Quoted UI text stays Norwegian wherever it is quoted, in a test name too.
- **genki's blocks first, then Designsystemet** (`@digdir/designsystemet-react`). Our own markup
  only where neither has it, with semantics and keyboard support from the start. WCAG 2.x AA is a
  requirement.
- **No fixed colours, sizes or fonts.** Use `var(--ds-*)` from the theme.
- **Icons** from `@navikt/aksel-icons`.
- **Never secrets in the client.** The server holds every key and token.

## Not here yet

- The previous client's «Onboarding» page.
- Choosing another organisation from the profile menu.
- «Testmiljø» for a tester: the server sends their calls to genki's test environment
  (`src/decisions/0015`), but the page does not say so.
