# Plan: Real spans, from Application Insights

> The HOW for [`spec.md`](spec.md), written after two clarify passes against the live service.
> Scope of *this* pass: everything that needs no new Azure ingestion. Gateway correlation is
> explicitly out — see AC7″.

## Approach

One query, one endpoint, one fetch. The BFF already owns every Azure call in this app and the
browser holds no credential; traces are no different.

**The join is `gen_ai.response.id`.** The frontend already has the `response_id` from the
`trace_ids` event, so the panel asks for a trace *by response id* and the BFF does the rest:

```
GET /trace/{response_id}
  → dependencies | where customDimensions["gen_ai.response.id"] == <id>
  → operation_Id  (the otel trace id)
  → all spans of that operation, with durations, parents and gen_ai.* attributes
```

**Why one round trip and not two.** The obvious shape is "find the trace id, then fetch the trace",
which is two queries and two ingestion races. A single KQL that resolves the trace id in a `let` and
selects every span of that operation returns the whole thing at once, so the answer is internally
consistent — no run where the id is found and the spans are not.

**Unconfigured is a builder returning `None`**, exactly as `build_synthesizer` and `build_connect`
already do. `app.state.read_trace` is `None` when `APPLICATIONINSIGHTS_RESOURCE_ID` is unset, the
router turns that into `{"status": "unavailable"}`, and nothing else in the app notices (AC19). This
is the pattern the BFF already uses twice; a third copy of it is not a new idea.

**Why a resource id and not the connection string.** `LogsQueryClient.query_resource` addresses an
ARM resource; the connection string carries an `ApplicationId`, which is a different identifier for
a different API. The resource id is one more variable, and deriving it is not possible — so it is a
documented setting, and its absence is the *unavailable* case rather than an error.

**Ingestion is a race, so `pending` is a status, not an error.** A turn whose spans have not landed
returns `{"status": "pending"}` and the panel offers a retry (AC3, AC15). The frontend does not poll
on its own: a panel that polls is a panel that keeps querying a workspace for every open trace.

**Alternatives considered.** Streaming the trace as part of `/chat`: rejected — ingestion is slower
than the turn, so it would be empty every time, which is the whole reason this is a second call.
Caching traces in the BFF: rejected — it is state Foundry owns, and a reload is cheap.

## Affected files

**Backend**

- `backend/app/settings.py` — `appinsights_resource_id`; `tracing_enabled` property.
- `backend/app/traces.py` — **new.** The KQL, the row→span mapping, and `build_trace_reader`
  returning `None` when unconfigured. All Azure contact lives here.
- `backend/app/routers/traces.py` — **new.** `GET /trace/{response_id}`.
- `backend/app/routers/config.py` — a `tracing` block, in the shape `speech` and `voice` already use.
- `backend/app/main.py` — wire `app.state.read_trace`, register the router.
- `backend/pyproject.toml` — `azure-monitor-query>=2.0.0` (cited in `docs/REFERENCES.md`).

**Frontend**

- `frontend/src/types/trace.ts` — **new.** The response shape.
- `frontend/src/hooks/useTrace.ts` — **new.** Fetch on open, expose `status`, `retry`.
- `frontend/src/components/SpanTree.tsx` — **new.** The waterfall, plus the line that says Foundry
  traces only what Foundry runs (AC13).
- `frontend/src/components/TraceNumbers.tsx` — cached tokens, model snapshot, agent version.
- `frontend/src/components/ToolRow.tsx` — accept a duration resolved from a span (AC17).
- `frontend/src/panes/TraceDrawer.tsx` — the otel id becomes real; the gateway line replaces the
  `gateway request id` field; the spans section replaces the footer note.
- `frontend/src/i18n/strings.ts` — the strings below.
- `frontend/src/styles/app.css` — the waterfall and the gateway line.

**Docs** — `.env.example`, `docs/how-it-works/tracing-and-gateway.md`, `CHANGELOG.md`.

## Contract / data model changes (constitution §4)

No `AgentEvent` change: `contract.py` is untouched and §9 is not engaged. `otel_trace_id` and
`gateway_request_id` stay in the contract, still unpopulated by any harness — the trace id now
reaches the panel from `GET /trace`, not from the stream, which is what O-B settled.

