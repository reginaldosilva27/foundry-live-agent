# Spec: Real spans, from Application Insights

| | |
|---|---|
| **ID** | 005-traces |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

This is the last spec of Phase 2 and the one the repo has been writing IOUs against since spec 004.
Four places already promise it:

- `docs/how-it-works/tracing-and-gateway.md` is a stub marked *"filled by spec 005"*.
- The trace panel lists `otel trace id` and `gateway request id` as *arrives with the tracing spec*.
- The panel's footer says spans come from Application Insights, which this spec adds.
- `PLAN.md` still reads *"specs 000–004 and 006 done; 005 (traces) remains."*

Spec 014 delivered the half of Phase 2's deliverable that needed no new data — the drawer, the usage
and cost figures, the identifiers. What is left is the half that needs a second source: the app
currently knows only what the **response stream** told it, which is one turn's worth of events with
no timing structure inside them. It cannot say how long Foundry spent planning before the first tool
call, how much of a 70-second turn was the MCP server, or whether the gateway saw the request at all.
Foundry already records all of that as OpenTelemetry spans. Nothing reads them.

**The gap is not a missing widget. It is that the app's timing story stops at the process boundary**,
and this project exists to show what happens on the other side of it.

## Goals

- The trace panel shows the **real span tree** for a turn — names, parents, start offsets and
  durations — read from Application Insights, not inferred.
- The two reserved identifiers stop being reserved: the harness emits `otel_trace_id`, and the panel
  renders it as an ordinary copyable id.
- A turn that went through the AI Gateway can be **correlated with the gateway's own record** of it.
- Every failure of the above is legible: tracing not configured, no permission, span not yet
  ingested, and query failed are four different messages, never an empty panel (§5).
- The app still works, completely, with no Application Insights at all. Tracing is additive.

## Non-goals

- **No change to the `AgentEvent` set beyond populating two fields that already exist.**
  `otel_trace_id` and `gateway_request_id` are already in `contract.py` (§9); this spec fills them.
  Any *new* event type would need its own spec.
- No cost estimation in currency. Tokens are a measurement; a price is a pricing-sheet lookup that
  goes stale silently.
- No log search UI, no KQL box, no arbitrary querying. One turn's spans, fetched by trace id.
- No tracing of the **BFF's own** work as spans. The BFF is not what this project teaches.
- No Voice Live tracing — Voice Live never passes through the gateway and its session is not a
  Responses run. It stays out until its own spec.

## Precondition — Application Insights

