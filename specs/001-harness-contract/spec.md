# Spec: Harness contract — `HarnessAdapter` + `AgentEvent`

| | |
|---|---|
| **ID** | 001-harness-contract |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-04 |

## Problem / motivation

The repository's claim is that **the agent harness is swappable**: the same frontend, BFF, traces and
voice work whether Foundry runs the agent loop (prompt agent) or our container does (hosted agent
running LangGraph). That claim is only credible if there is a real boundary, and if a second harness
can be proven to satisfy it **without editing the tests that prove it**.

So the contract comes first — before the harness, before the BFF, before the UI. Everything
downstream consumes it, and building it last would mean discovering its shape by accident.

There is a second, blunter reason. A function call that Foundry emits and nobody answers leaves the
run hanging until it expires after ten minutes. That failure is silent from the UI's point of view —
the stream just stops. An invariant that says *every tool call is answered or the stream reports an
error* turns a silent hang into a failing test.

## Goals

- One typed, closed event vocabulary that every harness emits and every consumer reads.
- A `HarnessAdapter` Protocol narrow enough that a second implementation is obvious to write.
- A **conformance suite** — invariants about stream *behavior*, parameterised over adapters, that a
  future LangGraph harness runs against unchanged.
- Ordinary Python: no pydantic, no framework. The contract is data plus a few rules.

## Non-goals

- **No Foundry calls.** No SDK, no network, no credentials. This spec is pure contract and can be
  verified on a plane.
- No SSE encoding (spec 003), no adapter implementation (spec 002), no UI types (spec 004).
- No versioning/negotiation of the event set. One version, changed by spec (§9).

## User-facing behavior

Indirect. The contract decides what the Agent activity panel can show: reasoning summaries as they
stream, each tool call with its arguments and its result, MCP calls attributed to their server, token
usage, and the response id the trace drawer needs. If it isn't in the event set, the UI cannot show it.

## Acceptance criteria

1. **AC1** — `AgentEvent` is a **closed** discriminated union of exactly nine `type` values:
   `reasoning_summary · text_delta · tool_call · tool_result · mcp_call · usage · trace_ids · error ·
   done`. Validating an object with any other `type` raises `ContractError`.
2. **AC2** — Validation rejects an event that is missing a required field, and rejects an event
   carrying an unknown field. Both raise `ContractError` naming the offending field.
3. **AC3** — Validation rejects a field of the wrong type (e.g. `usage.input_tokens` as a string).
4. **AC4** — **A stream ends in exactly one terminal event** — `done` or `error`, never both, never
   neither — and nothing follows it. Violations raise `ConformanceError`.
5. **AC5** — **Every tool call the app is responsible for executing is answered.** For each
   `tool_call` with `executor: "app"`, a `tool_result` with the same `call_id` must appear before the
   terminal event — *unless* the stream terminates with `error`. This is the invariant that turns a
   silent ten-minute hang into a test failure.
6. **AC6** — A `call_id` never appears on two `tool_call` events in one stream.
7. **AC7** — `usage` appears at most once, and before the terminal event.
8. **AC8** — A stream ending in `done` carries at least one `trace_ids` event with a non-empty
   `response_id` before it, so the trace drawer always has something to query. A stream ending in
   `error` is exempt.
9. **AC9** — `HarnessAdapter` is a runtime-checkable `Protocol` with `stream_response`,
   `submit_tool_output` and `voice_attachment_params`. An object missing any of them fails
   `isinstance`.
10. **AC10** — The conformance suite is **adapter-agnostic**: it takes any `HarnessAdapter`, drives
    it, and asserts AC4–AC8 against what it emits. Adding a harness means registering it, not editing
    the suite.
11. **AC11** — `ai/` gates are green: `ruff check .` and `pytest -q`.

## Contract / data impact

This spec **creates** the cross-cutting contract named in constitution §9. From here on:

- `ai/harness/_shared/contract.py` is its single source of truth.
- Consumers that must move with it: every adapter, `backend/app/sse.py`, `backend/app/tool_executor.py`,
  the frontend's event types, `docs/how-it-works/streaming-events.md`, and the recorded fixtures.
- Changing the event set requires its own spec (§9). This is the file that makes that rule bite.

## Open questions (clarify before planning)

- [x] Do events need a monotonic sequence number? → **No.** The transport (SSE over one HTTP
      response, or one WebSocket) already preserves order. Adding `seq` would invent a problem to
      solve. Revisit only if the BFF ever multiplexes streams.
- [x] Should `tool_call` distinguish who executes it? → **Yes** — `executor: "app" | "foundry"`. It is
      the difference between a call we must answer and one Foundry answers itself, and AC5 depends on
      it. It is also the clearest single expression of constitution §8 in the type system.
- [x] Should `arguments` be parsed JSON or the raw string? → **Raw string.** Foundry emits a JSON
      string, and it arrives in fragments while streaming. Parsing at the boundary would force the
      contract to decide what a half-arrived argument means. Consumers parse when complete.
- [x] Can we record real fixtures in this spec? → **No, and we will not fake them.** See the test
      strategy in `plan.md`: real recordings land in spec 002 when there is a live agent to record.
      The synthetic sequences here test *the checker*, and are never presented as Foundry recordings.
- [x] Does the BYOM gateway question (O-8/O-9) block this spec? → **No.** The contract is transport-
      and gateway-agnostic by design. That is a point in its favour, not a coincidence.

## Out of scope / deferred

- Recorded fixtures from a live agent → spec 002.
- Mapping Foundry's concrete stream event names onto this vocabulary → spec 002, once O-1 is
  answered by observation rather than guessing.
