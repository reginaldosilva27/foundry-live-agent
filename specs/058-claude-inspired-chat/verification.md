# Verification evidence — specs 056 and 058

## Test-first
- Contextual observation/comparison regressions failed before implementation; 26 targeted tests then passed.
- Header/notice grid regression failed before the slot fix; 63 combined targeted tests then passed.
- Four presentation tests failed before redesign; then all passed.
- Browser found a 323px comparison header at a 320px viewport. A fifth presentation regression failed before the shrink/wrap fix; full suite now passes.

## Full local gates
- `cd frontend && npm run lint && npm test && npm run build`: passed, 95 files / 1102 tests. Existing refs warnings and bundle-size advisory remain.
- `cd backend && ruff check . && ruff format --check . && pytest -q`: passed, 299 tests, isolated worktree virtualenv.
- `cd ai && ruff check . && pytest -q`: passed, 246 tests / 3 live integration skips, same virtualenv.
- Infra clean skip: no `infra/main.bicep`.
- `git diff --check`: passed.

## Actual browser evidence
Credential-free `app.demo:create_demo_app` replay through the real normalizer, IPv4 Vite 5173 and BFF 8056. Before: empty/settled at light/dark × 1440/390/320. After: empty, settled tool round trip, Events and comparison at the same themes/widths; streaming screenshot. Chromium geometry measured document width at or below viewport after the fix. Keyboard Events activation and close-focus restoration passed; captured filter-empty recovers through All. Comparison issued two ordinary POSTs, both pick/reset controls locked while streaming, reset cleared both local draws while keeping the chosen agent. No reset request. This is two prompt replay columns, not hosted evidence.

Browser-local UI-only draws derived from the replay's stored record exercise restored absent events, explicitly empty capture, very long code/table content, and an error card in EN/PT × light/dark × 1440/390/320. These are labeled `ui-only-*`, **not service recordings**. Captured versus absent versus empty/filter-empty distinction is also covered in component tests. IME, send/stop, accessibility and chat/history reset isolation are covered in the full test suite.

Screenshots and `geometry.json` persist in this session's `files/ui-evidence/`; scripts/logs are local verification helpers, not committed service fixtures. No paid Azure/voice call, foreign process termination, palette/contract/storage change, or hosted continuity claim. #35 / #50 remains unresolved. Direct diff review checked local reset/selection guards, bilingual labels and unchanged service boundaries; custom reviewer was unavailable due its configured model alias.
