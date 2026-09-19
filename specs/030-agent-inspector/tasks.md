# Tasks: The agent, inspected

## Tasks

### The projection — `backend/app/agents.py`

- [x] **T1 — test**: the recorded listing projects a prompt agent's instructions, model, reasoning
      and tools (AC2, AC6).
- [x] **T2 — implement**: `AgentDetail` · `ToolInfo` · `detail_of`.
- [x] **T3 — test**: a function tool (no `type`) projects as `function` with its schema; the MCP tool
      projects its server label, URL and approval (AC3).
- [x] **T4 — implement**: classification by the absence of `type`.
- [x] **T5 — test**: executor is `app` for a function tool and `foundry` for MCP (AC4).
- [x] **T6 — implement**: executor attribution.
- [x] **T7 — test**: `testagentdemo` projects `tools: None`, distinct from an empty list (AC5).
- [x] **T8 — test**: the hosted agent projects image/cpu/memory/protocols, and `KEY_VAULT_URI`
      appears nowhere in the serialised response (AC11).
- [x] **T9 — implement**: `ContainerInfo`, environment dropped.

### The route — `backend/app/routers/agents.py`

- [x] **T10 — test**: `GET /agents/{name}` returns the detail; an unknown name is a 404 carrying a
      code; a listing failure carries its code (AC8).
- [x] **T11 — implement**: the route.

### The address and the read — `frontend/`

- [x] **T12 — test**: `/agents/{name}` round-trips through `route.ts`, including a name needing
      encoding (AC1).
- [x] **T13 — implement**: the route.
- [x] **T14 — test**: `useAgentDetail` models loading · ok · failed-with-code (AC8).
- [x] **T15 — implement**: it, and the mirrored types with the parity test (§4).

### The screen — `frontend/src/panes/AgentDetail.tsx`

- [x] **T16 — test**: renders name, kind, version, status, model, harness, instructions (AC2).
- [x] **T17 — implement**: the screen.
- [x] **T18 — test**: a function tool shows its schema and "executed by this app"; the MCP tool its
      server and "executed by Foundry" (AC3, AC4).
- [x] **T19 — implement**: the tool list.
- [x] **T20 — test**: an unreported field says so; reasoning absent renders nothing (AC5, AC6).
- [x] **T21 — test**: instructions and each schema are copyable (AC7).
- [x] **T22 — test**: a hosted agent shows its container and no environment (AC11).
- [x] **T23 — implement**: not-reported, reasoning, copy, container.
- [x] **T24 — test**: a failure renders the translated code, not an empty detail (AC8).
- [x] **T25 — implement**: the failure branch.

### Wiring

- [x] **T26 — test**: a card opens the detail; choosing from the detail selects and returns to the
      chat; nothing but GETs is issued (AC1, AC9, AC10).
- [x] **T27 — implement**: `AgentsScreen`, `App`.

### Closing

- [x] **T28 — i18n**: the new strings, `en` + `pt`.
- [x] **T29 — styles**: `app.css`.
- [x] **T30 — docs**: `REFERENCES.md`, `harness-comparison.md`.
- [x] **T31 — verify**: `verify-gates`; flip `spec.md` to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] All new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
