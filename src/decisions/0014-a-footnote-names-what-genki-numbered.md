# 0014: A footnote names what genki numbered, never a chunk's place

**Status:** accepted · **Date:** 2026-11-12

## Context

Issue 235: footnotes in answers pointed at the wrong excerpt. The BFF and the
client gave `[n]` the n-th chunk of the MCP result, an assumption from
headless-rag that headless-rag never promised (digdir/digdir-headless-rag#36).

genki numbers differently. Its agent loop cites by document by default
(`citeBy: document`): the model reads one numbered block per document, so
`[n]` is the n-th document, and the result lists the chunks grouped by
document in that order (`numberByDocument` and `sourcesFirst` in
`packages/strategy-agent-loop`). Measured on genki-test, 12 November 2026:
in an answer about Nkom 2020–2023, `[2]` under a 2022 sentence led to an
excerpt from the 2020 report; in a kept thread, 9 of 16 footnotes led to
another year's report. A service that cites by excerpt (`citeBy: excerpt`,
digdir/genki#273) also sends `structuredContent.markers`, which names the
chunk behind each `[n]`. No service on genki-test does that yet.

## Decision

**One rule, `citeAnswer` in `apps/web/src/api/excerptCitations.ts`, for every
path an answer comes by:** live or read back, through the BFF or straight
from genki.

- **With markers,** each `[n]` is the excerpt its marker names, renumbered
  1, 2, 3 in the order the answer first cites them, and only cited excerpts
  are shown, as live mode already did.
- **Without markers,** `[n]` is document n, counted in the order documents
  first appear among the chunks. The document gets the number: «Kilde 2» on
  its card, «Kilde 2: <title>» as the footnote's name, and the footnote opens
  the document. Its excerpts get no number of their own and are named by
  their place in the document, «Utdrag 2 av 4».

The BFF passes genki's order and markers on as they came (`Source.markers`),
and no source carries a number by position.

## Why

The answer does not say which excerpt a sentence rests on when the service
cites by document, so any excerpt a footnote named would be a guess. Naming
the document is what the answer actually says, and it is never the wrong
report. When genki says which excerpt, the client uses it.

## Consequences

- An answer from a service that cites by document shows document numbers,
  not excerpt numbers. When the service switches to `citeBy: excerpt`, the
  same client shows excerpt numbers with no change here.
- The BFF's memory of the last answer's sources keeps the markers, and live
  mode's store in the browser kept them already, so a reload gives the same
  footnotes as the live answer.
- genki's conversation store keeps no markers yet (genki ADR 0052, not
  built), so a turn read back from it alone is read by document. That is
  right today. Once a service cites by excerpt, such a turn (another device,
  or after the BFF restarts) needs genki to store the markers.
