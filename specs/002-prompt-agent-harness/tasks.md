# Tasks: Prompt-agent harness

> Two passes. Pass 1 is everything that does not need a live Foundry project. Pass 2 is blocked on
> `az login` reaching subscription `7a4e9773-94ea-45a8-9b58-2701ed307318`.

## Pass 1 — no Azure required

- [x] **T1 — RED**: `tests/test_tools.py` for AC1–AC6
- [x] **T2 — GREEN**: `tools/datetime_tool.py`, `tools/knowledge_tool.py` (+ `KnowledgeSource`
      Protocol and `LocalMarkdownKnowledge`), `tools/registry.py`, and the markdown corpus
- [x] **T3 — RED**: `tests/test_agent_spec.py` for AC7
- [x] **T4 — GREEN**: `harness/_shared/agent_spec.py` + `harness/prompt-agent/agent.yaml`
- [x] **T5**: `scripts/apply_agent.py` — written, not yet runnable
- [x] **T6**: `scripts/spike.py` — the O-1/O-3/O-8/O-9 probe, ready to run
- [x] **T7**: `harness/langgraph/` scaffold — README documenting the intended design, `adapter.py`
      raising `NotImplementedError`, satisfying the Protocol so it can be registered but not used
- [x] **T8 — gates**: `ruff check` · `ruff format --check` · `pytest -q` green
- [x] **T9 — docs (§4)**: `harness/prompt-agent/README.md` — what Foundry runs vs. what we run

## Pass 2 — blocked on Azure access

- [ ] **T10**: run `spike.py`; record findings for **O-1, O-3, O-8, O-9** in `docs/REFERENCES.md`
- [ ] **T11**: commit the recorded fixture to `tests/fixtures/recorded/`
- [ ] **T12 — RED**: conformance test driving `PromptAgentAdapter` from the recorded fixture
- [ ] **T13 — GREEN**: `harness/prompt-agent/events.py` (normaliser) + `adapter.py`
- [ ] **T14**: run `apply_agent.py` against the project; confirm AC8
- [ ] **T15**: `docs/how-it-works/streaming-events.md` — written from observed events, not guessed

## Definition of done

- [ ] Every acceptance criterion maps to a passing test
- [x] Lint clean · tests green (57 tests)
- [ ] Spike findings recorded in `docs/REFERENCES.md` with the date observed (§10)
- [x] No fixture written by hand (§5) — `recorded/` is still empty
- [ ] `spec.md` status updated to `done`
