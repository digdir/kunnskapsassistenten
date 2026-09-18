# 0003 — Chat over `/api/mcp`, not `/v1/chat/completions`

**Status:** accepted · **Date:** 2026-09-11

## Context

**The BFF must speak `/api/mcp`.** `/v1/chat/completions` looks like the easier
path and is the wrong one here, for two reasons found in the source rather than
the docs:

- **`/v1` streaming is not incremental.** `openai_compat.clj:15-18`:
  _"the MVP sends the assistant content as one delta chunk after the role
  intro."_ A `stream: true` call returns a role frame and then the entire
  answer in a single delta. That is precisely the shape `check-streaming.mjs`
  exists to detect — except it is upstream, so no amount of care in the BFF
  fixes it.
- **`/v1` does not persist conversations.** `openai_compat.clj:142` notes it
  runs _"without the conversation-persistence"_ that the MCP path does. No
  `conversation_id` comes back, nothing appears in `/api/conversations`, and
  multi-turn means resending the whole history every time.

`/api/mcp` with `_meta.progressToken` gives all three things this app needs:

| Need                             | MCP provides                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Incremental answer text          | `notifications/progress` frames with `_meta.event: "response/chunk"` carrying a `delta`                                    |
| Stage labels for `ResponseState` | the same frames with agent event names — `agent/iteration-started`, and the rest of the vocabulary in `skills/events.cljc` |
| Multi-turn + sidebar             | `structuredContent.conversation_id` on the final frame                                                                     |

**Set expectations on granularity.** `response/chunk` is emitted by a
_paragraph-or-250ms chunker_ in the agent loop (`skills/builtin/agent/loop.clj:90,119`), not
per token. Text arrives in paragraph-sized pieces. `mcp/streaming.clj` says
per-token deltas land "when the agent loop's `call-llm` gains a streaming
branch", but that comment is out of date: the branch exists (`stream-call!`,
`skills/builtin/agent/loop.clj:88-107`) and pipes per-token deltas _through_
the chunker. Coalescing is a deliberate choice, not a missing feature, so do
not plan on finer granularity arriving for free.

`/v1` still earns its place for **discovery**: `GET /v1/models` is the simplest
way to enumerate the `(agent, mode)` pairs the key can reach, and it returns
`_default: true` on the agent's default mode.

## Decision

`apps/server/src/mcp.ts` speaks `/api/mcp` with `_meta.progressToken`, and
hand-rolls the JSON-RPC rather than taking an MCP SDK — the surface used is one
method, and writing it out keeps the contract visible.

`/v1/models` is still used, for discovery only.

## Consequences

The server has to collapse MCP progress frames into the small event union in
`packages/contract`, so the SPA never sees JSON-RPC. That mapping is the one
piece of real translation in the codebase, and it is covered by tests in
`apps/server/src/mcp.test.ts`.
