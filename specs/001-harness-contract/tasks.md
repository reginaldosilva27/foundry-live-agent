# Tasks: Harness contract

> Red → green → refactor. Each implement task is preceded by the test that must fail first.

## Tasks

- [x] **T1 — scaffold**: `ai/pyproject.toml` (ruff + pytest config), package `__init__.py` files,
      `ai/tests/fixtures/recorded/README.md` explaining what lands there in spec 002
- [x] **T2 — RED**: write `ai/tests/test_contract.py` covering AC1–AC9. Run `pytest` — it must fail
      on the missing `contract` module
- [x] **T3 — GREEN**: write `ai/harness/_shared/contract.py` — the nine `TypedDict`s, `validate_event`
      (AC1–AC3), `check_stream` (AC4–AC8), `HarnessAdapter` Protocol (AC9). Run `pytest` — green
- [x] **T4 — RED**: write `test_conformance_suite_runs_against_any_adapter` (AC10) against a
      not-yet-existing `ai/tests/conformance.py`
- [x] **T5 — GREEN**: write `ai/tests/conformance.py` — `run_conformance(adapter)`, adapter-agnostic
- [x] **T6 — refactor**: remove duplication between `validate_event` and `check_stream`; keep green
- [x] **T7 — gates**: `ruff check .` and `ruff format .` clean; `pytest -q` green
- [x] **T8 — docs (§4)**: record the contract in `ai/harness/_shared/README.md`; leave
      `docs/how-it-works/streaming-events.md` a stub until spec 002 can name the real Foundry events
      (§10 — no guessing)

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green
- [x] Docs updated in the same change (§4)
- [x] No fabricated fixture presented as a recording (§5)
- [x] `spec.md` status updated to `done`
