# Tasks: Bounded tool-output settlement

## Tasks

- [x] **T1 — test first**: final-leg and multi-tool submission, N+1 cap, non-positive budget,
  submission failure and recorded replay regressions; capture RED before production edits.
- [x] **T2 — implement**: snapshot budget and reserve exactly one non-executing settlement leg.
- [x] **T3 — contract/docs**: explain the request bound, explicit unanswered settlement requests,
  transport limits and the difference between tool_result and upstream receipt.
- [x] **T4 — refactor**: maintain ordinary behavior, rerun focused regression/conformance tests.

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Full verify-gates lint, tests and frontend build pass (infra skipped if absent, as CI)
- [x] Local demo HTTP replay and budget-bound recorded replay checked, without metered Azure
- [x] Documentation updated, no AgentEvent/schema/new SDK details or UI strings
- [x] Spec and index updated to done

## Verification evidence

- RED: 8 failed, 35 passed before production changes; GREEN: 55 focused regression,
  recorded-turn, contract and concurrency tests passed.
- Backend: Ruff lint/format passed; 299 tests passed in the isolated Python 3.12 environment.
- AI: Ruff lint passed; 256 passed, 3 integration tests skipped.
- Frontend: lint, 1056 tests and production build passed after restoring missing dependencies
  with `npm ci`. Existing lint/build warnings and dependency audit findings were not changed.
- Infra: absent, skipped as CI does. `git diff --check` and changed-Python format check passed.
- Local HTTP demo at budget 1: real recorded stream, two exact tool outputs submitted together,
  same conversation, two requests, summed usage and exactly one done. Allowed
  `Origin: http://localhost:5173` CORS header verified. No browser or live Azure claim; own
  ephemeral backend stopped after assertions.
