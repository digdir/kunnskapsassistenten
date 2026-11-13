# 0016: The excerpt trial asks genki for its own environment

**Status:** accepted · **Date:** 2026-11-12

## Context

A footnote leads to the exact excerpt only when the genki service cites by excerpt
(`citeBy: excerpt`, genki ADR 0052); otherwise it names the document (`decisions/0014`). Citing
by excerpt is to be tried before it reaches everyone. genki environments (genki ADR 0004) let the
service `kunnskapsassistenten` run another version beside `prod`, and the BFF already names an
environment for testers in `backendHeaders` (`decisions/0015`).

## Decision

**Citing by excerpt is a trial a signed-in person turns on, carried out by the BFF.**
`KA_EXCERPT_ENVIRONMENT` names the genki environment whose version cites by excerpt. Unset or
empty, the trial does not exist: `/api/v2/me` does not offer it and the header below is ignored.
A value that is not a genki environment name stops the server.

- **The browser says only that the trial is on.** `apps/web` lists it with the other flags as
  «Fotnoter som viser til utdraget», shown only when `/api/v2/me` says `excerptTrial: true`.
  While it is on, every call to the BFF carries `KA-Trial-Excerpt-Citations: 1`. The browser
  never names an environment, and a `GenAI-Environment` it sends is not passed on.
- **The BFF picks the environment.** After sign-in it marks the caller (`withExcerptTrial` in
  `backend.ts`), and `backendHeaders` sends `GenAI-Environment: <KA_EXCERPT_ENVIRONMENT>` on
  every call to genki it makes for that person: questions, threads, renames, deletes and
  feedback, and the models when the person's token is sent.
- **Testers win.** A tester in `KA_TESTERS` gets the testers' environment, trial or not.

## Consequences

- The environment must exist on the service before `KA_EXCERPT_ENVIRONMENT` is set, or genki
  refuses the person's questions (`409 environment_not_found`).
- Like every flag it is kept per browser, and «Logg ut» turns it off. `apps/web-next` has no switch
  for it and sends no header: its calls go through genki's vendored client.
- An answer comes from the environment the person had when asking. The client reads an answer's
  `markers` when it has them (`decisions/0014`), so a thread with answers from both reads right.
- The trial ends when the service itself cites by excerpt or the choice goes the other way:
  remove the flag, the header and `KA_EXCERPT_ENVIRONMENT`.
