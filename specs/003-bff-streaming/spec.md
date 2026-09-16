# Spec: The BFF — streaming chat and the function-call round trip

| | |
|---|---|
| **ID** | 003-bff-streaming |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-04 |

## Problem / motivation

Specs 001 and 002 produced a contract and an agent. Nothing connects them to a browser yet.

This spec builds the Backend For Frontend: it opens a Responses stream against the Foundry agent,
normalises what comes back into `AgentEvent`s, re-emits them as Server-Sent Events, and — the part
that matters — **executes the function tools Foundry asks for and returns their output**.

That last job is the one with teeth. Foundry emits a `function_call` and then waits. If the BFF does
not answer, the run hangs until it expires ten minutes later, and from the browser it looks like the
stream simply stopped. Every design decision below is downstream of making that impossible.

The BFF is also where constitution §8 is easiest to break. Executing a tool and choosing a tool are
one refactor apart, and only one of them is allowed here.

## Goals

- `POST /chat` streams a conversation as SSE, one `AgentEvent` per frame.
- Function calls are executed and answered, always — including when the tool itself fails.
- A stream that starts always ends, in `done` or `error`, never in silence.
- `GET /config` tells the frontend what it is talking to, including whether the gateway is in the path.
- The Foundry-specific parts sit in the harness, not in the router: swapping `AGENT_HARNESS` changes
  the adapter and nothing else.

## Non-goals

- No trace lookup (spec 005), no voice (spec 006), no UI (spec 004).
- No auth on the BFF itself. It is a local reference app; adding a half-real auth layer would be
  worse than none (§5). The README says so.
- No persistence. Conversations live in Foundry; the BFF holds nothing between requests.

## User-facing behavior

A browser POSTs a message and receives a stream of typed events it can render as they arrive:
reasoning as it is summarised, each tool call with its arguments and then its result, the answer
token by token, and finally usage and a response id.

Two tools behave visibly differently and the events say which is which: `microsoft_learn` runs
**inside Foundry** (`mcp_call`), while `get_current_datetime` and `lookup_knowledge` run **here**
(`tool_call` with `executor: "app"`, then `tool_result`).

## Acceptance criteria

1. **AC1** — `POST /chat` responds with `Content-Type: text/event-stream` and streams one JSON
   `AgentEvent` per SSE frame, with the SSE `event:` field carrying the event `type`.
2. **AC2** — Every frame the endpoint emits validates against the spec 001 contract, and the whole
   stream satisfies `check_stream`.
3. **AC3** — When the agent emits a function call, the BFF resolves the name **through the registry**,
   executes it, emits `tool_call` then `tool_result`, and submits the output back to the agent.
4. **AC4** — A tool that raises produces a `tool_result` carrying the error and the run continues.
   **An exception never leaves a call unanswered** — the invariant that prevents a ten-minute hang.
5. **AC5** — A function call naming a tool the registry does not have produces a `tool_result` with
   an error, submitted back to the agent, not an unhandled exception.
6. **AC6** — If the harness raises mid-stream, the endpoint emits a terminal `error` event and closes.
   The client never sees a stream that just stops.
7. **AC7** — **The BFF never selects a tool.** No module under `backend/app/` branches on a tool name
   or contains a tool list. Enforced by a test (§8).
8. **AC8** — `GET /config` returns the harness name, agent name, model, whether the model routes
   through the gateway, and the contract's event types.
9. **AC9** — `GET /health` returns 200 without touching Azure.
10. **AC10** — A conversation id supplied by the client is passed through, so a follow-up question
    keeps context; when absent, a new conversation is created.
11. **AC11** — `AGENT_HARNESS=langgraph` fails at startup with the scaffold's explanatory message,
    not an obscure error later.
12. **AC12** — `backend/` gates green: `ruff check`, `ruff format --check`, `pytest -q`.

## Contract / data impact

Consumes the §9 contract; does not change it. The SSE encoder is a **transport** for `AgentEvent`,
not a second schema — if the two ever disagree, the contract wins.

`docs/how-it-works/function-call-round-trip.md` and `streaming-events.md` are written from this
spec's code plus the spike's observations.

## Open questions (clarify before planning)

- [x] **The raw Foundry event names for text and function calls are still unobserved.** The spike
      reached `response.mcp_list_tools.completed` and then died on a gateway 404 caused by the
      reference environment (no model deployment, and a Base URL one segment short). The normaliser
      is therefore written as a **declarative mapping table** with each entry marked verified or
      unverified, and a test asserts that every mapped name appears in a recorded fixture once one
      exists. Nothing is silently guessed (§10).
      → **Resolved 2026-09-15** by spec 002's closing pass, and this checkbox simply outlived it:
      the 310-event recording exists, `tests/test_recorded_turn.py` replays it through the
      normaliser, and `unmapped_types` asserts nothing arrived that the table does not know. Three
      of the inferred names were wrong and were corrected against the recording — the episode that
      `specs/README.md` calls "§10 learned the expensive way". Two later recordings (2026-09-16,
      spec 016) still add no unmapped type.
- [x] SSE or WebSocket? → **SSE.** Confirmed with the user. `EventSource` is GET-only, so the client
      uses `fetch` + `ReadableStream`; WebSocket is reserved for the Voice Live control channel.
- [x] Who owns the tool-execution loop, the router or the adapter? → **The router.** The adapter's
      job is to speak Foundry; running local Python is the app's job, and keeping it out of the
      adapter is what lets the LangGraph harness reuse it unchanged.
- [x] Should `/chat` accept a full message history? → **No.** Foundry owns conversation state. Taking
      history from the client would duplicate state the platform already holds (§8).

## Out of scope / deferred

- Rate limiting, auth, CORS hardening — a local reference app; documented, not implemented.
- Retry on transient Foundry errors → after the real failure modes are observed.