`GET /trace/{response_id}` is a new public surface of this app. `GET /config` gains
`tracing: {enabled, gateway_logged}` — `gateway_logged` is always `false` in this pass and exists so
the panel's gateway line is driven by config rather than hardcoded.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `trace.spansTitle` *(exists)* | `Spans` | `Spans` |
| `trace.spansPending` | `Spans have not arrived yet.` | `Os spans ainda não chegaram.` |
| `trace.spansRetry` | `Check again` | `Verificar de novo` |
| `trace.spansUnavailable` | `Tracing is not configured on this deployment.` | `O tracing não está configurado neste ambiente.` |
| `trace.spansDenied` | `No permission to read the workspace. Log Analytics Reader is required.` | `Sem permissão para ler o workspace. É necessário Log Analytics Reader.` |
| `trace.spansFailed` | `The trace query failed.` | `A consulta do rastro falhou.` |
| `trace.clientSideNote` | `Foundry traces what Foundry runs. Tools this app executes leave no span.` | `O Foundry rastreia o que o Foundry executa. Ferramentas que este app executa não deixam span.` |
| `trace.gatewayTitle` | `gateway` | `gateway` |
| `trace.gatewayCarried` | `This run went through the gateway, which does not record requests. Enabling GatewayLogs would correlate them.` | `Esta execução passou pelo gateway, que não registra requisições. Habilitar GatewayLogs permitiria correlacioná-las.` |
| `trace.gatewayNone` | `This run did not go through a gateway.` | `Esta execução não passou por um gateway.` |
| `meta.cachedTokens` | `cached` | `cache` |
| `meta.agentVersion` | `version` | `versão` |

`trace.gatewayTitle` joins `INTENTIONALLY_IDENTICAL`. **`trace.otelTraceId`, `trace.gatewayRequestId`
and `trace.pendingTracing` are removed** — the first becomes a real id, and the other two describe a
field this pass deletes.

## Test strategy (constitution §2 — TDD)

Backend tests inject a fake query client, the way `stream_factory` and `synthesize` are already
injected — no credential, no network, and the identical code path.

| AC | Test | File |
|---|---|---|
| AC1 | rows → spans with name, parent, offset, duration | `backend/tests/test_traces.py` |
| AC2, AC14 | spans of one turn's two response ids come back as one tree | `backend/tests/test_traces.py`, `frontend/src/components/SpanTree.test.tsx` |
| AC3, AC15 | no rows → `pending`, distinct from error; panel offers retry | `backend/tests/test_traces.py`, `frontend/src/hooks/useTrace.test.ts` |
| AC4, AC19 | unset resource id → `unavailable`; rest of the app unaffected | `backend/tests/test_traces.py`, `backend/tests/test_config.py` |
| AC5 | a permission failure names the role | `backend/tests/test_traces.py` |
| AC6′ | the otel trace id comes from `operation_Id` and renders as a copyable id | `backend/tests/test_traces.py`, `frontend/src/panes/TraceDrawer.test.tsx` |
| AC7″ | the gateway line states, and no `gateway request id` field is rendered | `frontend/src/panes/TraceDrawer.test.tsx` |
| AC13 | the client-side note renders with the tree | `frontend/src/components/SpanTree.test.tsx` |
| AC16 | cached tokens shown when present, omitted when absent | `frontend/src/components/TraceNumbers.test.tsx` |
| AC17 | an MCP row takes its duration from the span | `frontend/src/components/ToolRow.test.tsx` |
| AC18 | model snapshot and agent version render | `frontend/src/components/TraceNumbers.test.tsx` |
| AC9 | no credential or resource id reaches the browser | `backend/tests/test_config.py` |
| AC10 | en + pt | `frontend/src/i18n/strings.test.ts` (generic) |
| AC11 | gates | `verify-gates` |

**The fixture is the recording**, `ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`,
which already holds the three cases: a function-tool turn, its second leg, and an MCP turn with
`execute_tool` spans. Nothing is hand-written to make a test pass (§5).

## Risks / trade-offs

- **The recorded fixture lives in `ai/` and the reader lives in `backend/`.** Reading across layers
  is ugly; copying it would be two sources of one truth (§4). The backend test loads it by path,
  with a comment saying why — the recording is about Foundry, which is `ai/`'s subject.
- **`query_resource` needs an ARM resource id, which is a new variable to get wrong.** Mitigated by
  the unavailable path being a first-class answer rather than a crash.
- **Two response ids per turn means the panel must ask twice, or the BFF must accept both.** The
  endpoint takes one id and the panel holds both; asking twice is simpler than a batch endpoint and
  the second call is usually a cache-warm repeat of the first workspace round trip.
- **Cost.** Querying Log Analytics is billed per query, tiny but not zero, and the panel queries on
  open. Accepted: it is one query per trace a human chose to look at, and no polling.
- **Span attributes are Foundry's, not ours.** If `gen_ai.usage.cached_tokens` stops appearing, the
  cached figure disappears with it — which AC16 makes the correct behaviour rather than a bug.
