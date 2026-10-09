# Project Constitution — foundry-live-agent

> The non-negotiable principles every spec, plan, and change must respect.
> Written once, amended deliberately (see *Amendment process*). When a spec or a
> code change conflicts with a principle here, the constitution wins — or the
> principle is amended first, on purpose.

**Project:** An open-source reference implementation of Microsoft Foundry Agent Service end to end —
a full-stack chat and voice application built *around* an agent that runs *inside* Foundry, with
swappable agent harnesses behind one contract. Doubles as educational material for the Brazilian
data/AI community.

> Adapted from [agentic-coding-template](https://github.com/reginaldosilva27/agentic-coding-template).
> §1–§7 are the inherited generic principles. **§8–§10 are specific to this project** and encode the
> ideas that make it worth reading: where the agent loop lives, the event contract, and the rule that
> no Foundry API is written from memory.

---

## Core principles

### 1. Spec-first (SDD)
No feature code without a spec under `specs/`. The spec is the source of truth for
*what* and *why*; the plan for *how*; tasks for *the work*. This holds **even when the
request doesn't mention it.** See [`specs/README.md`](../specs/README.md).

### 2. Test-first (TDD)
Acceptance criteria (for a feature) or a reproducing case (for a bug) become a
**failing test before** implementation. Cycle: red → green → refactor. Tests assert
**behavior**, not implementation detail, so they survive refactors. Anything that
changes behavior is driven by a test; pure chores (docs, formatting, dep bumps) are not.

### 3. Done means the gates are green
A change is **done** only when the quality gates below pass — lint, tests, type-check/build
(see *Quality gates*). "Done" is never declared on red; if a gate fails, the output is
shown and the failure is fixed or surfaced, never silently skipped.

### 4. One source of truth — no forking, no drift
Each fact (a schema, a config default, a piece of prose) lives in exactly one place;
everything else derives from or links to it. Docs follow the code in the **same** change.
Don't duplicate a behavior across files when one shared definition will do.

*Applied here:* the three function tools are implemented **once** in `ai/harness/_shared/tools/` and
shared by every harness. `justfile` recipes delegate to the canonical gate commands rather than
restating them.

### 5. Honesty — nothing fake passed off as real
Committed code does not fabricate, mock, or stub behavior and present it as real. External
dependencies are exercised for real in tests where feasible (provide keys/services as CI
secrets; mark and skip the dependent tests when unavailable). Misconfiguration **fails fast**
with a clear, typed error rather than silently degrading. *(A clearly-labelled demo/fixture
mode is allowed only if it is obviously labelled and replays real captured data — never
fabricated.)*

*Applied here:* the `AgentEvent` fixtures under `ai/tests/fixtures/` are **recorded from real
Foundry runs**, never hand-written to make a test pass. `ai/harness/langgraph/` implements a hosted
agent and documents its measured limitations. Its adapter rejects `submit_tool_output` because the
container already answered the call, not because the harness is unimplemented.
Infrastructure we cannot verify is documented as a manual step, not shipped as unverified IaC.

### 6. Agent guidance stays in sync
`CLAUDE.md` (Claude Code), `AGENTS.md` (Codex/others), and the `.claude/` + `.codex/`
workflows are **one set of rules with several front doors.** Change a rule in one, change
it in the others in the **same** commit. This constitution is the source of truth above all
of them.

### 7. Bilingual user-facing text — en/pt
Every user-facing string the app renders ships in **both** English and Portuguese
(`{ en, pt }` in `frontend/src/i18n/strings.ts`). Code, protocols, and proper nouns stay plain
strings. A feature is not done until its `pt` text exists alongside its `en` text.
`README.md` is mirrored by `README.pt-BR.md`; both move in the same change.

---

## Project-specific principles

### 8. The agent loop never lives in the app
`backend/` and `frontend/` contain **no agent-loop logic**: no tool selection, no model
orchestration, no planning, no retry-until-satisfied loop. The backend is a **BFF** limited to
identity, streaming, tool *execution* (never tool *choice*), trace lookup, and voice signalling.

**Amended 2026-09-16 (spec 018): "the app", not "this repo".** The headline said *"the agent loop
lives in Foundry — never in this repo"*, which became false the moment a LangGraph graph landed in
`ai/harness/langgraph/agent/`. The prohibition is unchanged and unweakened; what was wrong was the
word *repo*. §8 was always about **the app** — the BFF and the browser. `ai/harness/<name>/` is
where an agent is **authored**, and authoring an agent is not the same as the app running one.

The distinction that carries it, inside a single harness:

| | where it runs | may it run the agent loop? |
|---|---|---|
| the **adapter** (`ai/harness/<name>/adapter.py`) | imported by the BFF | **No.** It normalises a stream; it chooses nothing. It does carry **one bounded loop, and only one**: the tool round trip — Foundry emits a function call and *stops*, so a turn is several legs and somebody has to submit the outputs and read the next one. Capped (`DEFAULT_MAX_TURNS`), driven entirely by what the platform asked for, reading nothing the model said in order to decide. That is the client-side contract named below, not an agent loop. |
| the **agent** (`ai/harness/<name>/agent/`, or a Foundry agent version) | on Foundry | **Yes** — all the loop it likes. That is what an agent is. |

§8's own test survives intact: swap the harness, and the BFF is still not choosing tools.

This is the whole point of the repository. Concretely, a change violates §8 if it:

- decides **which** tool to call, in what order, or whether to call one at all;
- re-prompts the model, rewrites instructions at request time, or loops on model output;
- keeps agent state the platform already owns (conversation history, tool definitions).

Executing a function tool Foundry asked for, and submitting its output, is **not** a violation —
that is the documented client-side contract. When in doubt, ask: *"would this still be true if the
harness were swapped?"* If yes, it belongs in the app; if no, it belongs in Foundry.

**One narrow exception, added 2026-09-16 (spec 017): session context the platform has no other
channel for.** A voice session may state, once when it opens, a *static fact about the transport*
that the agent cannot observe — concretely, that the conversation is spoken. It is allowed because:

- the agent genuinely cannot see it (verified: asked over real audio, the model answers that it is
  exchanging written text), and Voice Live's documented field for this, `instructions`, is
  unsupported with a custom agent;
- it passes §8's own test — swap the harness and it is still true, because it describes the channel
  and not the agent;
- it is bounded: **one item, one sentence, sent once**, naming no tool, making no plan, and reading
  nothing the model produced.

It is **not** a licence to prompt the agent from the app. Anything that varies per request, reacts
to model output, or carries tool or planning content is still a §8 violation.

### 9. The `AgentEvent` protocol is the contract
`ai/harness/_shared/contract.py` is the single boundary between any harness and the rest of the app.
The typed event set is `reasoning_summary · text_delta · tool_call · tool_result · mcp_call · usage ·
trace_ids · error · done`.

- Every harness emits **only** these events; the BFF and frontend consume **only** these events.
- Adding, removing or reshaping an event is a **contract change** → it needs a spec (§1) and moves
  its consumers, fixtures and docs in the same change (§4).
- Contract tests are written against the `HarnessAdapter` **Protocol**, parameterised over adapters,
  so a new harness proves itself against the existing suite without editing it.

### 10. No Foundry API from memory — cite the doc
Microsoft Foundry changed substantially through 2026 and model training data is unreliable about it.
Every integration detail — SDK package and version, endpoint shape, `api-version`, event name,
tool declaration, RBAC role — is taken from a **doc read at the time of writing** and recorded in
[`docs/REFERENCES.md`](../docs/REFERENCES.md) with its URL.

When a value cannot be confirmed from the docs, it is either **verified against a live service and
recorded as a fixture**, or **marked as an open question** — never guessed silently. Any PR that
adds or changes a Foundry integration updates `docs/REFERENCES.md` in the same change (§4).

---

## Quality gates (must pass before "done")

These mirror [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), run per layer
(`backend/` · `ai/` · `frontend/` · `infra/`):

- **`backend/` (Python)** — `ruff check . && ruff format --check . && pytest -q`
- **`ai/` (Python)** — `ruff check . && pytest -q`
- **`frontend/` (React/TS)** — `npm run lint && npm test && npm run build`
- **`infra/` (Bicep)** — `az bicep build --file main.bicep && az bicep lint --file main.bicep`
  *(this project uses Bicep + azd, not Terraform — amended from the template on purpose)*

Plus the cross-cutting gates from the principles above: spec exists for the feature (§1),
a failing test drove the change (§2), docs updated in the same change (§4), agent guidance
kept in sync (§6), every new string is bilingual (§7), no agent-loop logic entered `backend/` or
`frontend/` (§8), `AgentEvent` changes went through a spec (§9), and every new Foundry integration
detail is cited in `docs/REFERENCES.md` (§10).

---

## Amendment process

This document changes only by intent, not by accident:

1. Propose the change in the PR / spec that needs it, with a one-line rationale.
2. Update this file in the **same** change.
3. If an existing spec now conflicts, reconcile it or mark it superseded.

**Amendments already made to the inherited template**, each on purpose:

| Change | Rationale |
|---|---|
| §7 kept (not deleted) | Public-facing UI with a Brazilian audience — bilingual is a project goal, not optional |
| `infra/` gate: Terraform → **Bicep** | The brief specifies Bicep + azd |
| Added §8, §9, §10 | The repo's educational value depends on these invariants holding under review |
| §8 exception: session context for the voice transport (2026-09-16) | The agent cannot perceive that it is being spoken to, and Voice Live's `instructions` field is unsupported with a custom agent — so a fact about the channel had nowhere else to live. Bounded to one static sentence; spec 017 |
| §8 table: *"may it loop?"* → **"may it run the agent loop?"**, and the adapter's one bounded loop named (2026-09-20) | The table answered **No** flatly while `PromptAgentAdapter` has always looped over the legs of a turn, up to `DEFAULT_MAX_TURNS`. The distinction that makes that legal — a loop over the platform's own round trip, deciding nothing — lived only in the adapter's docstring, and it is the *table* somebody quotes in a review. No rule changed; the rule now says what it always meant |
| §8 headline: "never in this repo" → **never in the app** (2026-09-16) | A hosted agent is a container this repository authors and Foundry runs, so its loop is *in the repo* by construction. The prohibition on `backend/` and `frontend/` is unchanged; the headline was overreaching. Adapter (in the BFF, no loop) is now distinguished from agent (on Foundry, all loop); spec 018 |

---

*Ratified: 2026-09-04 · Maintainer: Reginaldo Silva*
