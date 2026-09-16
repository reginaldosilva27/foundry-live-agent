# Tasks: The second harness — a LangGraph graph running as a Foundry hosted agent

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

**The order is not the usual one, and that is deliberate.** Everything downstream of the container
depends on a stream shape nobody has seen (§10). Spec 002 built the normaliser first against
inferred shapes and had three of them contradicted by the first real recording. So the deploy comes
early, the recording comes before the normaliser, and the tests that assert claims about Foundry are
written **from** the recording — which is TDD, not a detour around it: the fixture is the
requirement, and the test still fails before the code exists.

Phases A and B need no Azure. Phase C is the gate everything else waits on.

## A — the shared definition (no Azure, no Docker)

- [x] **T1 — test first**: `ai/tests/test_agent_spec.py` — `extends:` shallow-merges the referenced
      file underneath the local one; a missing target and a cyclic `extends:` are typed errors.
- [x] **T2 — implement**: `extends:` in `ai/harness/_shared/agent_spec.py`. One key, shallow merge,
      no override rules (plan, *Risks*).
- [x] **T3 — test first**: `ai/tests/test_harness_parity.py` — the two harnesses' specs agree on
      `model`, `instructions` and the tool-name set (**AC5**). Red: `ai/harness/langgraph/agent.yaml`
      does not exist.
- [x] **T4 — implement**: create `ai/harness/_shared/agent_core.yaml` by **moving** model,
      instructions and tools out of `ai/harness/prompt_agent/agent.yaml` (which keeps `extends:` +
      `reasoning:`), and add `ai/harness/langgraph/agent.yaml` — `extends:` the core, `name:
      foundry-live-agent-hosted`, plus the `hosted:` block.
      *Guard: `just agent --dry-run` for the prompt agent must print exactly what it printed before.*
- [x] **T5 — test first**: `ai/tests/test_harness_parity.py` — the three AC11 values live in
      `agent.yaml` and nowhere else; `uses_gateway` is false for the hosted spec (**AC11**).
- [x] **T6 — test first**: `ai/tests/test_hosted_config.py` — `build_hosted_config.py --check`
      matches the committed `azure.yaml`, and the generated config carries no plaintext
      `TAVILY_API_KEY` (**AC7**, **AC8**).
- [x] **T7 — implement**: `ai/scripts/build_hosted_config.py` + the generated, committed
      `ai/harness/langgraph/azure.yaml`.

## B — the container (Docker, no Azure)

- [x] **T8 — test first**: `ai/tests/test_hosted_graph.py` — the graph's tools are
      `registry.specs()`' callables by **identity**, and no copy of `_shared/tools` exists under
      `agent/` (**AC6**).
- [x] **T9 — implement**: `ai/harness/langgraph/agent/tools.py` — wrap the registry specs as
      LangChain tools; build the Microsoft Learn MCP client from the `server_url` in the core.
- [x] **T10 — test first**: `ai/tests/test_hosted_graph.py` — the compiled graph has exactly the
      nodes `agent` and `tools`, an entry at `agent`, a conditional edge `agent → tools | END`, and
      **no checkpointer** (decision 4).
- [x] **T11 — implement**: `ai/harness/langgraph/agent/graph.py` and `host.py`.
- [x] **T12 — implement**: `Dockerfile` (build context `ai/`) + `requirements.txt`; the `hosted`
      optional-dependency group in `ai/pyproject.toml`. Build it locally and run it; a container that
      has never started is not evidence.

## C — deploy and record (the gate — needs Azure, Docker, Foundry Project Manager)

> If the role or the region is unavailable, **stop here and say so**. Do not simulate a container
> (§5). Spec 002's eleven-day block is the precedent for how this is reported.

- [ ] **T13**: provision the **Key Vault connection** on the project for `TAVILY_API_KEY` and verify
      the agent's Entra identity reads it. Automate it if it can be verified from this repo;
      otherwise write it up as a manual step, the way `infra/README.md` handles the AI Gateway
      (**AC7**).
- [x] **T14**: `azd ext install azure.ai.agents` → `azd provision` → `azd deploy` from the committed
      `azure.yaml`. Record every command that actually ran; that transcript is what AC8 promises a
      cloner (**AC8**).
- [x] **T15 — implement**: `ai/scripts/spike_hosted.py`, and record **live** turns —
      (a) a Microsoft Learn question, (b) a function-tool question. Redact via
      `ai/scripts/redact_fixture.py`, commit dated raw + normalised fixtures, and describe each in
      `ai/tests/fixtures/recorded/README.md` (**AC3**, **AC4**, §5).
- [x] **T16 — observe**: does a hosted turn emit `reasoning_summary`? Record the answer with its
      date (**AC13**).
