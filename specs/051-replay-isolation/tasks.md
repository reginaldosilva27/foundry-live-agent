# Tasks: Replay isolation

## Tasks
- [x] T1 — reproduce undeclared dependency in isolated install (8 failures, jsonschema missing).
- [x] T2 — write failing inherited-key, concurrent isolation and live-settings tests (3 RED).
- [x] T3 — declare dependency and implement request-local replay isolation.
- [x] T4 — document supported versions/install/start/stop/troubleshooting in EN/PT.
- [x] T5 — verify clean install, actual demo readiness and shutdown.
- [x] T6 — run full gates and cross-cutting checks; record evidence.

## Definition of done
- [x] Every acceptance criterion maps to a passing test.
- [x] Gates green (or explicit prerequisite skips) and live/visual replay evidence recorded.
- [x] Documentation bilingual, no new AgentEvent or Foundry integration guesses.
- [x] Spec status updated to done.

## Verification — 2026-10-09
All Python commands below used isolated Python 3.12 virtual environments, not global plugins.

| Command / evidence | Result |
|---|---|
| Fresh venv: `python -m pip install -e "ai[dev]" -e "backend[dev]"` | Passed, twice in independent venvs |
| Fresh venv: `python -m pip check` | No broken requirements |
| `backend/`: `python -m pytest -q tests/test_demo.py tests/test_tool_playground.py` | 35 passed in second clean venv |
| `ai/`: `pytest -q tests/test_tools.py` | 39 passed |
| `backend/`: `ruff check . && ruff format --check . && pytest -q` | Lint/format passed; 299 passed |
| `ai/`: `ruff check . && pytest -q` | Lint passed; 233 passed, 5 skips: 2 hosted-agent dependency skips and 3 live Tavily integration skips |
| `frontend/`: `npm ci` | Passed; audit reports 8 existing vulnerabilities (2 low, 6 high), not resolved by this task |
| `frontend/`: `npm run lint && npm test && npm run build` | Passed; 1037 tests; existing refs and bundle-size warnings |
| `infra/`: Bicep gates | Skipped as CI specifies: no `main.bicep` |

Actual `just demo` readiness: `/health`, `/config`, `/agents`, UI and SSE chat returned 200;
chat ended with `done`. With a dummy inherited Tavily key, playground search returned
`search_unavailable`; Speech/Voice and promotion reported disabled. Browser canvas at
`http://127.0.0.1:5173` showed the non-dismissible replay banner, accepted a typed question,
and displayed the completed recorded answer, reasoning, function/MCP calls and sources.
A screenshot was captured in the session, not substituted with a component test.

The first default startup correctly failed on another process's IPv6 `::1:5173` listener and
cleaned its backend. Verification used `NODE_OPTIONS=--dns-result-order=ipv4first just demo`
to bind the available IPv4 loopback without touching the other process. TERM and SIGINT were
sent separately to the exact owned recipe PID: exits 143 and 130 respectively, both server PIDs
stopped, and IPv4 ports were reusable. No helper server was left running. A raw bind check without
`SO_REUSEADDR` initially saw TIME_WAIT, not a leaked listener; listener and PID checks confirmed it.

No live Azure request was required or claimed. Hosted/voice live evidence remains outside #32.
AgentEvent, Foundry integrations and agent-guidance rules are unchanged; EN/PT setup moved together.
