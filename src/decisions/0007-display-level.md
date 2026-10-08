# 0007 — A display level, and a hidden menu to choose it in

**Status:** accepted · **Date:** 2026-09-30

Numbered 0007 here. It was 0004 in Norwegian in the client's own repository
(`larsekhansen/kunnskapsassistenten-frontend`, `docs/arkitektur/`).

## Context

The answer has shown everything the assistant did, to everyone. Above the card
stands the thinking panel with «Tenkte i 7 sekunder», the steps, the search
strings and the details under each step. Inside the card stands
«Fremgangsmåte» with «10 treff i 3 dokumenter» and the keywords.

Two readers want different parts of that. Issue 88 in
`digdir/kunnskapsassistenten` asks for «Fremgangsmåte» above the answer, and
simpler thinking steps without technical details. Reported 30.09: the technical
part of the answers can be useful for developers who want verbose or debug-like
feedback on what is happening right now.

Both are right for their reader, and they cannot both be right at once on the
same screen. A choice was asked for, and for it not to take up room: something
to type in the URL to bring up a settings menu, in the same kind of design,
without making too much of it.

There is one setting in the client already, dark mode, and it has no menu at
all. It is a console command, `window.ka.colorScheme.set`, because no button had
been drawn (`apps/web/src/layout/colorScheme.ts`). That is a setting for one
person who knows it exists. The display level is not: the designer and a
developer should both be able to choose, and a switch for light and dark is already
ordered as issue 85 in `digdir/kunnskapsassistenten`.

## Decision

The answer has two display levels, `standard` and `detaljert`, stored per
browser under `ka.display-level`. Standard draws one panel above the answer,
«Fremgangsmåte», after the sketch in issue 113 in `digdir/kunnskapsassistenten`:
the steps' own sentences under «Tenkte», a line, and the search words under
«Nøkkelord som ble brukt i søket». Detailed draws exactly what was shown before.
The level is chosen in a modal Designsystemet dialog that exists in the page
only while the address ends with `#innstillinger`.

The reason it is a level and not a switch per panel is that it is one decision
the reader makes once: «show me the machinery, or don't». Three switches for
three panels are three questions about the same thing.

The reason it is a menu and not a console command is that the menu should be
able to become visible later without being rebuilt. Dark mode is to go into the
same menu when issue 85 comes, and then it is the placement that changes, not
the content.

The reason the panel opens by itself above 774 px and not below is measured.
Open with four steps and five keywords it is 450 px of a 900 px window at 1440,
487 of 1024 at 768, 783 of 956 at 440 and 965 of 844 at 390. 774 is where the
column stops being a reading width between two rails and becomes the whole
window (67 + 640 + 67, the same sum as `drawerMaxViewport`). Above it, the
answer's first heading is on screen under the panel; below it, the procedure IS
the screen. The sketch drew it open, on desktop, and there it is open.

The reason for a hash and not a query:

- A hash never reaches the server, so the thin server and the BFF do not see
  it.
- It does not change the route, so React Router needs no new route and no new
  rule about what the address means.
- It does not travel with a link somebody pastes into an issue. `?innstillinger`
  would have followed a thread's address and given the next reader a dialog
  they did not ask for.

## Consequences

- **Standard says less than before.** The times, what each step measured, the
  search strings per step and «10 treff i 3 dokumenter» are gone for whoever has
  not chosen detailed. The hits count chunks, and a «chunk» is not something a
  reader has seen.
- **What made the answer verifiable stayed.** The keywords were the argument
  for «Fremgangsmåte» standing open inside the card (`RetrievalPanel`, answer
  11), and they move up with it. That is why the panel opens by itself where
  there is room: what makes an answer verifiable should not be behind a click.
- **On a phone it is behind one click anyway.** That is the price for the answer
  being the first thing on the screen where the screen is small. The name is
  there, and one tap opens it.
- **The e2e suite has to say which level it measures.** Fourteen assertions in
  `apps/web/tests/e2e/` read «Tenkte i N sekunder», «Fremgangsmåte» with hits,
  or `.ka-thinking__*`. They measure the detailed level and have to ask for it.
- **The menu is undocumented in the interface.** No button points to it, so it
  is in the README instead. That is on purpose: «Standard er standard. Uten
  adressen ser ingen at menyen finnes.» (Standard is standard. Without the
  address, nobody sees that the menu exists.)
- **The level is per browser, not per user.** The same choice as dark mode, and
  it holds as long as there is no signed-in profile to hang it on.

## What would change the decision

- **A visible settings button is drawn.** Then the button opens the same dialog,
  and the hash can stay or go. Nothing else changes.
- **The level is to apply to more surfaces than the answer.** Then
  `displayLevel.ts` moves from `apps/web/src/views/chat/` to
  `apps/web/src/layout/`, which is where shared state lives. That is one file
  and four import sites.
- **A third level comes**, for example one that shows the thinking steps but not
  the times. The radio buttons take it without changing shape; that is why they
  are radio buttons and not a switch.
- **The panel is wanted open on a phone too.** Then `ROOM_TO_STAND_OPEN` in
  `ProcedurePanel.tsx` is one line to remove, and the measurements above are
  what has to be weighed against the wish.
