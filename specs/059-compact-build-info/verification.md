# Verification: Compact build information

## Test-first and local gates

The new disclosure regression failed before implementation; the existing shell regression also
failed against the old banner. Browser measurement later found 339px page width at a 320px viewport.
A failing mobile-budget regression preceded the header spacing/name-floor correction.

- `cd frontend && npm run lint && npm test && npm run build`: passed, 96 files / 1100 tests.
  Existing history refs warnings and bundle-size advisory remain.
- `cd backend && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check . && ../.venv/bin/pytest -q`:
  passed, 299 tests.
- `cd ai && ../.venv/bin/ruff check . && ../.venv/bin/pytest -q`: passed, 246 tests / 3 gated
  live-integration skips.
- Infra: clean skip, no `main.bicep`.
- Full branch whitespace against verified PR51 base `e10586903d945567189e1aed7f6426828692b8ea`:
  passed before publication and checked again after commit.

## Browser evidence

A separate Chromium context, without clearing the user's internal browser, rendered a real
credential-free recorded round trip through the existing replay normalizer. Twenty-four PNGs cover
EN/PT × light/dark × 1440/390/320 × closed/open information. The report asserts page width equals
viewport width, visible bounded Replay badge and dialog, no header Voice, retained composer Voice,
recording selector operation, Enter opening and Escape restoring opener focus. Component tests
also assert Tab/Shift+Tab wrap, close-button restoration, exact unchanged facts, unknown recording
codes and no disclosure request. The internal browser was reloaded against the same responsive UI.

Absolute session evidence directory:
`/Users/reginaldosilva/.copilot/session-state/f1f1eff5-a1cd-4714-b584-b482d473821a/files/ui-evidence/spec059/`

Examples: `en-light-1440-closed.png`, `en-light-1440-open.png`, `pt-dark-320-closed.png`,
`pt-dark-320-open.png`. Measurement report: `geometry.json`. Previous spec058 evidence is retained
separately and is not relabeled as this refinement. No screenshots were uploaded externally.

## Boundaries and preview

No API, AgentEvent, storage, palette, agent-guidance rule or Foundry integration detail changed.
Existing config and demo catalogue remain the only fact sources; EN/PT README instructions moved.
No paid Azure or live voice validation, merge, issue closure or hosted continuity guarantee.

Owned preview remains `http://127.0.0.1:5173/`, replay BFF `http://127.0.0.1:8056`; frontend/config
readiness and CORS OPTIONS were verified. Detached handles: `pr53-preview-ui`, `pr53-preview-bff`.
Foreign PID53054 remains untouched.
