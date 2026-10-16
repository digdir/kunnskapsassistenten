# Reports and decision log

This is what should be readable later, by people and agents who were not there
when something was decided.

- **[`beslutningslogg.md`](beslutningslogg.md)**: one entry per decision or
  milestone, with what was chosen, why, and a link to the PR, ADR or
  measurement. Newest first.
- **Reports** as HTML, with the date first in the file name. They open
  straight in the browser and fetch nothing from outside.

Larger architecture choices are ADRs in [`src/decisions/`](../../../../decisions/).
The log points there instead of repeating them.

## The reports

| date       | report                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| 2026-10-06 | [What remains before the merge](2026-10-06-gjenstaar-foer-sammenslaaing.html)                   |
| 2026-10-07 | [Decisions, and what remains before the merge](2026-10-07-avgjoerelser-foer-sammenslaaing.html) |

The two reports are in Norwegian, as they were written before 2026-10-16.

## How the log is kept

- An entry is written when something is decided or a milestone is reached. It
  can be a PR that changes direction, a choice between alternatives, or a
  deployment that changes what the test environment runs. Small choices are in
  the code and the PR descriptions.
- Each entry has what, why and links. Numbers and times are measured, not
  estimated.
- The text is in English, neutral and without personal names, because the repo
  is public.
- The work log with times and all the small choices is kept elsewhere. What is
  here is the selection from it.
