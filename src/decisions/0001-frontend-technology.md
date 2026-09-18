# 0001 — Frontend technology for the fellesløsning track

**Status:** accepted · **Date:** 2026-09-15

## Context

Two tracks are building a Kunnskapsassistent frontend against
`digdir-headless-rag`:

- **KA product track** — `larsekhansen/kunnskapsassistenten-frontend`, created
  2026-09-11: Vite + React + TypeScript + Designsystemet 1.21.0, destined for
  the digdir org.
- **This track** — a port of the archived `digdir-rag` UX onto the new backend,
  run out of the lab, with the fellesløsning as its primary interest and KA as
  overlap.

The question is not "React or not". It is **where the technology-independence
boundary belongs**, and what this track should learn that the other one will
not.

## Research findings

### React is not declining

HTTP Archive, share of crawled mobile origins — deployed reality, not survey
sentiment:

|         | 2024   | 2025    | 2026        |
| ------- | ------ | ------- | ----------- |
| React   | 9.44 % | 13.18 % | **14.73 %** |
| Next.js | 1.69 % | 2.62 %  | **4.30 %**  |
| Svelte  | 0.32 % | 0.81 %  | **1.07 %**  |

React grew **+46 % in absolute origins** over two years and gained share while
the crawl shrank. State of JS usage 82.5 % → 84.8 %. jQuery (71.5 % → 64.7 %)
and Qwik are the ones declining. Any argument premised on React dying is
factually wrong and should not be used.

### Technology independence is Norwegian policy, and it is priced

The samfunnsøkonomiske analyse (Agenda Kaupang for Digdir, autumn 2025) names
`teknologiuavhengighet` as a component of the recommended concept. §5.1.1
reports React binding as an adoption barrier found _in interviews_:

> "særlig for virksomheter som ikke benytter rammeverket React … er det
> tidkrevende å endre teknologien"

NPV 2 264–3 154 MNOK depending on concept, with the efficiency assumption
rising from 20 % to 25 % _because_ the system is technology-independent.

Digdir shipped `@digdir/designsystemet-web` on 2026-02-23 and the setup guide
now reads: _"Vi anbefaler at du starter med `@digdir/designsystemet-web` og
`@digdir/designsystemet-css`."_ HTML tab first, React second.

