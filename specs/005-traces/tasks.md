# Tasks: Real spans, from Application Insights

> TDD checklist for [`spec.md`](spec.md) / [`plan.md`](plan.md). Each implement task is preceded by
> the failing test that drives it.
>
> **Scope of this pass:** everything that needs no new Azure ingestion. Gateway correlation is out
> by decision (AC7″), not deferred by accident.

## Backend — the reader

- [x] **T1 — test first**: `backend/tests/test_traces.py` — recorded rows map to spans carrying
      name, span id, parent id, duration and start offset (**AC1**); the spans of one operation come
      back as one tree with `invoke_agent` at the root (**AC2**).
- [x] **T2 — implement**: `backend/app/traces.py` — the KQL, the row→span mapping, `build_trace_reader`.
- [x] **T3 — test first**: no rows → `pending`; unset resource id → `unavailable`; a permission
      failure → `denied` naming Log Analytics Reader; any other failure → `failed` with the reason
      (**AC3, AC4, AC5, AC15, AC19**).
- [x] **T4 — implement**: the four statuses, each a distinct answer and none of them an exception.
- [x] **T5 — test first**: `operation_Id` is returned as the turn's otel trace id (**AC6′**); usage,
      model snapshot and agent version are read off the spans (**AC16, AC18**).
- [x] **T6 — implement**: the summary block on the response.

## Backend — the surface

- [x] **T7 — test first**: `GET /trace/{response_id}` returns the reader's answer; `GET /config`
      reports `tracing.enabled` and never leaks the resource id or any credential (**AC9**).
- [x] **T8 — implement**: `backend/app/routers/traces.py`, the `config.py` block, the `main.py`
      wiring, and `azure-monitor-query` in `pyproject.toml`.

## Frontend — fetching

- [x] **T9 — test first**: `frontend/src/hooks/useTrace.test.ts` — fetches on open, exposes the four
      statuses, retries on demand, and does **not** poll (**AC3, AC15**).
- [x] **T10 — implement**: `useTrace.ts` and `types/trace.ts`.

## Frontend — rendering

- [x] **T11 — test first**: `SpanTree.test.tsx` — bars placed by start offset on a shared axis and
      sized by duration, nesting from parent links (**AC2**); the client-side note renders (**AC13**).
- [x] **T12 — implement**: `SpanTree.tsx` + its CSS.
- [x] **T13 — test first**: `TraceNumbers.test.tsx` — cached tokens shown when present and omitted
      when absent (**AC16**); model snapshot and agent version render (**AC18**).
- [x] **T14 — implement**: `TraceNumbers.tsx`.
- [x] **T15 — test first**: `ToolRow.test.tsx` — an MCP row given a span duration shows it instead
      of "carries no duration" (**AC17**).
- [x] **T16 — implement**: `ToolRow.tsx`, and the wiring that matches spans to activities.
- [x] **T17 — test first**: `TraceDrawer.test.tsx` — the otel trace id renders as a copyable id
      (**AC6′**); the gateway line states and **no `gateway request id` field is rendered**
      (**AC7″**); each status renders its own message (**AC3, AC4, AC5**).
- [x] **T18 — implement**: `TraceDrawer.tsx`.

## Strings, docs, close

- [x] **T19 — i18n**: add the twelve keys in `en` + `pt`; **remove** `trace.otelTraceId`,
      `trace.gatewayRequestId` and `trace.pendingTracing`, and their `INTENTIONALLY_IDENTICAL`
      entries (**AC10**).
- [x] **T20 — docs (§4)**: `.env.example` gains `APPLICATIONINSIGHTS_RESOURCE_ID` with the reason;
      `docs/how-it-works/tracing-and-gateway.md` stops being a stub; `CHANGELOG.md`; screenshot.
- [x] **T21 — verify**: `verify-gates` green (**AC11**), and a real turn read end to end against the
      live workspace — the panel showing `otel trace id 1afabe6dc716946cf73af477d1519e81`, `cached
      1084`, model `gpt-5.5-2026-04-24` v5, and a waterfall whose `chat` bar sits at the right-hand
      end of the run because the BFF's tool ran first. Screenshot in `docs/assets/`.
- [x] **T22 — refactor**: the spans section was briefly inside `trace__foot`, which carries
      `margin-top: auto` — it pushed the whole waterfall to the bottom of the column and left a
      screen-high gap under the activity list. Caught by looking at it, not by a test. Spans are now
      a section of their own and only the portal link is pinned.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] `verify-gates` green across all four layers
- [x] No `AgentEvent` change — `contract.py` untouched (§9)
- [x] Every rendered figure came from a span the run produced (§5)
- [x] All new user-facing text in `en` **and** `pt` (§7)
- [x] The browser holds no credential and never sees the resource id
- [x] No new Azure ingestion was enabled to make any of this work
- [x] `spec.md` status updated to `done`
