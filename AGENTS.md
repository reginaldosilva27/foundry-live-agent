# AGENTS.md

This file provides guidance to **OpenAI Codex** (and any other AI coding agent that reads
`AGENTS.md`) when working in this repository.

> **Twin of [`CLAUDE.md`](CLAUDE.md) — keep them in sync.** This project has one set of
> guidelines with two front doors: `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex. They say
> the same thing on purpose. **If you change a rule in one, change it in the other in the same
> commit.** The non-negotiable source of truth above both is
> [`.specify/constitution.md`](.specify/constitution.md) — the constitution wins on any conflict.
> Codex-runnable workflows live in [`.codex/prompts/`](.codex/prompts/).

## What this is

**foundry-live-agent** — an open-source reference implementation of **Microsoft Foundry Agent
Service** end to end. A full-stack chat and voice application built *around* an agent that runs
*inside* Foundry, with **swappable agent harnesses** behind one contract. It is a runnable project
and teaching material for the Brazilian data/AI community.

The architecture record is [`PLAN.md`](PLAN.md); the law is `.specify/constitution.md`.

## How we build here — SDD + TDD (non-negotiable)

This project is **spec-first** and **test-first**, even when the user does not ask for it. Two
documents govern this:

- **`.specify/constitution.md`** — the non-negotiable principles + quality gates + amendment process.
- **`specs/README.md`** — the workflow: `specify → clarify → plan → tasks → implement (TDD) → verify`.

### New feature → write a spec first (stop and do this)
When the user asks for a new feature or a behavior change, **do not jump to code** — and **if the
user skipped it, remind them** before writing any code (the `.codex/prompts/new-spec.md` prompt
automates this):

1. Copy `specs/_template/` to `specs/NNN-feature-name/` (zero-padded, sequential).
2. Fill `spec.md` — WHAT + WHY + numbered, **testable** acceptance criteria. No implementation detail.
   Resolve every open question ("clarify", `/grilling`) before planning.
3. Fill `plan.md` — HOW: approach, affected files, contract/data/i18n impact, test strategy (AC → test).
4. Fill `tasks.md` — ordered TDD checklist; each implement task preceded by its failing test.
5. Implement red → green → refactor, checking boxes; move the spec's status along
   (`draft → clarified → planned → in-progress → done`).

### TDD always
Acceptance criteria (feature) or a reproducing case (bug) become a failing test first; then code makes
it pass; then refactor. Tests assert behavior, not implementation detail.

### Does this change need a spec?

| Change | Spec? | TDD? |
|---|---|---|
| New feature, new user-facing behavior, any public contract/schema change | **Yes** | Yes |
| **Any change to the `AgentEvent` set** (§9) | **Yes, always** | Yes |
| Bug fix · small adjustment · behavior-preserving refactor | **No** | **Yes** — regression test first |
| Docs · comments · formatting · dependency bumps · pure chores | No | n/a |

**Gray-zone rule:** when unsure, write the spec.

### Done means the gates are green
Run the `.codex/prompts/verify-gates.md` checklist before declaring anything done.

## Commands

> Keep identical to `CLAUDE.md` (§6).

```bash
# backend/ — Python (FastAPI BFF)
ruff check . && ruff format --check . && pytest -q

# ai/ — Python (harnesses, agent definitions, tools)
ruff check . && pytest -q

# frontend/ — React + TypeScript + Vite
npm run lint && npm test && npm run build

# infra/ — Bicep + azd (NOT Terraform)
az bicep build --file main.bicep && az bicep lint --file main.bicep
```

`just` recipes delegate to exactly these commands. The command set lives in the constitution's
*Quality gates*; `ci.yml`, both `verify-gates` twins and the `justfile` mirror it (§4).

## Architecture — the load-bearing ideas

> **The agent runs in Foundry. This repo is the app around it.** If you remember one thing, that.

```
Browser ──SSE──> FastAPI BFF ──Responses API──> Foundry prompt agent ──> Microsoft Learn MCP
   │                  │                              │
   │                  └── executes function tools ◄──┘  (Foundry asks; the BFF answers)
   └──WebRTC audio───────────────────────────────> Voice Live (same agent, no gateway)
