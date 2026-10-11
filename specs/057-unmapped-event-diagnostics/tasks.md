# Tasks: Unmapped event diagnostics

## Tasks
- [x] T1 — Write failing collector and adapter tests (AC1–AC5).
- [x] T2 — Implement shared collector and turn integration; make T1 pass.
- [x] T3 — Replay recorded streams and lifecycle/settlement tests (AC4/AC6).
- [x] T4 — Update learning docs and index (AC6).
- [x] T5 — Run full gates and review diff.

## Definition of done
- [x] All AC covered; red → green recorded.
- [x] Full gates green; external skips explicit.
- [x] Docs bilingual; no contract/guidance drift.
- [x] Spec status done.

## Verification evidence
- RED: initial collector test failed importing the absent implementation. Further oversized
  classification regression failed for both normalizers before the length guard was added.
- GREEN: targeted collector/adapter/recording/lifecycle tests initially 96 passed; final full
  `ai/`: `ruff check . && pytest -q` — 303 passed, 3 explicit live integration skips.
- `backend/`: `ruff check . && ruff format --check . && pytest -q` — 305 passed,
  1 strict xfail (#35 unchanged). `frontend/`: `npm run lint && npm test && npm run build` —
  passed, 1056 tests (90 files); existing ref/chunk warnings remain. Infra clean skip: no main.bicep.
- Python gates used an isolated `.venv` installed from existing manifests after global x86_64
  binary imports failed on ARM. Frontend dependencies restored with npm ci after missing oxlint.
  No dependency manifest was changed, no live service was contacted.
- Direct diff review: shared MAPPINGS vocabulary, bounds before hashing, safe log fields,
  finally-owned collector, immutable contract/config/voice and bilingual docs verified.
  Custom reviewer could not launch because its configured `sonnet` model was unavailable;
  no external reviewer result is claimed.
- Exact 96/97 length, overflow occurrence semantics, saturation, ignored and real recorded
  stream silence, turn-local reset, sink failure, per-leg budget and all exit paths are tested.
