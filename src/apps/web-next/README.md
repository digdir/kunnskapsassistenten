# apps/web-next: the next client

Kunnskapsassistenten built from genki's UI blocks: `<Assistant>` from `@genai/ui-assembly` with
the template `knowledge-assistant-next`. It runs beside `apps/web` in the same app, behind a
toggle (`src/decisions/0013`): «Prøv ny versjon» in `apps/web`, «Tilbake til gammel versjon» in
this client's profile menu. Nothing here imports `apps/web`.

## Where things are

- `src/App.tsx`: the host page. Who is signed in comes from `GET /api/next/me` (`session.ts`),
  genki is reached through the server's proxy at `/api/next/genki` (`api.ts`), and the choices
  kept in the browser use keys that start with `ka-next.`.
- `src/profile.ts`: what KA knows that genki does not say: Kudos's fields and words, the
  suggestions, the document links and the experiments. UI text is Norwegian bokmål.
  `hostProfileFor` is the part only the host can give, which is all the page uses of it when
  the server hands it a layout from genki's builder (`KA_NEXT_LAYOUT`, `src/decisions/0017`).
  `drawingFor` in `src/App.tsx` chooses.
- `src/menu.tsx`: KA's entries in genki's profile menu: «Endringslogg» and «Om prosjektet», which
  are apps/web's pages (the server serves them from apps/web whichever client was chosen), opened
  with this client's address in `?fra=` for apps/web's «Tilbake til ny versjon», and
  «Tilbake til gammel versjon». None of them where the server serves only this client
  (`KA_NEXT_ONLY`, `nextOnly` in `/api/next/me`), as there is no apps/web there.
- `src/feedback.ts`: feedback on an answer, to the server's `POST /api/next/feedback`, which
  checks that the run is in the person's own thread and takes it only with a person's token.
- `src/theme.css`: a copy of `apps/web/design-tokens-build/digdir.css`.
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

The server serves it: build it, and start the server with `KA_NEXT=1` and
`WEB_NEXT_ROOT=apps/web-next/dist`, beside `WEB_ROOT=apps/web/dist`. Then «Prøv ny versjon» in
`apps/web` switches. For work on this client alone, `npm run dev --workspace apps/web-next`
serves it with Vite and sends `/api` and `/auth` to the server in `KA_SERVER_URL`
(`http://localhost:8788` by default), which needs `KA_NEXT=1` too. With `KA_NEXT_LAYOUT` on the
server, the JSON of a layout from genki's builder or a file's path, the page draws that layout in
its own words instead of KA's (`src/decisions/0017`). With `KA_NEXT_ONLY=1` as well, the server
serves this client at `/` for everyone, and apps/web not at all.

```sh
npm run build --workspace apps/web-next
npm run test --workspace apps/web-next
node apps/web-next/scripts/check-bundle-size.mjs apps/web-next/dist
```

## Not here yet

- `apps/web`'s «Onboarding» page.
- Choosing another organisation from the profile menu.
