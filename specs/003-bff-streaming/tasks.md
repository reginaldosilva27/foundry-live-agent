# Tasks: The BFF

- [x] **T1**: `backend/pyproject.toml`, package skeleton, `settings.py` that fails fast
- [x] **T2 — RED**: `test_sse.py` — framing, event names, JSON payloads (AC1)
- [x] **T3 — GREEN**: `app/sse.py`
- [x] **T4 — RED**: `test_tool_executor.py` — success, raising tool, unknown name (AC3–AC5)
- [x] **T5 — GREEN**: `app/tool_executor.py`
- [x] **T6 — RED**: the loop, round trip, terminal guarantees and turn cap (AC2, AC6) — landed in
      `ai/tests/test_prompt_adapter.py` and `backend/tests/test_routes.py`, not a `test_turn.py`
- [x] **T7 — GREEN**: `harness/prompt_agent/{events,adapter}.py`. **No `app/turn.py`**: the turn
      loop belongs to the adapter, so the §9 "always terminates" invariant stays checkable
      against a real harness by the spec 001 conformance suite
- [x] **T8 — RED**: `test_routes.py` — `/chat`, `/config`, `/health`, harness selection (AC8–AC11)
- [x] **T9 — GREEN**: `app/main.py`, `app/routers/*`
- [x] **T10 — RED/GREEN**: no backend module names a tool (AC7) — `test_routes.py::test_no_backend_module_names_a_tool` and `::test_no_backend_module_imports_a_specific_tool`
- [x] **T11 — gates**: ruff + pytest green in `backend/` and `ai/`
- [x] **T12 — docs (§4)**: `docs/how-it-works/{streaming-events,function-call-round-trip}.md`,
      marking which event names are observed and which are still inferred

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean · tests green (26 backend, 92 ai)
- [x] No mapping presented as verified that was not observed (§5, §10)
- [x] `spec.md` status updated to `done`
