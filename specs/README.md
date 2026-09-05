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
| 002 | [Prompt-agent harness — agent as code + the client-side tools](002-prompt-agent-harness/spec.md) | 1 | 🔧 in-progress |
| 003 | [BFF — streaming chat and the function-call round trip](003-bff-streaming/spec.md) | 1 | ✅ done |
| 004 | [Frontend shell — three panes, streaming, and the two kinds of tool](004-frontend-shell/spec.md) | 1 | 📋 planned |
| 005 | Trace drawer — Application Insights span tree, gateway correlation, usage/cost | 2 | ✏️ draft |
| 006 | Voice mode — Voice Live attached to the same prompt agent | 3 | ✏️ draft |

**004 is unblocked.** The Dataside design system and the `Foundry Live Agent.dc.html` screen were
read on 2026-09-04 and recorded in [`../docs/design-system.md`](../docs/design-system.md), along with
nine points where the mock disagrees with what we are building.

## Execution order ≠ numbering

Spec numbers are an append-only record and are **never** renumbered. Execution order is a separate,
changeable decision. Current order, chosen because **seeing Voice Live work is the stated priority**:

```
000 ✅ → 001 ✅ → 002 → 006 (voice) → 003 → 004 → 005
```

Voice moves ahead of the text UI because it needs only the agent (002) plus a control channel, and
it is the most convincing demo.

**Spec 002 is half done.** Everything that does not need a live Foundry project is built and green:
the two tools, the registry, `agent.yaml` and its loader, `apply_agent.py`, the LangGraph scaffold,
and `scripts/spike.py`. The second half — running the spike, recording fixtures, and writing the
event normaliser against what was observed — is blocked on `az login` reaching subscription
`7a4e9773-94ea-45a8-9b58-2701ed307318`.

Phase 4 (LangGraph hosted agent, Foundry IQ, extra MCP tools, M365 Copilot publishing) is
deliberately **not** specced — it ships as extension points and docs stubs. See `PLAN.md` §6.

## How SDD + TDD show up together

The acceptance criteria in `spec.md` are the bridge: each one is a testable statement,
and each becomes a test. A finished feature can point from every criterion to the test
that proves it.

The clearest payoff here is **spec 001**: the `HarnessAdapter` contract tests are written once,
parameterised over adapters, and replay recorded fixtures. When the LangGraph harness is built
later, it proves itself against that same suite **without editing it**.