Maintainer intent, Michael Marszalek, 2026-06-24 (issue #5001):

> "Vi har erfart at vi egentlig gjør for mye i React komponentene og vurdere å
> forenkle de … vi ønsker heller å dokumentere hvordan brukere kan best løse
> diverse use-caser med bruk av eksisterende web-standarder"

### The technical objections to web components do not apply here

- **Designsystemet's custom elements are light DOM.** Verified in the built
  package: `attachShadow` appears only in vendored polyfills. `<ds-field>` is a
  `MutationObserver` that wires `for` / `id` / `aria-describedby` onto markup
  already present. This sidesteps cross-root ARIA, declarative-shadow-DOM SSR
  and form participation — the problems that stalled Canada (Stencil) and
  USWDS.
- **React 19 scores 100 %** (16/16 basic, 16/16 advanced) on
  custom-elements-everywhere. Interop is no longer an argument in either
  direction.
- `-web` contains **no Lit and no Stencil** — `@u-elements/*` plus floating-ui,
  292 KB of plain JS.

### Coding agents give no framework a decisive advantage

- **WebCompass** (Apr 2026, frontier models): _"Across all four models,
  framework-free code consistently yields the highest scores in Generation and
  Editing."_ Vue — the second-largest training corpus — scores lowest. Corpus
  size does not predict quality.
- **DesignBench**: vanilla wins edit (9.15) and repair (7.18); React and Vue
  interleave; Angular is the only cliff.
- **Web-Bench** shows React 65 vs Svelte 25 — but on a _non-reasoning_ model.
  With reasoning: 60 vs 55.
- Agents almost never decompose into components in **any** framework (0.24 %
  React, 5 % Vue, 19 % Angular), so review burden tracks change structure, not
  template syntax.
- No benchmark covers Lit or custom elements. `lit.dev/llms.txt` 404s — but so
  does `designsystemet.no/llms.txt`, so we write that context file regardless.

### Framework-agnostic only works if the core team owns the wrappers

| Model                                                       | Outcome                                                                                                                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core owns the wrappers — Canada, Arbetsförmedlingen, Digdir | Works. Canada ships four packages, same version, same day.                                                                                                            |
| Core owns nothing — GOV.UK, USWDS, Denmark, EU              | Ports rot. **23 % of USWDS consumption flows through a React port USWDS does not maintain.** GOV.UK's React ports are 2–8 years stale while ~25 departments used one. |

What actually kills shared design systems is **staffing**: Australia's federal
system was decommissioned in 2021 by defunding; Google Material Web went to
maintenance mode by reassignment; USWDS Elements is a one-person team by its
own README.

The counter-case to respect is **Mercari**, who migrated _off_ Lit _to_ React
because web components "are not widely used" internally, so the core got no
contributions and few bug reports.

## Decision

**Build this track on `@digdir/designsystemet-web` + `-css`, with
**Preact + `@preact/signals`** as the composition layer.** A bounded lab
experiment, not a product commitment.

`@digdir/designsystemet-web` ships first-party JSX typings for **React, Preact,
Solid, Svelte, Vue and Qwik** — verified in `dist/index.d.ts`. Picking one of
the six is using the package as designed, not going off-piste.

### Why, given React is healthy and familiar

1. **Duplicate stacks produce duplicate knowledge.** The KA product track is
   already React + Designsystemet. If this track does the same, the lab learns
   one thing instead of two.
2. **The fellesløsning premise is untested for app-shaped workloads.** Digdir
   recommends `-web` first and the state's CBA prices the benefit, but the
   published precedent is forms and content pages. Nobody has shown it holds
   for a streaming agentic chat with live panels and incremental rendering.
   That is the hard case, and it is exactly ours.
3. **The boundary belongs in the shared layer.** Every consuming tjeneste
   picking its own framework is fine _if_ the component layer is neutral. This
   track tests the neutral layer; Lars's track tests a consumer of it.
4. **The risk is bounded.** The BFF, MCP client and contract — ~580 lines, the
   genuinely hard part — are framework-agnostic and unaffected. Only the
   ~550-line SPA is in scope.
5. **A negative result is still a deliverable.** If `-web` cannot carry this
   workload, that is a finding Digdir needs, because their NPV argument assumes
   it can.

### Why Preact over the alternatives

Plain TypeScript was considered and rejected: hand-rolling DOM reconciliation
for a streaming thread is where the bugs live, and it would likely trip this
ADR's own 2x-line-count kill criterion.

|                       | Origins 2026 | DS JSX types | Verdict                                                                                                            |
| --------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Preact + signals**  | 4.31 %       | yes          | **chosen** — 3 KB, React-compatible API, signals suit streaming                                                    |
| Lit                   | 5.25 %       | no (HTML)    | strong alternative; Inera (SE public sector) precedent, but slow upstream triage and zero agent benchmark coverage |
| Solid                 | unmeasurable | yes          | best signals, smallest community                                                                                   |
| Svelte                | 1.07 %       | yes          | healthy, but compiler churn and less reviewer familiarity                                                          |
| Vue                   | 6.96 %       | yes          | Oslo Punkt, FKUI precedent; no advantage here                                                                      |
| Alpine / Astro / htmx | —            | no           | poor fit for an app-shaped streaming SPA                                                                           |

Preact wins on four counts that matter for a lab experiment: it is not the KA
product track's stack, so the lab learns two things; its API is React's, so
review speed and agent training-data transfer both hold; signals give
fine-grained updates for text arriving in paragraph chunks without VDOM churn;
and the fallback to React is close to a rename.

Correction to an earlier draft of this document: Lit is **not** marginal in
deployment terms. HTTP Archive puts `lit-element` at 5.25 % of origins
(467,316 sites), ahead of Svelte, Next.js and Angular.

## Consequences

- Slower than continuing in React, with less precedent to copy.
- We write our own composition layer for the chat thread, sources panel and
  filters.
- We own the answer to a question the fellesløsning depends on.
- If it fails, we fall back to React and the fallback is cheap — the BFF does
  not move.

## Kill criteria

Abandon and revert to React if any of these hold after the streaming chat and
sources panel are built:

- The hand-written composition layer exceeds roughly twice the React version's
  line count for equivalent behaviour.
- Universell utforming regresses against the React build — keyboard, focus
  order, screen-reader announcement of streamed content.
- Streaming rendering cannot keep up, or flickers, without a framework's
  reconciliation.
- Agent-assisted iteration is measurably slower in review, by our own
  judgement after two weeks.

## What would change the decision

- Digdir deprecating or freezing `-react` — strengthens it.
- Anyone actually consuming our UI components — forces web components.
- A React Server Components requirement — all 152 files in `-react` carry
  `'use client'`, so `-react` is already blocked there.
- Evidence that agents handle `-web` badly in practice. Nobody has measured it;
  we would be the measurement.

## Sources

HTTP Archive Tech Report API · Chrome Platform Status · State of JS 2025 ·
custom-elements-everywhere.com · `designsystemet.no/no/intro/cba/` ·
`designsystemet.no/no/fundamentals/code/setup` ·
`designsystemet.no/en/blog/web-components-and-designsystemet-without-react/` ·
digdir/designsystemet issues #5001, #5125, #5329 · arXiv 2604.18224
(WebCompass) · arXiv 2506.06251 (DesignBench) · arXiv 2505.07473 (Web-Bench) ·
uswds/uswds-proposals ADRs 0001, 0002, 0004, 0005 · Mercari engineering blog,
2022-12-08
