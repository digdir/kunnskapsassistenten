# 0014: Testers get genki's test environment, chosen per person in the BFF

**Status:** accepted · **Date:** 2026-11-12

## Context

Most changes to Kunnskapsassistenten are changes to the genki service `kunnskapsassistenten`:
instructions, model, search settings and data. A publish in genki reached everyone at once
(issue #237). genki now gives a service named environments, each a pointer to a published
version (genki ADR 0004, amended 2026-11-11): every service has `prod`, an owner may add `test`,
and once `test` exists a publish moves `test` and leaves `prod` until it is promoted. A call
picks its environment with the header `GenAI-Environment` on MCP, REST, the OpenAI-compatible
API and A2A. Without the header it runs `prod`.

Once a person is signed in, the BFF makes its calls to genki for them through one function,
`backendHeaders` in `backend.ts`: MCP from `apps/web`, conversations, feedback, models with the
person's token, and the proxy for `apps/web-next`.

## Decision

**The BFF sends `GenAI-Environment` for testers and nothing for anyone else.**
`backendHeaders` adds `GenAI-Environment: <KA_TEST_ENVIRONMENT>` (default `test`) when the
caller's user id is in `KA_TESTERS`. Everyone else sends no header and gets genki's `prod`. With
`KA_TESTERS` empty or unset the BFF sends exactly what it sent before. The browser cannot choose:
a `GenAI-Environment` it sends is not passed on.

**A tester is named by the session's user id**, the id `/api/v2/me` gives as `userId`: with
Ansattporten `ansattporten:<sub>`, where `sub` is Ansattporten's subject for KA's client and is
the same at every sign-in; with Entra ID the account id. Not the email address, which an Entra
ID login through Ansattporten may not carry and which can change. Not a group: the BFF reads no
group claim from the token, and none has been measured in KA's tokens. `KA_TESTERS` is a short
list separated by commas or spaces. `KA_TEST_ENVIRONMENT` must be a genki environment name; a
wrong one stops the server when there are testers and is ignored with a warning when there are
none.

**The tester sees it.** `/api/v2/me` says `environment` for a tester only, and `apps/web` then
shows the tag «Testmiljø» beside the send button.

## Consequences

- Before a tester is added, the service needs a `test` environment in genki. Without it genki
  refuses the tester's questions (`409 environment_not_found`); a key or client bound to
  environments must also allow `test` (`403 environment_not_authorized`).
- Promoting and rolling back happen in genki, with no rollout of the app. Changing who is a
  tester is a change of `KA_TESTERS`, which takes a new revision; with Ansattporten that signs
  everyone out, as every rollout does.
- A user id with Ansattporten belongs to KA's Ansattporten client: a new client id gives
  everyone new ids, and `KA_TESTERS` must be written again.
- The tag says which environment the person's questions go to now, not which one answered an
  earlier question; genki's `genai-environment` response header is not passed on.
  `apps/web-next` sends the header for testers through the same proxy, but draws no tag yet.
- A testers' group from Ansattporten or Entra ID can replace the list later, read in the same
  place, once a token is measured to carry one.
