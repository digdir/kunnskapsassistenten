# 0017: The next client draws a layout from genki's builder, given in config

**Status:** accepted · **Date:** 2026-11-14

## Context

genki's builder lays out an assistant from genki's UI blocks: an `AssistantLayout` v1 with its
template, blocks, look and `profile`, the words it is drawn with (genki ADR 0054, genki#562). The
assembly draws it with `profileOf(layout, host)`: the host's profile wins where it says something,
and the layout's fills the rest. genki has nowhere to store a layout yet; that waits for a genki
ADR. Until then a host keeps the layout itself.

The next client (`decisions/0013`) already asks the genki service and variant in `KA_NEXT_MODEL`.
With a layout as well, a second deployment of the same image draws another service in KA's way:
another assistant made with genki's tools, with no code of its own.

## Decision

**`KA_NEXT_LAYOUT` gives the next client a layout: the JSON from the builder's «Kopier oppsettet»,
or the path of a file holding it.** An environment variable fits Container Apps as the other
settings do; a path also takes a secret mounted as a file. Unset or empty, nothing changes:
the page draws genki's template `knowledge-assistant-next` with KA's whole profile, and
`/api/next/me` answers as before.

- **The server checks it with genki's own rules when it starts.** It runs `isAssistantLayout` and
  `layoutProblems` from the next client's vendored ui-blocks (`apps/web-next/vendor/genki`), as
  they are, so a layout the builder would refuse is refused here too. A layout that is not JSON,
  not an `AssistantLayout` v1, larger than 64 kB, or that breaks a rule stops the server when
  `KA_NEXT` is on, and is warned about and ignored when it is off, as `KA_NEXT_MODEL` is. The log
  names each problem by genki's rule and its path in the layout, never the variable's value or
  the file's text. What the service backs is not checked at start: the assembly leaves out a
  block the service cannot back when it asks genki.
- **The server runs the vendored source without a build.** genki's files import each other as
  `.js`; a resolve hook (`module.registerHooks`), registered only when a layout is read and only
  for files under `vendor/genki`, takes the `.ts` file of such an import. The image holds the
  vendored ui-blocks and genki's licence beside the server.
- **`/api/next/me` carries the layout** as `layout`, only when one is set, so the page has it
  before its first render, with who is signed in. The page checks its shape with
  `isAssistantLayout` again.
- **With a layout, the page uses only the host's part of KA's profile** (`hostProfileFor` in
  `profile.ts`): who is signed in and their organisation, the sign-out, the profile menu, the
  family limited to the configured service, and KA's two trials, which the assembly carries
  out. KA's name, suggestions, Kudos's words and links and the settings note are left out, so
  the layout's words are drawn. `<Assistant>` gets the host's part, and genki's calls
  (`createGenkiApi`) get the merged `profileOf(layout, host)`, as genki ADR 0054 asks.
- **`KA_NEXT_ONLY` makes the next client the deployment's only one.** A deployment of another
  service has no `apps/web`: it would draw KA. With `KA_NEXT_ONLY=1` every page address serves
  the next client whatever the cookie says, `apps/web`'s thread links redirect into it, and
  `apps/web`'s page, files, pages («Endringslogg», «Om prosjektet») and API (`/api/v2/*`) are
  not served; `/api/health` stays. `POST /api/next/ui` refuses `classic`, and `/api/next/me`
  carries `nextOnly: true`, so the page's profile menu has none of `apps/web`'s pages and no
  «Tilbake til gammel versjon». It needs `KA_NEXT`, and is warned about and ignored without it,
  as `KA_NEXT_MODEL` is; without the next client's build the server does not start. Unset, as
  on KA's own site, nothing changes.

## Consequences

- One deployment draws one layout for one service. Another assistant is a second container app
  with its own `KA_NEXT_MODEL`, its own genki `Client` and its own Ansattporten client
  (`deploy/README.md`, «Another assistant from the builder»).
- A changed layout is a new revision, and so a new sign-in for everyone on that host, as every
  rollout is. Test and prod of the service share the layout.
- Without `KA_NEXT_ONLY` the host's choices stay KA's: the menu links to `apps/web`'s
  «Endringslogg» and «Om prosjektet», and `apps/web` is what a browser gets first. With it, as
  on another service's deployment, neither. Either way KA's trials win over a layout's own
  `experiments`.
- When genki stores layouts, the server reads the service's layout from genki instead, and
  `KA_NEXT_LAYOUT` goes.
