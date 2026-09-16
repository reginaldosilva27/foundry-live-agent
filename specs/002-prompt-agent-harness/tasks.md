# Tasks: Prompt-agent harness

> Two passes. Pass 1 is everything that does not need a live Foundry project. Pass 2 was blocked on
> Azure access and ran on **2026-09-15** — against a different project than the one it was blocked
> on (`ai-admin2354ai223634534-project`, eastus2, `gpt-5.5`), which is what unblocked it.

## Pass 1 — no Azure required

- [x] **T1 — RED**: `tests/test_tools.py` for AC1–AC6
- [x] **T2 — GREEN**: `tools/datetime_tool.py`, `tools/knowledge_tool.py` (+ `KnowledgeSource`
      Protocol and `LocalMarkdownKnowledge`), `tools/registry.py`, and the markdown corpus
- [x] **T3 — RED**: `tests/test_agent_spec.py` for AC7
- [x] **T4 — GREEN**: `harness/_shared/agent_spec.py` + `harness/prompt_agent/agent.yaml`
- [x] **T5**: `scripts/apply_agent.py` — written, not yet runnable
- [x] **T6**: `scripts/spike.py` — the O-1/O-3/O-8/O-9 probe, ready to run
- [x] **T7**: `harness/langgraph/` scaffold — README documenting the intended design, `adapter.py`
      raising `NotImplementedError`, satisfying the Protocol so it can be registered but not used
- [x] **T8 — gates**: `ruff check` · `ruff format --check` · `pytest -q` green
- [x] **T9 — docs (§4)**: `harness/prompt_agent/README.md` — what Foundry runs vs. what we run

## Pass 2 — ran 2026-09-15

- [x] **T10**: ran `spike.py` (131 events) plus a reasoning probe (310 events); **O-1, O-3, O-8, O-9**
      recorded in `docs/REFERENCES.md` with the date and the environment
- [x] **T11**: `scripts/redact_fixture.py` + two fixtures committed to `tests/fixtures/recorded/`.
      Also fixed `.gitignore`: the `*.raw.jsonl` rule did not match the `recorded/` subdirectory, so
      un-redacted captures were never actually ignored
- [x] **T12 — RED**: `tests/test_recorded_turn.py` replays both recordings — 5 of its 10 tests failed
- [x] **T13 — GREEN**: three fixes the recording forced, each with its own test:
      **(a)** `mcp_call` is built from `response.output_item.done`, not from
      `response.mcp_call.completed`, which carries no `item` — the old path produced a card labelled
      `unknown` with no output; **(b)** the adapter accumulates `usage` across legs and holds `done`
      until the turn ends, because Foundry completes the leg it is still waiting on; **(c)** every
      event type in a real stream is now mapped, and the `verified` flags are read from the fixtures
      instead of a hand-maintained list
- [x] **T13b — RED/GREEN (AC13)**: `reasoning:` in `agent.yaml`, validated by `agent_spec.py`,
      applied by `apply_agent.py` — the spike showed the request-level parameter is rejected
- [x] **T14**: `apply_agent.py` ran against the project; `foundry-live-agent` is at **version 3**
      with `reasoning.summary: auto`. AC8 confirmed — a second run made a second version
- [x] **T15**: `docs/how-it-works/streaming-events.md` rewritten from the recording, including the
      three inferences it contradicted

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean · tests green (108 ai, 26 backend)
- [x] Spike findings recorded in `docs/REFERENCES.md` with the date observed (§10)
- [x] No fixture written by hand (§5) — both are captures, redacted by script
- [x] `spec.md` status updated to `done`

## Carried forward, not silently closed

The agent runs on a **plain** `gpt-5.5` deployment, so it bypasses the APIM gateway. Everything above
is about the BFF→Foundry hop. Whether the Responses API and reasoning summaries survive the
Foundry→gateway hop is **still unverified** — neither reference environment has a working BYOM
connection. `agent.yaml` says so at the point of the decision, and `uses_gateway` reports it at
apply time.