- [x] **T17 — observe**: attempt a **Voice Live** session against the hosted agent. Record whichever
      answer the service gives — a committed voice fixture, or the refusal written into
      `docs/REFERENCES.md`. Not attempting is a failing case (**AC9**).
- [x] **T18 — observe**: query App Insights for the recorded turn's `response_id` and record what a
      hosted-agent trace actually looks like (**AC10**).

## D — the normaliser and the adapter (driven by the recordings)

- [x] **T19 — test first**: `ai/tests/test_hosted_recorded_turn.py` — the Learn recording normalises
      to `tool_call{executor:"foundry"}` + matching `tool_result` and **no** `mcp_call`, while the
      existing prompt-agent fixture for the same question still has one (**AC3**).
- [x] **T20 — test first**: same file — the function-tool recording carries the pair with the tool's
      real output, and `check_stream` passes (**AC4**); and the reasoning assertion T16 settled
      (**AC13**).
- [x] **T21 — implement**: `ai/harness/langgraph/events.py`, with the `MAPPINGS` table and `verified`
      flags, plus the test that no mapping claims `verified` unless a fixture shows it — the
      discipline `prompt_agent/events.py` already carries.
- [x] **T22 — test first**: `ai/tests/test_langgraph_adapter.py` — the adapter streams a replayed
      recording, terminates, and no `NotImplementedError` is reachable on the request path; the
      `_NOT_BUILT` sentinel is gone from the package (**AC1**).
- [x] **T23 — implement**: `ai/harness/langgraph/adapter.py`. Single leg, no loop.
- [x] **T24 — test first**: register the adapter in `ai/tests/test_conformance.py` and run
      `run_conformance` against it (**AC2**). **`ai/tests/conformance.py` must stay byte-identical** —
      if it cannot, stop and write the finding into `spec.md` before touching it.
- [x] **T25 — test first**: `backend/tests/test_harness_factory.py` — `AGENT_HARNESS=langgraph`
      returns a working adapter; the existing "raises by design" test inverts (**AC1**).
- [x] **T26 — implement**: `backend/app/harness_factory.py`, and scope `GET /config`'s
      `event_mapping` to the selected harness (plan, *Contract impact*).
- [x] **T27 — implement (conditional on T17)**: if voice does not attach, the harness reports it, the
      UI disables the control, and both `{ en, pt }` strings ship (**AC9**, §7). If it does attach,
      wire `POST /voice/session` to `voice_attachment_params()` so voice follows the selected
      harness — and delete the i18n table from `plan.md` rather than leaving dead strings.

## E — the contract, the constitution, the docs

- [x] **T28 — implement**: `ToolCall`'s docstring in `ai/harness/_shared/contract.py` — "Foundry runs
      it" → "the platform side runs it". Docstring only; no type, field or enum change (decision 2).
- [x] **T29 — implement**: amend `.specify/constitution.md` §8's headline and its amendments table
      (spec, *Contract / data impact*), and move `CLAUDE.md`, `AGENTS.md` and the `.claude/`+`.codex/`
      workflows in the **same commit** (§6).
- [x] **T30 — docs**: `docs/harness-comparison.md` — the hosted column filled from **measurement**,
      naming both findings (where the tools execute; who the MCP client is), including the numbers
      that are worse (**AC12**).
- [x] **T31 — docs**: `ai/harness/langgraph/README.md` rewritten — it no longer says nothing works,
      and it answers its own open question about which state lives where. `docs/architecture.md`
      shows both harnesses. `docs/how-it-works/streaming-events.md` stops implying every turn has an
      `mcp_call` (**AC12**).
- [x] **T32 — docs**: `docs/REFERENCES.md` — every row of the spec's §10 table with the date it was
      read, the four measured answers (T16–T18, T13), and the stale idle-timeout range corrected
      from 5–60 to **2–60** (**AC12**, §10).
- [x] **T33 — docs**: `.env.example` (`AGENT_HARNESS=langgraph`, and where the reader hits the Key
      Vault connection), `justfile` (`hosted-build`, `hosted-deploy`, `hosted-record`),
      `ai/README.md`, `PLAN.md` Phase 4.
- [x] **T34 — refactor**: clean up, keep everything green.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test — or, where the criterion asks
      for an observation, to a **dated** recording or a documented manual step (AC7, AC9, AC10, AC12)
- [x] `ai/tests/conformance.py` is byte-identical to its state before this spec (**AC2**)
- [x] Lint clean
- [x] Tests green — and green **without** Azure, Docker or a credential, on fixtures alone
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] §8's amendment landed in the constitution, `CLAUDE.md` and `AGENTS.md` in one commit (§6)
- [x] (AC9 did not need them — voice attaches) all new user-facing text exists in `en` **and** `pt` (§7)
- [x] `verify-gates` run and green
- [x] `spec.md` status updated to `done`; `specs/README.md` row updated
