# Contributing to kunnskapsassistenten-frontend

The short version of the build rules. The full version is
`design/_briefs/bygg/regler.md` in the local `design/` folder, and it is the
answer where the two disagree.

## Names and language

This is the rule that is easiest to break and most expensive to fix.

- **English:** code, file names, folders, CSS classes, CSS variables, types,
  routes, comments, test names, commit messages, branch names, PRs, issues,
  reviews and docs. That includes `README.md` and this file. Norwegian docs are
  translated when a PR touches them.
- **Norwegian bokmål with real æøå:** everything users see or hear. UI text,
  `aria-label`, `title`, error messages, `lang="nb"`. Quoted UI text stays
  Norwegian wherever it is quoted, in a test name too.
- **Slots are named for position, views for content**, as in VS Code. The
  slots are `primary-sidebar`, `main` and `secondary-sidebar`. The views are
  `threads`, `filters`, `chat`, `sources`.
- **A slot never has a fixed `aria-label`.** The name comes from the view that
  is in it, through `slotLabel()` in `src/layout/viewModel.ts`.
- **No «venstre», «høyre», `left` or `right` anywhere**, not in comments
  either. Run `grep -rin 'venstre\|høyre\|left\|right' src` before you push; it
  should find nothing except CSS logical properties such as `padding-inline`
  and **`src/components/icons.ts`**, which is the one allowed border with the
  vendor's own icon names and renames them to ours.
- **Import icons from `src/components/icons.ts`**, never from
  `@navikt/aksel-icons` directly.

