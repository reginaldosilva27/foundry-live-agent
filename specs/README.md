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
| 017 | [A spoken answer does not read URLs out loud](017-no-urls-out-loud/spec.md) | 3 | ✅ done |
| 018 | [The second harness — a LangGraph graph running as a Foundry hosted agent](018-hosted-agent-harness/spec.md) | 4 | ✅ done |
| 019 | [The agents screen — pick which Foundry agent answers](019-agent-picker/spec.md) | 4 | ✅ done |
| 020 | [Side by side — one question, two agents, two streams](020-side-by-side/spec.md) | 4 | ✅ done |
| 021 | [The shell, elaborated — navigation, an agents screen, answer actions, local history](021-ui-shell/spec.md) | 4 | ✅ done |
| 022 | [Favourite agents — the two you actually use, in the rail](022-agent-favourites/spec.md) | 4 | ✅ done |
| 023 | [The composer, and stopping a turn](023-composer-and-stop/spec.md) | 4 | ✅ done |
| 024 | [Addressable — the app gets URLs](024-addressable/spec.md) | 4 | ✅ done |
| 025 | [The keyboard — shortcuts and a command palette](025-keyboard/spec.md) | 4 | ✅ done |
| 026 | [Asking again — repeat and edit a question](026-ask-again/spec.md) | 4 | ✅ done |
| 027 | [History you can search, and take with you](027-history-search-export/spec.md) | 4 | ✅ done |
| 028 | [What a turn cost](028-turn-cost/spec.md) | 4 | ✅ done |
| 029 | [The shape of a turn — a measured timeline](029-turn-timeline/spec.md) | 4 | ✅ done |
| 030 | [The agent, inspected](030-agent-inspector/spec.md) | 4 | ✅ done |
| 031 | [Versions, and going back to one](031-agent-versions/spec.md) | 4 | ✅ done |
| 032 | [What this build is talking to](032-connection-panel/spec.md) | 4 | ✅ done |
| 033 | [Charts and diagrams in an answer](033-charts-in-answers/spec.md) | 4 | ✅ done |
| 034 | [Where an answer came from](034-answer-sources/spec.md) | 4 | ✅ done |
| 035 | [Tables and code you can take](035-tables-and-code/spec.md) | 4 | ✅ done |
| 036 | [Preferences, and a second theme](036-preferences-and-theme/spec.md) | 4 | ✅ done |
| 037 | [Suggestions that belong to the agent](037-agent-suggestions/spec.md) | 4 | ✅ done |
| 038 | [The event inspector](038-event-inspector/spec.md) | 4 | ✅ done |
| 039 | [What the voice session is doing, while it does it](039-voice-activity/spec.md) | 4 | ✅ done |
| 040 | [The keyboard and screen-reader pass](040-accessibility-pass/spec.md) | 4 | ✅ done |
| 041 | [Proposing a change to the agent](041-propose-agent-change/spec.md) | 4 | ✅ done |
| 042 | [The tool playground](042-tool-playground/spec.md) | 4 | ✅ done |
| 043 | [Choosing the voice on the screen](043-voice-on-screen/spec.md) | 4 | ✅ done |
| 044 | [Images in an answer](044-images-in-answers/spec.md) | 4 | ✅ done |
| 045 | [Attachments on a question](045-attachments/spec.md) | 4 | ⛔ blocked |
| 046 | [The contrast nobody guarded — the muted ink and the accent fill](046-muted-ink-and-accent-fill/spec.md) | 4 | ✅ done |
| 047 | [The app on a narrow screen](047-narrow-screen/spec.md) | 4 | ✅ done |
| 048 | [A focus ring by default, not by remembering](048-focus-by-default/spec.md) | 4 | ✅ done |
| 049 | [Foundry IQ as a knowledge source](049-foundry-iq-knowledge/spec.md) | 4 | 📐 planned |
| 050 | [Demo mode — the whole app, with no Azure credential](050-demo-mode/spec.md) | 4 | ✅ done |
| 051 | [Replay isolation](051-replay-isolation/spec.md) | 4 | ✅ done |

`*` — Spec 020's AC16, the measured run against the live service, was **met on 2026-09-20**; the
numbers are in [`../docs/harness-comparison.md`](../docs/harness-comparison.md). Spec 045 is
**blocked** by design — since
2026-09-20 no longer on a document (that one is read and recorded) but on two decisions: which of
the four documented file-input shapes to offer, and what the deployment retains. The second is the
operator's, not this repository's.

> The status column is the spec's own `Status` field, transcribed. It drifted once — 027–045 sat at
> `draft` here for a week after being built — so when the two disagree, the spec wins (§4).

Specs 023–045 were the **UI backlog** written on 2026-09-16 from a review of `frontend/`. They were
`draft` on purpose: each carried its WHAT, its acceptance criteria and its open questions, and none
had a `plan.md` — planning happens after the clarify step, per the workflow above. They are
ordered by number, not by priority; the priority argument lives with the review that produced them.

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
000 ✅ → 001 ✅ → 003 ✅ → 004 ✅ → 002 ✅ → 006 ✅ → 007…014 ✅ → 005 ✅ → 015…017 ✅
  → 018 ✅ → 019 ✅ → 021 ✅ → 022 ✅ → 023…044 ✅ → 045 ⛔ → 020 ✅ → 046…048 ✅ → 049 📐
```

**020 came last, and was the better order.** Built after the UI backlog rather than before it, it
inherited an activity panel already living inside each turn (021), a per-turn `agent` on `POST
/chat` (019), an executor tag on every tool row (018) and a cost line that already says what a
hosted turn's figure leaves out (028) — so the screen is a composition of parts that existed, and
the backend diff for it is empty. Built in numeric order it would have had to invent most of those.

018 → 019 → 020 is a dependency chain, not a preference: 019's picker has nothing to pick between
until 018 exists, and 020 cannot run two agents at once while exactly one of them is a startup
constant.

**021 jumps ahead of 020** for the same kind of reason: side by side needs a shell that can hold two
streams, name who is in each, and keep the comparison afterwards. Building that inside a
single-view shell means building it twice.

Voice was meant to come before the text UI, on the grounds that it needs only the agent plus a
control channel. It did not: spec 002 sat blocked on Azure access for eleven days, so 003 and 004
were built first against inferred event shapes, and 002 finished last — on **2026-09-15**, against a
different Foundry project than the one it was blocked on.

That order left a mark worth recording. Building the normaliser before the recording meant shipping
inferences, three of which the real stream contradicted; 002's closing pass corrected them. The
lesson is the constitution's §10, learned the expensive way rather than the cheap one.

Phase 4 was planned as extension points and docs stubs only (`PLAN.md` §6). **Reopened 2026-09-16**:
specs 018–020 take the LangGraph hosted agent out of the stub and build it, with the surfaces that
make it worth building — an agents screen and a side-by-side comparison. The rest of Phase 4
(Foundry IQ, extra MCP tools, M365 Copilot publishing) stays unspecced.

## How SDD + TDD show up together

The acceptance criteria in `spec.md` are the bridge: each one is a testable statement,
and each becomes a test. A finished feature can point from every criterion to the test
that proves it.

The clearest payoff here is **spec 001**: the `HarnessAdapter` contract tests are written once,
parameterised over adapters, and replay recorded fixtures. When the LangGraph harness is built
later, it proves itself against that same suite **without editing it**.
