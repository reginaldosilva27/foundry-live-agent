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

