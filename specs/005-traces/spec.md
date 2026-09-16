# Spec: Real spans, from Application Insights

| | |
|---|---|
| **ID** | 005-traces |
| **Status** | blocked (see the precondition below) |
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

## Blocking precondition — verified against the live subscription, 2026-09-16

**This spec cannot be implemented until an Application Insights resource is connected to the Foundry
project.** Checked directly rather than assumed:

```
az resource list --resource-type "Microsoft.Insights/components"
  → six components exist in the subscription, all belonging to other projects (belake*)

az rest … /accounts/ai-admin2354ai223634534338/connections
  → AIServices · RemoteTool · CustomKeys · CognitiveSearch · ApiManagement
  → no connection of category AppInsights
```

`.env` carries no `APPLICATIONINSIGHTS_CONNECTION_STRING` (the key exists in `.env.example`, unset),
`infra/` contains no Bicep, and no telemetry SDK is a dependency of `backend/` or `ai/`.

So the work below is **planned but not startable**, and this is recorded here rather than discovered
at task 3. Provisioning costs money on the owner's subscription and is their call, not this spec's.
What it needs is listed under *Contract / data impact*.

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

## Open questions (clarify before planning)

- [ ] **O-A — Which SDK, and does it belong in `backend/` or `ai/`?** Querying Log Analytics is not
      a harness concern — it is not part of running an agent — which argues for `backend/`. To be
      settled with the package and version read from a doc, never from memory (§10).
- [ ] **O-B — How does a Responses run's id relate to its OpenTelemetry trace id?** AC6 assumes the
      harness can obtain the trace id for the run it just streamed. Whether that arrives on the
      response object, must be derived, or must be correlated by time and conversation id decides
      how much of this spec is possible at all. **Verify against the live service first**, as spec
      002 did with O-8.
- [ ] **O-C — Does a BYOM run through APIM even produce a correlatable gateway record?**
      `REFERENCES.md` already warns the gateway does not log tool traces. If the answer is no, AC7
      shrinks to "say that the gateway does not record this".
- [ ] **O-D — What is an acceptable wait?** Ingestion latency into Application Insights is typically
      tens of seconds. If it is routinely longer than a reader will wait, the retry in AC3 is the
      feature and the live tree is the bonus.

## Out of scope / deferred

- Tracing the BFF's own spans, and any distributed trace that spans both processes.
- Voice Live session tracing.
- Cost in currency.
- Any span-based alerting, aggregation across turns, or historical comparison.
