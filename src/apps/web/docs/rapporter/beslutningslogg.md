# Decision log

Decisions and milestones for the client, newest first. How the log is kept is
in the [README](README.md). PR numbers without a repo in front are in this
repo.

## 2026-10-15

- **In live, a thread is no longer locked to the filter it was started with**
  ([digdir#155](https://github.com/digdir/kunnskapsassistenten/pull/155)). The filter fields are in the panel also in a thread that is under way,
  and if the filter changes, the notice comes with «Ny tråd». The issue
  [digdir#90](https://github.com/digdir/kunnskapsassistenten/issues/90) asked for a notice, not a lock, and
  the scope stood in two places, in the panel and above each answer. The line
  above the answer stays and says what that very answer was asked with. The
  backend does not store the filter per question, so it is written down in the
  browser. On another device the line therefore shows the filter the thread
  was started with. Behind the BFF the thread is still locked, because the
  server locks it.

## 2026-10-14

- **Settings is a page of its own, linked first in the foot of the navigation panel**
  ([digdir#144](https://github.com/digdir/kunnskapsassistenten/pull/144)). The experiments are there, visible to everyone, with a link to the issue
  for each of them, and colour mode has moved there from the foot. The hidden
  menu behind `#feature-flags` and the dialog behind `#innstillinger` are gone,
  and old links land on the page.

## 2026-10-07

- **Mobile with the buttons for the panels in a row at the top**, instead of
  the rails at the sides, behind the flag `mobile-top-row` ([#276](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/276),
  [digdir#120](https://github.com/digdir/kunnskapsassistenten/issues/120)).
- **The field says «Alle valgt» when every value in the list is ticked**, as
  the question counts it, and «Velg alle» adds without taking away
  ([#275](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/275)). Before, the field could say «259 av 136 valgt».

## 2026-10-06

- **An answer without sources gets one short line with an info icon** above the answer
  ([#257](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/257), point 3 in the [report](2026-10-06-gjenstaar-foer-sammenslaaing.html#valg-advarsel)).
  Designsystemet has no component of its own for a short status message.
- **Choosing an agent in the composer is built** ([#265](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/265)). Behind the BFF the
  list comes from `/api/models`. In live the choice is not shown.
- **The foot of the navigation panel scrolls with the content by default**
  ([#267](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/267), [digdir#123](https://github.com/digdir/kunnskapsassistenten/issues/123)). The fixed foot can still be chosen in
  the settings.
- **The conversation follows along down only when the reader is at the bottom or nearly at the bottom**,
  also when the reader sends ([#271](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/271), [digdir#126](https://github.com/digdir/kunnskapsassistenten/issues/126)). The limit
  is 80 px.
- **Nothing scrolls sideways on a phone**, and UI tests at twelve breakpoints
  watch over it ([#270](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/270)).
- **Feature flags in a hidden menu, `#feature-flags`** ([#269](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/269)), for
  experiments that are to be tried side by side before they are chosen. The
  first flag was `mobile-top-row`, which did nothing before [#276](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/276). The first
  ones that worked were a year filter with periods and combined labels ([#272](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/272),
  [digdir#115](https://github.com/digdir/kunnskapsassistenten/issues/115) and [digdir#116](https://github.com/digdir/kunnskapsassistenten/issues/116)), and the filters above the sources in
  the sources panel ([#274](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/274), [digdir#84](https://github.com/digdir/kunnskapsassistenten/issues/84)). From 2026-10-14 the flags are on
  Settings, visible to everyone, and the menu is gone.
- **No personal names in what is shared** ([#268](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/268)). Choices are written with the date
  and the reason.
- **Node 24 and TypeScript 6 across the board**, both here (`engines` `>=24`,
  [#263](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/263)) and in [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129) (`mise.toml`, Dockerfile, CI and the root). Measured without
  errors, and no code had to change.
- **Choosing an agent is in the composer**, like the model choice in claude.ai:
  text without a border or background, which opens a menu with a name and a
  description (point 1 in the
  [report](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **In the navigation panel, «← Tråder» stands at the start and «Skjul» at the end**, and
  the foot is as tall as the content ([#262](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/262)).
- **The ADRs are translated to English** and are in `src/decisions` in
  [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129) as
  0004–0008, after the ones that were there before. There is also one
  getting-started guide for the project after the merge, in `src/README.md`
  (point 7 in the
  [report](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **A bug in the BFF is fixed in [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129):** an answer without sources got the sources of
  the answer before it after a reload, because an empty set of sources was not stored.
- **The feedback link under each answer is taken out after the merge** and
  is to be rethought, because it adds a lot of noise under each answer (point 2 in the
  [report](2026-10-06-gjenstaar-foer-sammenslaaing.html#gjenstaar)).
- **The answer text cannot run scripts, and that is now tested**
  ([#254](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/254), [#258](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/258)): scripts, `onerror`, iframe, and links with
  `javascript:`, `vbscript:` and `data:`. A `javascript:` link becomes text and
  not an empty link ([#256](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/256)).
- **The contract types in the client match `packages/contract` in digdir#129** ([#255](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/255)),
  so the switch to the package in the monorepo becomes an import. The package
  needs `sources` on `ConversationDetail`.
- **The draft in the composer is kept when the session expires** ([#259](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/259)), and
  put back after signing in.
- **An unknown filter field gives an error message of its own** ([#260](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/260)) and not
  «svarte med feil (400)».
- **Reports and decision log in `docs/rapporter/`.** Choices and milestones
  should be readable later without the context from when they were made. The
  first report is [what remains before the merge](2026-10-06-gjenstaar-foer-sammenslaaing.html).

## 2026-10-05

- **The client is proposed into digdir/kunnskapsassistenten** as the draft PR
  [digdir#129](https://github.com/digdir/kunnskapsassistenten/pull/129). It
  replaces `src/apps/web`, behind the BFF that stays. The copy is taken in one
  commit and without the history, with the source and the SHA in the message
  and in the README, so the history stays here. The BFF changes the client
  needs are separate commits in the same PR.
- **CodeQL runs here too**
  ([#252](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/252)).
  The first run in digdir#129 found 13 alerts in our code. None of them could
  be exploited, but they are fixed, and the workflow uses the same query pack
  as digdir, so we see the alerts before they get there.
- **The test environment's backend runs upstream headless-rag** (`main` `1c65865`) instead
  of our own branch (`a836b91`), now that the filter fixes are there. The
  recipe and the rollback are in [deploy-backend.md](../deploy-backend.md).
  On the way it turned out that the template starts a deactivated revision
  again, so the old one must be deactivated after the template has run.
- **A thread started with a filter is locked to it, in live too**
  ([#247](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/247)).
  If the filter changes in a thread without a lock, the reader gets a notice
  with «Ny tråd». In live the lock applied until 2026-10-15.
- **The sources are under the answer, and the shortcuts are out of the sources panel**
  ([#246](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/246),
  [#248](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/248)).
- **Two documents with the same title get the document number after the title**
  ([#249](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/249)).
  It is the number and not «1 av 2», because the number is the same from
  answer to answer and matches the address in Kudos.
- **A filter the backend refuses is shown as that and not as a general error**
  ([#240](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/240)).
- **The text in the excerpts, and the sources and the steps after a reload, in live**
  ([ADR 0008](../../../../decisions/0008-excerpt-text-and-sources-after-reload.md),
  [#227](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/227),
  [#233](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/233)).

## 2026-09-30

- **A point from the design review is done when it can be seen in the test
  environment.** Main is deployed there after each round, and the point is
  signed off with a link to the PR.
- **Display level, and a hidden menu to choose it in**
  ([ADR 0007](../../../../decisions/0007-display-level.md)).
- **An error React does not recover from gives a page with «Last inn på nytt»** and
  not a white screen
  ([#221](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/221)).

## 2026-09-29

- **Filter fields and corpus names come from the BFF**
  ([ADR 0006](../../../../decisions/0006-filter-fields-and-corpus-from-the-bff.md)).
- **The filter lock and the name and «Logg ut» behind the BFF**
  ([#181](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/181),
  [#183](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/183)).

## 2026-09-28

- **Our client is to become `apps/web` in digdir/kunnskapsassistenten, behind
  the BFF that stays** ([ADR 0005](../../../../decisions/0005-client-behind-the-bff.md),
  [#163](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/163)).
- **The test environment gets its own headless-rag** with all of Kudos and the
  database in Postgres ([deploy-backend.md](../deploy-backend.md)). The shared
  test environment did not accept the filter and did not answer with the
  agents.
- **Where the knowledge about a corpus should live** is proposed, but not chosen
  ([ADR 0004](../../../../decisions/0004-corpus-knowledge-and-facets.md), written 24.09
  and merged with [#163](https://github.com/larsekhansen/kunnskapsassistenten-frontend/pull/163)).
