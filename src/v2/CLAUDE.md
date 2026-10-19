# Kunnskapsassistenten V2: the component library

V2 is a library of assistant components (chat, threads, approach, sources, filter, footnotes, projects, notes, document view, and more), built on Designsystemet, and a few kits that put them together. KA is built from it, and organisations will build their own assistant from it in genki's portal. Issue #167 is the plan; its sub-issues are #168 to #182.

## V1 and V2

- `src/apps/web` is V1, today's app. **Do not change V1 to build V2**, and do not restructure V1 toward these components. V1 gets fixes and genki compatibility only, so the two can be compared.
- Everything V2 lives under `src/v2/`. Nothing in V2 imports from `src/apps/web`.

## Where things are

| Path                        | What                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `kits/<id>.json`            | One file per kit: layout, core, optional components with defaults, and what each needs from the service |
| `components/<id>/`          | One folder per component: the component, its CSS, its tests and a short README                          |
| `components/data/`          | The only code that talks to genki: thin hooks over `@genai/client`                                      |
| `playground/`               | Every component alone and together, with brand settings (#169)                                          |
| `docs/components/<id>.html` | One page per component (#171)                                                                           |
| `docs/kits/<id>.html`       | One page per kit, generated from `kits/`                                                                |

## The contract with genki

V2 talks to genki **only** through genki's frontend contract (`docs/frontend-contract.md` in digdir/genki). Read it before you change anything in `components/data/`. The rules that matter most:

- **Ask with `POST /v1/chat/completions`**, not MCP. MCP is for agents; «a frontend does not need it». Use genki's extensions: `genai_conversation: true` or `conversation_id`, `filters`, `tenant` and `dataset_config_key`, `stream: true` with `genai_stream: "live"`, `genai_steps: true`, `genai_documents`, and `input` for forms.
- **Never call the search engine or a model provider directly.** Filter counts come from `GET /api/facets`; excerpts come in `sources[].excerpts` on the answer. No Typesense key in V2.
- **Credentials stay out of the browser.** A `server` frontend sends `X-API-Key` and `X-User-Id` from a server or a dev proxy. A `browser` frontend sends `Authorization: Bearer <Ansattporten token>`. Never a key in browser code or a `VITE_` variable.
- **Services, then variants.** List one entry per service (`_default: true`, drawn with `_service_title`), and skip rows with `_alias_of` and rows with `status: "paused"`. Offer a variant picker only when a service has more than one `_pickable` row, labelled with `_variant_title`. Never present a variant as a service.
- **Citations by index.** `[N]` in the answer is the source with `index: N`. Never number sources yourself. `url` is there only when it opens; never build a link from `document_id`.
- **Streaming.** In live mode text arrives as deltas; a frame with `retract: true` means drop what you showed and start again. Sources follow the text. `genai_step` frames carry `event`, `stage`, `label`, `tool` and timing, and their members depend on the service's way of working. Keep-alive comments are not progress.
- **No answer.** `no_answer: true` with a `notice`: show the notice instead of an answer.
- **Mark every answer as made with AI.** The contract requires it.
- **Conversations.** `/api/conversations`: list (newest first), create, read, rename with `PUT { title }`, delete. With a service key, `X-User-Id` decides whose list it is; with a browser token, the signed-in person.
- **Filters.** Fields come from `_datasets[].filters` (`field`, `kinds`, `value-type`). Counts from `GET /api/facets` (disjunctive: each field's counts follow the other fields' selections). Send `filters: { fields: [{ field, value-type, selected-options }] }` with the question. Integer fields are sent as numbers.
- **Forms and results.** A service's form is `input_fields` (or `GET /v1/models/{id}/schema` with `x-widget`, `x-order`, `x-label`). The result's kind is `answer`, `document`, `fields` or `table`.
- **Attachments.** Only when the service has `_documents`; offer only `_documents.accepts`.
- **Feedback.** `POST /api/feedback { task, rating }`, with `task` from the `genai-task` header.
- **Errors.** Show genki's `detail` or `message`; decide by `code`; never parse the text. `/v1` errors are OpenAI-shaped, `/api` errors are `application/problem+json`.
- **Paused services.** `status: "paused"` with `status_reason`: show the reason, do not offer the service.
- **Pin a version** with `GenAI-Version` when a frontend must not move with the service.

`@genai/client` wraps all of this (`createClient`, `listServices`, `ask`, `stream`, `citedIndexes`, `sourceFor`, `conversations`, `facets`, `feedback`). It is not published yet; until it is, `components/data/` uses a pinned copy and notes the genki commit.

## Components

- **Designsystemet first** (`@digdir/designsystemet-react`, the same version as V1). Your own markup only where Designsystemet has nothing, and then with semantics and keyboard support from the start. Flag every deviation on the component's page.
- **Tokens only.** `var(--ds-*)` from the theme; no fixed colours, sizes or fonts. Brand is one colour through Designsystemet's theme builder (#170).
- **Data in, events out.** Components do not fetch and do not know about genki. The data layer and the kits wire them.
- **Declare what you need.** A component's needs (for example `service:filter-fields`) are listed in the kits' JSON; the kit shows the component only when the service meets them. Never show a control that does nothing.
- **Accessibility is a requirement:** WCAG 2.x AA, every action by keyboard, one polite live region for status, visible focus, reduced motion respected, and 0 axe violations in light and dark.
- **Phones first.** No sideways scrolling at 320 px. Side panels become drawers on narrow screens (#168).
- **Words.** UI text in Norwegian bokmål with æøå. Where genki sends text (step labels, errors, notices), show genki's.
- **Docs in the same PR.** A PR that changes a component updates its page in `docs/components/`: phase, variants, what we learned, and the change log on the landing page.

## Working together

- **English on GitHub and in code:** PR titles and descriptions, commit messages, branch names, issues, comments, reviews, code, comments, test names and docs. Only what users see or hear is Norwegian. Quoted UI text stays Norwegian wherever it is quoted.
- **Branches and PRs:** a branch of your own from `main`, a draft PR early, a short description that covers only the code in the PR, no AI attribution line. Never push to someone else's branch. Never rename the branch of an open PR: GitHub closes the PR.
- **Merging:** only when every check-run is green on the PR's latest commit, CodeQL included, and CI has run against today's `main`.
- **Real content for people.** The playground and local development run against genki-test with real answers. Recorded genki frames are for automated tests only; no mock content for people.
- **Your own genki key.** For local work, make a service key for `kunnskapsassistenten` in genki-test's portal (Entra ID, your Digdir email, «Tjenester» → «Kunnskapsassistenten» → «Kanaler og frontend» → «API-nøkler for tjenesten» → «Lag API-nøkkel»), named so it can be revoked on its own. Put it in `.env.local`, which is gitignored. Never paste it into chat or a commit.
- **Measure before you claim.** Numbers, times and commit ids in a PR or report come from a run, not from memory. Screenshots for anything a reader sees.

## Commands

From `src/`, Node 24:

| Command                                                      | What                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `npm ci`                                                     | Dependencies, as in `package-lock.json`                                                          |
| `npm run playground`                                         | The playground against genki-test (reads `v2/playground/.env.local`)                             |
| `npm test`                                                   | All tests, V1 and V2                                                                             |
| `npm run format:check`, `npm run typecheck`, `npm run build` | What CI runs from `src/`, besides `npm test` and V1's lint (`npm run lint --workspace apps/web`) |

(The `playground` script is added with the playground, #169.)