**Lifted 2026-09-16.** Application Insights
`ai-admin2354ai223634534-project-appinsights-2442` is now connected to the Foundry project as a
connection of category `AppInsights`, and `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Verified
end to end: two runs were fired through the BFF and their spans read back out of the workspace.
What they contained is recorded in `docs/REFERENCES.md` and in
`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl` (§5, §10).

**One precondition remains, and it only affects AC7.** `apim-foundry-belake` has **zero diagnostic
settings**, so no `ApiManagementGatewayLogs` reach any workspace. Gateway correlation needs that
enabled — a separate provisioning step from the one just done.

## Clarified decisions (2026-09-16)

- **The BFF queries, never the browser.** Log Analytics is queried with the BFF's managed identity;
  the browser holds no credential of any kind, which is the rule the whole project runs on. A new
  endpoint serves one turn's spans by trace id.
- **Spans are fetched on demand, not streamed.** Ingestion into Application Insights is not
  instantaneous, so a span tree cannot be part of the turn's own event stream — it would be empty
  every time. The panel asks for it when a reader opens the trace, and says so while it waits.
- **"Not yet ingested" is a first-class answer, not an error.** A turn whose trace is queried two
  seconds after it finished will legitimately return nothing. That is a distinct state with its own
  message and a way to retry.
- **Gateway correlation is best-effort and says when it is absent.** The gateway is APIM, its record
  lives in `ApiManagementGatewayLogs`, and §10 notes the gateway does not log tool traces. When the
  turn did not route through a gateway — which `GET /config` already reports — the panel says that
  instead of showing an empty row.
- **The waterfall gets a real axis, and only then.** Spec 014's duration bars are deliberately
  axis-less because the events carry no clock. Real spans carry start offsets, so this spec's chart
  is a genuine waterfall and the 014 bars are replaced by it when spans are available — and remain
  the fallback when they are not.

## User-facing behavior

The trace panel's footer line — *"Spans come from Application Insights, which the tracing spec
adds"* — becomes a section.

When a reader opens a turn's trace, the panel requests its spans. While that is in flight it says
so. Then one of five things renders, each distinguishable:

1. **The span tree.** Nested rows, one per span, with the span name, its duration, and a bar placed
   on a shared time axis that starts at the run's first span. `invoke_agent`, `plan` and
   `execute_tool` are the names Foundry emits.
2. **Not ingested yet**, with a retry.
3. **Tracing is not configured on this deployment** — the honest state for anyone running the repo
   without an Application Insights, which is the default.
4. **No permission to read them**, naming the role required.
5. **The query failed**, with the reason.

The gateway row appears beside the identifiers: the gateway request id when the turn routed through
one and the record was found, or a line saying the run did not use a gateway.

All new prose ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given a turn whose `otel_trace_id` is known, when the panel requests its spans, then
   the BFF returns the run's spans with name, parent, start offset and duration for each.
2. **AC2** — Given those spans, when the panel renders them, then each span's bar is positioned on a
   shared axis by its start offset and sized by its duration, and nesting reflects the parent links.
3. **AC3** — Given a trace id that returns no rows, when the panel renders, then it reports *not yet
   ingested* — distinct from an error — and offers a retry.
4. **AC4** — Given a BFF with no Application Insights configured, when the panel requests spans,
   then it reports that tracing is not configured, and **every other part of the app is unaffected**.
5. **AC5** — Given a query rejected for want of permission, when the panel renders, then it names
   the role required rather than reporting a generic failure.
6. **AC6** — Given a run, when the harness emits `trace_ids`, then `otel_trace_id` carries the
   OpenTelemetry trace id of that run, and the panel renders it as an ordinary copyable id — the
   *pending* treatment from spec 014 disappears on its own, with no change to `CopyRow`.
7. **AC7** — Given a turn that routed through the AI Gateway, when its trace is read, then the
   gateway's own record is correlated and its request id shown; and given a turn that did not, the
   panel says so rather than showing an empty field.
8. **AC8** — Given spans are available for a turn, when the panel renders its activity, then the
   spec 014 duration bars are replaced by the real waterfall; and given spans are not available,
   the 014 bars remain.
9. **AC9** — Every query the BFF makes is authenticated with `DefaultAzureCredential`; no key, token
   or connection string reaches the browser.
10. **AC10** — Every new string exists in `en` and `pt` (§7).
11. **AC11** — `backend/`, `ai/` and `frontend/` gates green.
12. **AC12** — Every API surface used — SDK package and version, query shape, table names, span
    attribute names, RBAC role — is cited in `docs/REFERENCES.md` from a doc read while writing this,
    or recorded as a fixture from a real query (§10, §5).

## Contract / data impact

`otel_trace_id` and `gateway_request_id` already exist in `ai/harness/_shared/contract.py` and in the
frontend's `Turn`; this spec **populates** them and adds no event type, so §9 is not engaged.

A new BFF endpoint is a public contract of this app and is the spec's main surface. `GET /config`
gains a flag for whether tracing is available, in the shape it already uses for `speech` and `voice`.

**What must exist before implementation starts** (the blocking precondition above):

| Needed | Why |
|---|---|
| An Application Insights resource | Where Foundry writes spans |
| Connected to the Foundry project | Tracing is enabled per project, not per request |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` in `.env` | Already a documented key, currently unset |
| Log Analytics Reader for the BFF identity | Cited in `REFERENCES.md`: tracing "requires Log Analytics reader" |
| APIM diagnostics to App Insights, for AC7 | `REFERENCES.md` records this as the gateway-correlation path |

Because `infra/` has no Bicep and the AI Gateway has no documented IaC path, provisioning is a
documented manual step, not shipped as unverified IaC (§5).

## Open questions — answered 2026-09-16

*(All four answered against the live service on 2026-09-16 — the spike this spec was waiting on.)*

- **O-A — which SDK, and where?** Settled by the query path itself: the spans live in Application
  Insights and are read with a Log Analytics query. It belongs in `backend/`, not `ai/`: reading
  telemetry is not part of running an agent, and a harness that queried a workspace would be doing
  something no other harness must also do. The exact package and version get read from a doc and
  cited in `REFERENCES.md` at plan time (§10) — deliberately not guessed here.

- **O-B — how does a Responses run's id relate to its OTel trace id? → By attribute, not derivation.**
  Every span carries `customDimensions["gen_ai.response.id"]` holding the exact `resp_…` our
  `trace_ids` event already emits. The lookup is therefore: filter `dependencies` by that attribute,
  read `operation_Id`, then fetch that trace. **This is what unblocks the spec**, and it changes AC6:
  the harness does not need to *learn* the trace id at stream time — the BFF can resolve it later
  from the `response_id` it already has. AC6 is restated below.

- **O-C — does a BYOM run through APIM produce a correlatable gateway record? → Not today.** The
  APIM instance has no diagnostic settings at all, so there is nothing to correlate with. AC7 shrinks
  accordingly (restated below).