```

**Layers.** `backend/` (BFF) · `ai/` (harnesses + tools) · `frontend/` (React) · `infra/` (Bicep+azd).

**The three invariants you must not break** (constitution §8–§10):

1. **§8 — no agent loop in `backend/` or `frontend/`.** They never choose *which* tool to call,
   re-prompt the model, loop on model output, or duplicate state Foundry owns. Executing a function
   tool Foundry asked for, and submitting its output, is the documented client-side contract and is
   fine. Test: *"would this still be true if the harness were swapped?"*
2. **§9 — `ai/harness/_shared/contract.py` is the boundary.** Every harness emits only
   `reasoning_summary · text_delta · tool_call · tool_result · mcp_call · usage · trace_ids · error ·
   done`; the BFF and frontend consume only those. Contract tests are parameterised over adapters, so
   a new harness proves itself against the existing suite without editing it.
3. **§10 — no Foundry API from memory.** Foundry changed substantially through 2026 and training data
   is unreliable about it. Every SDK version, endpoint, `api-version`, event name and RBAC role comes
   from a doc read at the time of writing and recorded in [`docs/REFERENCES.md`](docs/REFERENCES.md).
   Unconfirmable values are verified against the live service and recorded as fixtures, or marked as
   open questions — never guessed silently.

**Non-obvious facts that bite** (all cited in `docs/REFERENCES.md`):

- The Assistants API is gone. It's **Responses API (Agents v2)**: Conversations/Items/Responses/Agent
  Versions. SDK `azure-ai-projects>=2.3.0` (2.x, **incompatible with 1.x**), `api-version=v1`.
- **Function calling cannot live in a Toolbox** — it is client-side execution by definition.
- **A function call Foundry emits must be answered or the run hangs and expires after 10 minutes.**
- Foundry's own `agent.yaml` is **deprecated**; ours (`ai/harness/*/agent.yaml`) is our schema,
  labelled as such.
- **Voice Live never passes through the AI Gateway**, and the gateway does not log tool traces.

## Working style — behavioral guardrails

> Behavioral nudges (bias toward caution over churn), not CI-gated. The constitution (§1–§10) is
> the law above them. Mirror of CLAUDE.md (§6). _(Adapted from Andrej Karpathy's coding guidelines.)_

- **Simplicity first.** Minimum code that solves the problem — nothing speculative: no unrequested
  features, no abstraction for single-use code, no configurability nobody asked for, no error
  handling for impossible states. If 200 lines could be 50, rewrite it.
- **Surgical changes.** Touch only what the request requires; match the surrounding code; don't
  refactor what isn't broken. Remove only the orphans **your** change created; pre-existing dead
  code you mention, not delete. Every changed line traces to the request.
- **Think before coding.** State assumptions; surface multiple interpretations instead of silently
  picking one; push back when a simpler approach exists. For spec ambiguity, that's `/grilling`.

## Conventions

- **SDD + TDD are mandatory** (see "How we build here"), even when the request doesn't mention it.
- **One source of truth (§4)** — the two function tools are implemented **once** in
  `ai/harness/_shared/tools/` and shared by every harness.
- **Honesty (§5)** — fixtures are recorded from real runs, never hand-written to make a test pass.
  `ai/harness/langgraph/` is a scaffold and says so. Unverifiable infrastructure is documented as a
  manual step, not shipped as unverified IaC.
- **Agent guidance in sync (§6)** — `CLAUDE.md` ↔ `AGENTS.md` ↔ `.claude`/`.codex` workflows.
- **Bilingual (§7)** — user-facing strings ship `{ en, pt }`; `README.md` ↔ `README.pt-BR.md`.
- **Code and comments in English.** Docs in English; the README is mirrored in Portuguese.
- **Zero secrets.** Entra ID via `DefaultAzureCredential` everywhere; `.env.example` holds
  placeholders only; the browser never holds an Azure credential.

## Docs

- `PLAN.md` — the architecture record and phase→spec map.
- `docs/architecture.md` — what runs in Foundry vs. in this app (kept in sync with the code).
- `docs/harness-comparison.md` — prompt agent vs. hosted agent (LangGraph marked *planned*).
- `docs/how-it-works/` — streaming events · the function-call round trip · tracing and the gateway ·
  the Voice Live session lifecycle.
- `docs/REFERENCES.md` — every Foundry doc URL and API version relied on (§10).
- `docs/development-workflow.md` — SDD + TDD, the contributor companion to the constitution.
