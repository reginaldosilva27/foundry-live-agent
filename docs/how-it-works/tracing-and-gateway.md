# Tracing and the gateway

> **Status: stub — filled by spec 005.** Written when the code exists, so that it describes
> behaviour that actually runs (constitution §5) and stays in sync with it (§4).

Where spans come from, what the APIM gateway records, and the two things neither one tells you.

Sources for everything this page will assert: [../REFERENCES.md](../REFERENCES.md) (constitution §10).

## Already established

- Foundry tracing is **GA for prompt and hosted agents**, stored in Application Insights, using the
  OpenTelemetry GenAI semantic conventions: spans `invoke_agent`, `execute_tool`, `plan`; attributes
  `gen_ai.tool.definitions`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`.
- The AI Gateway is APIM: verify traffic with `ApiManagementGatewayLogs`; over TPM → `429`, over
  quota → `403`; limits are **per project**.
- **Two different things are called "AI Gateway".** The project-level one (Manage → AI Gateway)
  governs **direct model calls** and does **not** carry Agent Service inference. Routing the *agent*
  through your own APIM is **bring your own model**: an Admin-connected model connection, after which
  the agent's model is named `<connection-name>/<model-name>`. This page must make that distinction
  its opening paragraph — it is the single most common misunderstanding about Foundry governance.
- **The gateway does not log tool traces**, and **Voice Live never passes through it.** Those two
  gaps are why the trace drawer reads Foundry spans rather than gateway logs.
- For gateway-side correlation: enable Application Insights on the APIM resource (Monitoring →
  Application Insights, 100% sampling for testing), then `requests` / `dependencies` in App Insights
  for request tracing, and `ApiManagementGatewayLogs` in Log Analytics for gateway diagnostics.

## What the panel shows today (spec 014)

The trace panel already renders the two identifiers the run produces — `response_id` and
`conversation_id` — as copyable rows, alongside the turn's tokens and latency and the calls it made.

`otel_trace_id` and `gateway_request_id` are **reserved for this spec**. They exist in the §9
contract and in the frontend's `Turn`, no harness emits them yet, and the panel lists them as
pending rather than omitting them — a field that is silently absent and one that is deliberately
pending must not look the same on screen (§5). The panel keys off presence alone, so the first
harness to emit either renders it as an ordinary copyable id with no frontend change.

The duration bars under the calls are **not spans**. Their lengths are the `duration_ms` the
`tool_result` events carried, compared against the longest call in the same turn; they are given no
time axis, no gridlines and no start offsets, because the events carry durations and not a clock.
The waterfall with a real axis is this spec's job, from Application Insights.

## What the spans actually look like (measured 2026-09-16)

Tracing is connected and producing spans. Read back from Application Insights, one turn looks like
this — and the shape carries the argument this whole project makes:

```
trace 2aa77039…                     (an MCP turn)
  invoke_agent foundry-live-agent:3            7316.5 ms
    execute_tool mcp_microsoft_learn…           106.2 ms   ← Foundry ran this
    execute_tool mcp_microsoft_learn…            96.7 ms   ← and this
    chat gpt-5.5-2026-04-24                    1422.9 ms

trace 7188bc6e…                     (a function-tool turn)
  invoke_agent foundry-live-agent:3            1063.1 ms
    chat gpt-5.5-2026-04-24                     191.9 ms
                                                          ← no execute_tool: the BFF ran the tool
```

**That missing span is the point.** Foundry traces what Foundry executes. A `get_current_datetime`
the BFF ran is invisible here, and an MCP call Foundry made is not — which is constitution §8 showing
up in telemetry rather than in prose. Anything the trace panel builds on top of this has to say so,
or the gap reads as lost data.

Two more facts that bite, both recorded in [`../REFERENCES.md`](../REFERENCES.md):

- **A turn with a function-call round trip is two traces**, one per leg, each with its own
  `gen_ai.response.id`. "One turn" is our idea, not the telemetry's.
- **The join from a turn to its spans is `gen_ai.response.id`**, which holds the exact `resp_…` the
  `trace_ids` event already carries. Nothing needs to be derived or guessed.

**Gateway correlation is still not available**: the APIM instance has no diagnostic settings, so
`ApiManagementGatewayLogs` reach no workspace. That is a separate provisioning step, and until it is
taken the trace panel says so rather than showing an empty field.

