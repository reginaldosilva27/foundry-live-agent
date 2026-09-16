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

1. **§8 — no agent loop in the app.** `backend/` and `frontend/` never choose *which* tool to call,
   re-prompt the model, loop on model output, or duplicate state Foundry owns. Executing a function
   tool Foundry asked for, and submitting its output, is the documented client-side contract and is
   fine. Test: *"would this still be true if the harness were swapped?"* Inside a harness, the
   **adapter** is imported by the BFF and contains no loop; the **agent** (`ai/harness/<name>/agent/`)
   is deployed to Foundry and may contain all the loop it likes — authoring an agent is not the app
   running one (amended 2026-09-16, spec 018). **One bounded exception**
   (amended 2026-09-16, spec 017): a voice session states one static fact about the transport — that
   the conversation is spoken — because the agent cannot perceive it and `instructions` is
   unsupported with a custom agent. One item, one sentence, once; not a licence to prompt.
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
- **Both legs of that round trip must name the same `conversation`.** The output leg carries only
  `function_call_output` items; unbound, Foundry answers `400 — No tool call found for function
  call output with call_id …`.
- Foundry's own `agent.yaml` is **deprecated**; ours (`ai/harness/*/agent.yaml`) is our schema,
  labelled as such.
- **Voice Live never passes through the AI Gateway**, and the gateway does not log tool traces.
- **A tool round trip is silent, and only the agent definition can fill it.** `instructions` is
  **not supported** on a Voice Live session with a custom agent, so how the agent behaves during a
  turn — including the spoken preamble before a tool call (spec 016) — is changed in
  `ai/harness/*/agent.yaml` and applied, never per session and never by the BFF speaking for it.
- **The agent does not know it is speaking.** Voice Live transcribes before the model and
  synthesizes after it; asked over real audio, `gpt-5.5` answers *"Estou trocando texto escrito com
  você."* So an instruction conditioned on the modality is conditioned on nothing — that is why the
  voice session sends one `role: system` context item saying so (spec 017), the single **bounded**
  exception §8 carries.
- **Reasoning summaries are configured on the agent definition, not per request.** Sending
  `reasoning` alongside an `agent_reference` is rejected: *"Not allowed when agent is specified."*
  Without it the card is empty forever, though the model still spends reasoning tokens. And
  `summary: auto` is not enough — on short tool-calling legs the model declines to summarise, so the
  definition says `detailed`. A turn with no summary is a normal state the UI must survive (spec
  015), never evidence of a misconfigured deployment.
- **`response.mcp_call.completed` carries no `item`** — only `item_id`. Read the MCP call from
  `response.output_item.done`. Same for function calls: `…arguments.done` has `name: null`.
- **Foundry completes the leg it is waiting on**, so a turn with a tool round trip contains two
  `response.completed` events. Usage must be summed and `done` held back, or the contract breaks.
- **Voice Live attaches with `agent_name` + `agent_project_name`** — *not* `project_name`, which the
  quickstart documents and the service rejects. The SDP field is `sdp_offer`, and the WebRTC control
  endpoint exists **only** on `api-version=2026-01-01-preview`.

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
- **Zero secrets for Azure.** Entra ID via `DefaultAzureCredential` for every Azure service;
  `.env.example` holds placeholders only; the browser never holds a credential of any kind.
  **One documented exception:** `TAVILY_API_KEY`, behind the `search_web` tool — a third-party
  service with no Entra path, read by the BFF process only (spec 013). A key for an **Azure**
  service is still a design smell; adding a second third-party one means saying why, where the
  reader will hit it, as `.env.example` does.

## Docs

- `PLAN.md` — the architecture record and phase→spec map.
- `docs/architecture.md` — what runs in Foundry vs. in this app (kept in sync with the code).
- `docs/harness-comparison.md` — prompt agent vs. hosted agent (LangGraph marked *planned*).
- `docs/how-it-works/` — streaming events · the function-call round trip · tracing and the gateway ·
  the Voice Live session lifecycle.
- `docs/REFERENCES.md` — every Foundry doc URL and API version relied on (§10).
- `docs/development-workflow.md` — SDD + TDD, the contributor companion to the constitution.
