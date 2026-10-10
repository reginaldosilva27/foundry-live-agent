# Tasks: Playground and proposal integration

- [x] RED: App regressions for asynchronous listing states and proposal entry/guards.
- [x] RED: selection refresh/removal regression in Playground.
- [x] GREEN: listing state and valid-selection fallback.
- [x] GREEN: configured detail read, proposal entry and editor composition.
- [x] Update direct docs and spec status.
- [x] Verify full local gates and actual local replay in browser; stop own helpers.

## Verification evidence — 2026-10-09

- RED: 9 failures before implementation; GREEN: 41 targeted tests.
- Frontend: lint, 1067 tests across 91 files, and build passed.
- Backend: Ruff lint/format and 299 tests passed.
- AI: Ruff and 246 tests passed; 3 live-service tests skipped.
- Infrastructure: clean skip, no `main.bicep`.
- Actual browser at `http://127.0.0.1:5173`: registry and raw arguments rendered,
  `get_current_datetime` executed locally; proposal produced a real validated diff through the
  replay BFF. Build provenance, shared-core impact and drift displayed in English and Portuguese.
  The shared YAML remained unchanged; CORS accepted the existing IPv4 origin.
- No Azure or metered search calls. Existing lint refs and bundle-size warnings remain.
- Own UI/BFF helpers stopped; unrelated IPv6 listener preserved.
- Publication is tracked by the stacked PR against UX #44, outside the implementation checklist.
