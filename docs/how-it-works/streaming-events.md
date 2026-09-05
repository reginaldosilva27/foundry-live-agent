# Streaming events

A Foundry Responses stream becomes the nine-event `AgentEvent` vocabulary, which becomes SSE frames,
which become UI. Three hops, one schema.

```
Foundry raw stream ──normalise()──> AgentEvent ──format_event()──> SSE frame ──> React
                    (ai/harness/prompt_agent/events.py)   (backend/app/sse.py)
```

## Why SSE and not WebSocket

The browser needs one-way streaming from a **POST**, and `EventSource` is GET-only. So the client
reads the response body with `fetch` + `ReadableStream`. WebSocket is reserved for the Voice Live
control channel, which genuinely is bidirectional.

One framing detail: SSE splits records on a blank line, so a payload containing one would break the
stream. Each event is encoded as **single-line JSON**, which sidesteps it — a newline inside a string
becomes an escape and never reaches the wire as a newline.

Every event is validated against the contract *before* framing. The browser cannot receive something
the frontend's types do not cover; a mismatch fails loudly in the backend instead of silently as a
blank card.

## The mapping — and what is still unverified

Constitution §10 forbids writing a Foundry integration from memory. Some raw event names below have
been **observed** coming out of Foundry; the rest are inferred from documented payload shapes and
have not yet been seen on the wire. The difference is tracked in code, not hidden.

| Raw Foundry event | Becomes | Status |
|---|---|---|
| `response.created` · `response.in_progress` · `response.output_item.added` | *(ignored)* | **observed 2026-09-04** |
| `response.mcp_list_tools.in_progress` · `.completed` | *(ignored — setup, not a call)* | **observed 2026-09-04** |
| `response.output_text.delta` | `text_delta` | inferred |
| `response.reasoning_summary_text.delta` | `reasoning_summary` | inferred |
| `response.output_item.done` (a `function_call` item) | `tool_call` | inferred |
| `response.mcp_call.completed` · `.failed` | `mcp_call` | inferred |
| `response.completed` | `usage` + `trace_ids` + `done` | inferred |
| `response.failed` · `response.incomplete` · `error` | `error` | inferred |

`GET /config` reports the split live:

```json
"event_mapping": { "total": 16, "verified": 5, "unverified": ["response.output_text.delta", …] }
```

Surfacing it in the API rather than a code comment is the point — a reader sees the gap without
reading the source. A test asserts nothing is marked verified unless it is in the observed set, so
the flags cannot drift into optimism.

**Why the gap exists:** the spike on 2026-09-04 reached `response.mcp_list_tools.completed` and then
died on a gateway 404 — the reference environment has no model deployment and the BYOM connection's
Base URL stops one segment short. Finish that run and the flags move. See
[REFERENCES.md](../REFERENCES.md).

## Unknown events are counted, not dropped

`unmapped_types()` counts raw event types the normaliser does not know. An event Foundry starts
sending that we ignore is exactly the kind of thing that should be visible rather than invisible.

## What a turn looks like on the wire

```
event: reasoning_summary
data: {"type":"reasoning_summary","text":"The user asked for the time."}

event: tool_call
data: {"type":"tool_call","call_id":"call_1","name":"get_current_datetime","arguments":"{…}","executor":"app"}

event: tool_result
data: {"type":"tool_result","call_id":"call_1","name":"get_current_datetime","output":"{…}","duration_ms":3}

event: text_delta
data: {"type":"text_delta","text":"It is 17:00 in São Paulo."}

event: usage
data: {"type":"usage","input_tokens":312,"output_tokens":28}

event: trace_ids
data: {"type":"trace_ids","response_id":"resp_1"}

event: done
data: {"type":"done","response_id":"resp_1"}
```

The stream always ends in `done` or `error`. Never silence — that is
[`check_stream`](../../ai/harness/_shared/README.md)'s first invariant, and the router enforces it a
second time at the transport layer.
