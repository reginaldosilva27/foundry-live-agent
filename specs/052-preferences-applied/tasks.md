# Tasks: Preferences that reach the application

- [x] T1 — RED: App integration regressions for AC1–AC6; add isolated Preferences negatives in GREEN.
- [x] T2 — GREEN: connect language and reasoning; remove unsupported controls.
- [x] T3 — Update docs and historical spec with reconciliation links.
- [x] T4 — Run targeted and full gates; record exact results and RED evidence.
- [x] T5 — Commit locally with standard co-author trailer; report to coordinator.

## Definition of done

- [x] Every AC has passing integration evidence.
- [x] Lint, tests and build pass; full gates reported honestly.
- [x] Related documentation updated, no new strings or contract changes.
- [x] Spec status reflects verification.

## Verification evidence

- RED: `cd frontend && npm test -- App.preferences.test.tsx` — 10 failed, 2 passed before
  production edits. Failures included unchanged language, absent persisted rail/palette choice,
  always-open chat/comparison reasoning, and exposed reading control. The initial streaming-test
  encoder was corrected before GREEN; its original failure is not relied on as bug evidence.
- GREEN: `cd frontend && npm run lint && npm test && npm run build` — passed; 90 files,
  1052 tests. Existing history ref warnings and bundle-size warning remain.
- Backend (isolated Python 3.12 venv on PATH): `cd backend && ruff check . && ruff format --check . && pytest -q`
  — passed; 45 files formatted, 299 tests.
- AI (same venv): `cd ai && ruff check . && pytest -q` — passed; 246 passed, 3 integration skips.
- Infrastructure: guarded `az bicep build --file main.bicep && az bicep lint --file main.bicep`
  — clean skip, no `infra/main.bicep`.
- `git diff --check` — passed. No agent guidance rule, network contract, new user-facing
  string, Foundry integration, or mobile/focus change. Storage schema remains compatible.
- Dependencies restored only after missing-tool failures (`vitest`, `ruff`); npm reported
  8 existing advisories (2 low, 6 high), not changed by this work.
- Per-turn manual reasoning state lasts while the card is mounted; reopening a screen uses
  the current default. No speech activation or activity/Traces reinterpretation.