See [README, Naming](README.md#naming) for the reasoning.

## Ownership by folder

Never touch a folder you do not own. If you need something there, report the
need to the conductor, who gives it to the owner.

| Role                                     | Owns                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Reviewer, design system guard, e2e tests | `tests/`, `playwright.config.ts`, `docs/review/`; no feature code                                                                          |
| Foundation                               | `src/api/`, `src/model/`, `src/layout/`, `src/routes/`, `src/components/`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `package.json` |
| Primary sidebar                          | `src/views/threads/`, `src/views/filters/`                                                                                                 |
| Main                                     | `src/views/chat/`                                                                                                                          |
| Secondary sidebar                        | `src/views/sources/`                                                                                                                       |

- **Only the foundation adds dependencies.** Others report a need. The
  exception: the reviewer adds test dependencies in a small PR of its own.
- Route pages (`src/routes/`) and the route setup (`App.tsx`) are the
  foundation's; a view exports a component that the foundation mounts in the
  right slot and route.
- Shared types live in `src/model/` (the foundation). Code against them, ask
  for changes.
- Before the foundation is merged: use mock data from `src/api/mock/`, or
  fixtures of your own in your own folder.

## The view head: what stands still while the rest scrolls

Each slot has one **view head slot**, at the top of the scrolling region,
owned by the shell (`src/layout/ViewHead.tsx`). A view fills it:

```tsx
<ViewHead>
  <Button onClick={() => onShowView('threads')}>Tråder</Button>
  <PanelHeader title="Filtrering" />
</ViewHead>
```

**Don't make your own `position: sticky` at the top of a panel.** A sticky
head covers everything above it in the same scrolling box, and «above» applies
to the tab order too: the browser scrolls a control that gets focus to the top
of the region, which is exactly where the head is. The control lands under the
head, clicks land on the head and the focus ring is invisible (WCAG 2.4.11).
Measured in
[PR #55](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/55)
in the earlier repo, where the «Tråder» button became unclickable because of a
view-local head.

That is why the shell puts the box first in the region, and a view that wants a
button to stay put puts **the button in the head** instead of above it. Write
`ViewHead` first in the view, and the DOM order and the tab order are the same.
The shell also sets `scroll-padding-block-start` to the height of the head, so
`scrollIntoView` and focus stop below it.

One head per slot. Two views in the same slot are modes of one panel, and only
one of them is mounted at a time. An empty head draws no line
(`.view-head:empty`). Outside the shell — the preview pages, most of the unit
tests — the head is drawn where it is.

## Designsystemet first, always

Never build a component Designsystemet already has. It is expensive to fix
later.

1. Look up the need in `design/designsystemet/behov-til-komponent.md`.
2. Read the component in `design/designsystemet/komponenter/<name>.md`.
3. Only then, if Designsystemet has nothing: a construction of your own, with
   semantics and keyboard support from day one.

- **No hard-coded colours, sizes or fonts.** `var(--ds-*)`. Numbers from
  `design/tokens/`, never from Figma Dev Mode. One hard-coded colour is enough
  to break dark mode, see the README.
- Our own CSS is written **outside all layers**, see the README.
- **If you set `display` on something that can be hidden with `hidden`, you
  must write `[hidden] { display: none }` yourself.** Our own CSS is outside
  the layers and beats the browser's own `[hidden]` rule, so the element stays
  visible while the button says it is hidden. Measured in the shell.
- Hover, focus and keyboard focus are **inherited** from Designsystemet and not
  drawn by us. If an element of our own needs a focus ring, use the class
  `ds-focus--visible`.

### Color mode: accent at the root, neutral on the chrome

`data-color="accent"` is on `<body>`. It applies to the **interactive** roles
— buttons, borders that should draw the eye, active chips, link text — and
they are written with role tokens without a family:
`var(--ds-color-base-default)`, `var(--ds-color-text-subtle)`.

**The chrome is written with an explicit neutral family.** Body text, form
borders, surfaces and backgrounds:

```css
color: var(--ds-color-neutral-text-default);
border-color: var(--ds-color-neutral-border-subtle);
background: var(--ds-color-neutral-surface-default);
```

The reason is in `design/tokens/figma-til-tokens.md`, point 8.2: with accent at
the root and only role tokens, the body text turns dark navy (#002c54) and the
form borders blue (#2a7cc5). Nobody drew that, and it is not what the design
shows.

## WCAG 2.x AA is a requirement

Not a goal. The public sector and the accessibility requirements. Any shortcut
that gives the look without the accessibility is ruled out.

- `npm run lint` runs the `jsx-a11y` rules as errors, not warnings. If a rule
  is to be waived, write `// oxlint-disable-next-line <rule>` with one line on
  why the waiver is the accessible choice. There is one today.
- Icon buttons must have an `aria-label`.
- **A control that disappears through its own action must say where focus
  goes.** «Prøv igjen», «Lukk», «Slett», «Vis mer» that unmount themselves:
  focus falls to `<body>`, and the next Tab starts over at the skip link, a
  whole page away from what the user was doing. WCAG 2.4.3. Move focus to what
  the action made, not to the top of the page. `ErrorState` takes it as
  `focusAfterRetry`, a ref to the list or the answer that came; without it
  focus lands on the alert region, which keeps the tab order but says nothing.
- Landmarks and heading levels must fit together.
- Run the app headless and take an accessibility snapshot of what you built
  before you report done. Screenshot to
  `design/skjermbilder-frontend/<branch>-<slug>.png`.

## TypeScript

`strict: true` is in both tsconfigs. Don't turn it off, and don't add `any` to
get around it.

## Git and PRs

- Branch `feat/<area>` from `main`, with an English name, and the PR has base
  `main`. Never rename the branch of an open PR: that closes the PR, and a PR
  cannot change its branch. Small commits.
- Commit messages in **English**, with the trailer
  `Co-Authored-By: Claude <the model you actually run> <noreply@anthropic.com>`,
  for example `Claude Opus 5.5 (1M context)`. Look at the model name in your
  status line; not everyone runs the same model.
- Push your own branch, **open the PR against `main` as a draft early**, and
  keep it updated. CI runs only on PRs. When every check-run is green, CodeQL
  included, report to the conductor, and the reviewer reviews. After the
  approval you mark the PR as ready.
- **Never merge.** The repo's maintainer merges, not the conductor and not
  you. Never push to `main` or to someone else's branch. Rebase on `main` when
  the conductor says so.
- The PR description covers **only** what is in the PR, in English. Short. No
  AI attribution, no «follow-up» or «test plan» — tell the conductor that
  instead.
- Comments in your own PR are fine. No other GitHub posts (issues, reviews on
  someone else's PR) without a yes from the maintainer via the conductor.

## Green before you push

```sh
npm run build
npm run lint
npm run format:check
npm run test
npm run tokens:verify
```

All five, every time.

## Hooks: what the machine checks for you

`npm install` sets up two git hooks (`simple-git-hooks`, through `prepare`).
They do not replace the list above — they catch the cheapest part of it before
you have time to forget it.

| when         | what                                                                                                  | measured                             |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `git commit` | only the **staged** files: `stylelint` on `.css`, `oxlint` on `.ts`/`.tsx`, `prettier --check` on all | 0.9 s for two files, 1.8 s for seven |
| `git push`   | `tsc -b`                                                                                              | 3 s warm, 8.6 s the first time       |

`stylelint` here is the compatibility rule: it stops a commit with a CSS
property the browsers in `.browserslistrc` do not support. That is what it was
installed for — an unprefixed `line-clamp` is stopped in 1.9 seconds, with the
browser and version in the message.

**Vitest is not in the hooks**, and that is a choice with a number behind it:
the suite takes 47.9 seconds, fourteen times `tsc`. A hook that adds a minute
to every push is a hook people turn off, and then we lose `tsc` too. The suite
is run by you before you push (the list above) and by CI on every PR.

**The hooks are shared between the worktrees.** We each have our own `.git`
file, but they point to the same `commondir`, and that is where git looks for
hooks — so an `npm install` in one worktree sets them up for everyone. That
also applies to worktrees on a branch from before the tool existed, and it was
a real crash: the first version ran `lint-staged` straight from the hook, and
the others could not commit at all (23.09).

That is why the hooks check that the tool is there before they use it:

| situation                                              | what the hook does                 |
| ------------------------------------------------------ | ---------------------------------- |
| the tool is there                                      | runs, as in the table above        |
| `package.json` knows it, but `node_modules` is missing | stops and says «run `npm install`» |
| the branch does not know it                            | carries on, without a sound        |

The last row is the point: a branch that has not asked for the hook should not
be stopped by it.

To skip in an emergency:

```sh
git commit --no-verify
git push --no-verify
```

It is an emergency exit and not a shortcut: CI runs everything anyway, so what
you skip here meets you there.

## Shared resources

- Dev server: 5173 is the foundation's. The primary sidebar uses 5174, main
  5175, the secondary sidebar 5176 (`--port`).
- E2E: the reviewer 4173, the primary sidebar 4174, main 4175, the secondary
  sidebar 4176, the foundation 4177. Run
  `KA_E2E_PORT=<yours> CI=true npm run test:e2e`. Without it everyone ends up
  on 4173, and then startup fails with the port named, because
  `playwright.config.ts` has `reuseExistingServer: false` and `--strictPort`.
- **Your own port and your own PID only.** Check that the port is free
  (`lsof -ti tcp:<port> -sTCP:LISTEN`) before you start, start with
  `--strictPort`, and stop only the PID that listens on your port. Never
  `pkill -f`, and never a loop over ports: a command line such as
  `npm run dev` is the same in every worktree, and either one stops someone
  else's server. **Stop after yourself.**
- No browser windows on the screen. Headless.
- Don't touch the RAG stack (8080 and 3030). Read, don't restart.

## The specifications

- `design/omraader/september-2026/` is **the answer**.
- `design/omraader/molecules/` and `organisms/` for component details.
- `design/svar-skjema.md` and `design/visjon-og-beslutninger.md` for
  decisions.
- `design/skal-dette-implementeres.md` for what is yes, later and no, and for
  the build order.