- **O-D — what is an acceptable wait? → Ingestion is staggered, so the retry is the feature.** First
  spans of a run were queryable in under 30 s; the *other* leg of the same turn was not yet present
  then and appeared later. A trace must be treated as possibly *incomplete*, which is a third state
  beyond present/absent.

### Findings that change the design

1. **A client-side function tool produces no `execute_tool` span.** `get_current_datetime`, which
   the BFF runs, leaves `invoke_agent` + `chat` and nothing else; the Learn MCP server leaves an
   `execute_tool` span per call. **The span tree is a picture of §8** — it shows what Foundry ran and
   is silent about what we ran. The panel must say that, or a reader will read the gap as data loss.
2. **One turn with a function-call round trip is two OTel traces**, one per leg, each with its own
   `gen_ai.response.id`. The panel shows one turn, so it must fetch and stitch *both*.
3. **`gen_ai.tool.call.arguments` and `.result` are absent** although the docs list them. Whatever
   the panel shows for a tool's payload keeps coming from the event stream, not from spans.
4. **The readable tree is rooted at `invoke_agent`** — its `operation_ParentId` names a span outside
   the store.

### Restated acceptance criteria

- **AC6′** — Given a turn's `response_id`, when the BFF resolves its trace, then it finds the spans
  by `gen_ai.response.id` and returns `operation_Id` as the turn's `otel_trace_id`, which the panel
  renders as an ordinary copyable id. The harness is unchanged; no `trace_ids` field is populated at
  stream time.
- **AC7′** — Given the gateway has no diagnostic settings, when the panel renders, then it says
  gateway correlation is not configured and names what enabling it requires — rather than showing an
  empty field or a failure.
- **AC13** — Given a turn whose tools ran client-side, when its span tree renders, then the panel
  states that Foundry traces only what Foundry executes, so that the absence of `execute_tool` spans
  reads as the architecture rather than as missing data (§5).
- **AC14** — Given a turn that produced two traces, when the panel renders, then both are fetched
  and presented as one turn.
- **AC15** — Given a trace whose spans are still arriving, when the panel renders, then it reports
  the tree as possibly incomplete and offers a retry, distinctly from *not ingested* and from *done*.

## Out of scope / deferred

- Tracing the BFF's own spans, and any distributed trace that spans both processes.
- Voice Live session tracing.
- Cost in currency.
- Any span-based alerting, aggregation across turns, or historical comparison.

## Second clarify pass — 2026-09-16, after the gateway was inspected

**The gateway is already carrying the traffic, and will not be logged.** The project's
`ApiManagement` connection and the `<connection>/<model>` deployment name mean agent inference
already routes through `apim-foundry-belake`; `GET /config` reports `uses_gateway: true` off that.
APIM is emitting at 100 % sampling into no destination, and the owner has decided **not** to add a
diagnostic setting, because it bills Log Analytics ingestion for a field.

That is a decision, not a gap, so the panel states it rather than showing an absence:

- **AC7″ replaces AC7′.** Given a run that routed through the gateway, the panel names the gateway
  and says it does not record requests, and what enabling that would require. Given a run that did
  not route through one, it says that instead. **No `gateway request id` field is rendered at all**
  — there is no id, and a labelled empty box claims there could be one.

**The spans already ingested carry more than the span tree**, and none of it costs anything new.
Measured on this project's own runs:

| Attribute | What the app shows today |
|---|---|
| `gen_ai.usage.cached_tokens` | **nothing** — yet one run read 10 812 of 16 380 prompt tokens from cache (66 %), another 2 620 of 3 145 (83 %) |
| `execute_tool` span duration | **nothing** — the panel says an MCP call "carries no duration", because the *event stream* has none. The span has `106.2 ms`. |
| `gen_ai.response.model` | `gpt-5.5` — the span says `gpt-5.5-2026-04-24`, the deployed snapshot |
| `gen_ai.agent.version` | nothing — the span says `3` |

So this pass widens the spec's goal from "draw the span tree" to **"show what the run actually cost
and did"**, which is the same query and the same round trip.

### Acceptance criteria added by this pass

- **AC16** — Given a turn's spans, when the panel renders them, then prompt-cache tokens are shown
  alongside input and output tokens whenever the spans report them, and omitted when they do not.
- **AC17** — Given an MCP call whose `execute_tool` span was found, when the panel renders that
  call, then it shows the span's duration in place of "carries no duration".
- **AC18** — Given a turn's spans, when the panel renders the run, then it shows the model snapshot
  and agent version the spans report, which may be more specific than `GET /config`'s.
- **AC19** — Given the BFF has no Application Insights resource configured, when the panel asks for
  a trace, then it answers *unavailable* and **the app is otherwise unaffected** — no error, no
  empty section, no failed request in the console.
