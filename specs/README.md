# Specs — Spec-Driven Development (SDD)

This project is built **spec-first**: the intent is written and reviewed *before* the
code, and the spec stays the source of truth. SDD answers *what* and *why*; TDD proves
*it works*. The two interlock — acceptance criteria in a spec become failing tests.

Governing principles live in [`../.specify/constitution.md`](../.specify/constitution.md).
The architecture record that produced this backlog is [`../PLAN.md`](../PLAN.md).

## Layout

```
.specify/
  constitution.md          # project principles (written once, amended on purpose)
specs/
  README.md                # this file — the workflow
  _template/               # copy this to start a feature
    spec.md                # WHAT + WHY + acceptance criteria
    plan.md                # HOW — technical approach, affected files
    tasks.md               # the work, as a TDD checklist
  NNN-feature-name/        # one folder per feature (000-, 001-, ...)
```

## Workflow

1. **Specify** — copy `_template/` to `specs/NNN-feature-name/` and fill `spec.md`.
   Behavior and acceptance criteria; **no implementation detail yet**.
2. **Clarify** — resolve every open question before planning. Run the `grilling` skill —
   it interviews you one question at a time, folds the answers into `spec.md`, and moves
   it to `clarified`.
3. **Plan** — fill `plan.md`: approach, files touched, data/contract impact, test strategy.
4. **Tasks** — fill `tasks.md`: ordered checklist, each item paired with its test.
5. **Implement (TDD)** — for each task: failing test (red) → implement (green) → refactor.
6. **Verify** — all quality gates pass and every acceptance criterion maps to a passing test.

```
spec.md ──clarify──> plan.md ──> tasks.md ──TDD──> code + tests ──> gates green
  WHAT/WHY            HOW          WORK             red→green→refactor
```

## Numbering & status

- Folders are zero-padded, sequential: `000-`, `001-`, …
- Each `spec.md` carries a status: `draft → clarified → planned → in-progress → done`.
- Specs are an **append-only decision record** (like ADRs/RFCs): kept permanently, never
  renumbered or deleted. When a decision is replaced, write a new spec and mark the old
  one `superseded` with a link. The current *state* of the system lives in the docs
  (e.g. `docs/architecture.md`), not here.

## Index

Legend: ✅ done · 🔧 in-progress · 📋 planned · 🔍 clarified · ✏️ draft · ⛔ blocked

| # | Feature | Phase | Status |
|---|---|---|---|
| 000 | [Project scaffold — inherit the agentic-coding-template](000-project-scaffold/spec.md) | 0 | ✅ done |
| 001 | [Harness contract — `HarnessAdapter` + `AgentEvent` + conformance suite](001-harness-contract/spec.md) | 1 | ✅ done |
| 002 | [Prompt-agent harness — agent as code + the client-side tools](002-prompt-agent-harness/spec.md) | 1 | ✅ done |
| 003 | [BFF — streaming chat and the function-call round trip](003-bff-streaming/spec.md) | 1 | ✅ done |
| 004 | [Frontend shell — three panes, streaming, and the two kinds of tool](004-frontend-shell/spec.md) | 1 | ✅ done |
| 005 | [Real spans, from Application Insights](005-traces/spec.md) | 2 | ✅ done |
| 006 | [Voice mode — Voice Live attached to the same prompt agent](006-voice-mode/spec.md) | 3 | ✅ done |
| 007 | [The voice conversation lands in the chat](007-voice-transcript-in-chat/spec.md) | 3 | ✅ done |
| 008 | [Spoken answers in the text chat](008-spoken-answers/spec.md) | 3 | ✅ done |
| 009 | [Tool payloads move to the trace panel](009-tool-detail-in-trace/spec.md) | 3 | ✅ done |
| 010 | [The trace panel groups its calls, and opens one in a reader](010-log-reader/spec.md) | 3 | ✅ done |
| 011 | [The turn says what is happening right now](011-live-status/spec.md) | 3 | ✅ done |
| 012 | [The voice session is configured — voice, turn detection, input audio](012-voice-session-config/spec.md) | 3 | ✅ done |
| 013 | [The agent can search the live web](013-web-search-tool/spec.md) | 3 | ✅ done |
| 014 | [The trace panel becomes an instrument](014-trace-panel/spec.md) | 3 | ✅ done |
| 015 | [The turn shows its steps when the model shows no reasoning](015-steps-narration/spec.md) | 3 | ✅ done |
| 016 | [The agent speaks while it works — and sounds better doing it](016-speaks-while-it-works/spec.md) | 3 | ✅ done |

The design provenance for 004 — the Dataside design system and the `Foundry Live Agent.dc.html`
screen, read on 2026-09-04 — is recorded in [`../docs/design-system.md`](../docs/design-system.md),
along with nine points where the mock disagrees with what we are building.

## 005: what the spike found

Spec 014 delivered the part of 005's Phase 2 deliverable that needed no second data source — the
drawer, the identifiers, the usage and cost figures. What 005 still owns is the span tree.

**Unblocked 2026-09-16.** Application Insights is now connected to the Foundry project and tracing
verified end to end: runs fired through the BFF, spans read back, and the four open questions
answered against the live service rather than from the docs. The answers are folded into
`005-traces/spec.md`; the recording is
`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`.

The spike changed the spec. A client-side function tool leaves **no** `execute_tool` span — Foundry
traces what Foundry runs — so the span tree is a picture of §8 and the panel has to say so. One turn
with a function-call round trip is **two** traces, not one. And the join from a turn to its spans is
`gen_ai.response.id`, which the `trace_ids` event already carries, so nothing needs deriving.

One precondition remains and it only affects gateway correlation: the APIM instance has no
diagnostic settings, so `ApiManagementGatewayLogs` reach no workspace.

## Execution order ≠ numbering

Spec numbers are an append-only record and are **never** renumbered. Execution order is a separate,
changeable decision. Current order, chosen because **seeing Voice Live work is the stated priority**:

```
000 ✅ → 001 ✅ → 003 ✅ → 004 ✅ → 002 ✅ → 006 ✅ → 007…014 ✅ → 005 ✅
```

Voice was meant to come before the text UI, on the grounds that it needs only the agent plus a
control channel. It did not: spec 002 sat blocked on Azure access for eleven days, so 003 and 004
were built first against inferred event shapes, and 002 finished last — on **2026-09-15**, against a
different Foundry project than the one it was blocked on.

That order left a mark worth recording. Building the normaliser before the recording meant shipping
inferences, three of which the real stream contradicted; 002's closing pass corrected them. The
lesson is the constitution's §10, learned the expensive way rather than the cheap one.

Phase 4 (LangGraph hosted agent, Foundry IQ, extra MCP tools, M365 Copilot publishing) is
deliberately **not** specced — it ships as extension points and docs stubs. See `PLAN.md` §6.

## How SDD + TDD show up together

The acceptance criteria in `spec.md` are the bridge: each one is a testable statement,
and each becomes a test. A finished feature can point from every criterion to the test
that proves it.

The clearest payoff here is **spec 001**: the `HarnessAdapter` contract tests are written once,
parameterised over adapters, and replay recorded fixtures. When the LangGraph harness is built
later, it proves itself against that same suite **without editing it**.
