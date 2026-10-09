# Plan: Replay isolation

## Approach
Bind the existing search provider to an empty-key Tavily backend in a request-local context on the
separate demo entrypoint. Context propagates into FastAPI threadpool execution without mutating
process environment or the shared registry. The live path retains its environment-derived backend.
Explicitly disable inherited live capabilities in demo composition.

## Affected files
- `ai/harness/_shared/tools/registry.py` — request-local provider binding.
- `backend/app/demo.py` — scoped replay binding and disabled live settings.
- `backend/tests/test_demo.py` — inherited-key, concurrent live/replay and settings regressions.
- `backend/pyproject.toml` — declare runtime jsonschema dependency.
- `README.md`, `README.pt-BR.md`, `justfile` — clean setup and bounded startup/shutdown.

## Contract / data model changes
No schema changes; registry owns tool/provider binding. Live defaults do not change.

## i18n strings
No new rendered strings. README instructions move together in EN/PT.

## Test strategy
| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | inherited key cannot reach HTTP provider; environment preserved | backend/tests/test_demo.py |
| AC2 | concurrent live/replay search plus local tools | backend/tests/test_demo.py |
| AC3 | inherited endpoints/flags disabled and valid recorded stream | backend/tests/test_demo.py |

Dependency regression: fresh venv, install declared ai/backend packages, run tools/demo tests.
Readiness: start actual `just demo`, check UI/API/chat and browser replay, stop all helper processes.

## Risks / trade-offs
Request contexts must survive streaming and threadpool propagation; integration tests exercise both.
No process-global key removal. Optional metered search is taught only through `just backend`.
