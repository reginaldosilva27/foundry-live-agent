# Tasks: Versions, and going back to one

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Phase 1 — the served version, corrected and dormant

- [x] **T1 — test**: `served_version()` returns the selector's pinned version when the endpoint
      carries one, and `versions.latest.version` when it does not (AC11, both branches).
- [x] **T2 — implement**: `served_version()` in `backend/app/agents.py`; correct the module
      docstring line that calls `versions.latest.version` "the served version".
- [x] **T3 — test**: `version_not_active` follows the **served** version's status, not the newest
      one's (AC11).
- [x] **T4 — implement**: thread `served_version` through `_selectable_reason`.
- [x] **T5 — test**: the listing still makes exactly one upstream call and no per-agent call, and
      its `version` is the latest (AC12) — a counting stub asserts the absence.

## Phase 2 — the version list (a read)

- [x] **T6 — test**: `AgentVersion` projects identifier, status, created, model, newest first, with
      the served one marked (AC1).
- [x] **T7 — implement**: `AgentVersion` + `versions_of()`.
- [x] **T8 — test**: a version the service reported no `model` / `status` for projects `None`, and a
      hosted version is that same rule (AC2).
- [x] **T9 — implement**: the `None`-vs-empty handling, reusing `_reported_str`.
- [x] **T10 — test**: `GET /agents/{name}` answers `served_version` · `latest_version` · `pinned` ·
      `versions`, from `agents.get()` + `agents.list_versions()`.
- [x] **T11 — implement**: widen `AgentDetail` and `build_agent_detail_reader`; correct the router
      docstring's "no second upstream call".
- [x] **T12 — test**: the TypeScript mirror covers exactly the new fields (§4 parity).
- [x] **T13 — implement**: `AgentVersion` + the new `AgentDetail` fields in `types/agents.ts`.

## Phase 3 — the gate and the ownership rule

- [x] **T14 — test**: `OWNED_AGENT_NAMES` is exactly the names in `ai/harness/*/agent.yaml`.
- [x] **T15 — implement**: `OWNED_AGENT_NAMES` in `harness_factory.py`.
- [x] **T16 — test**: a version row on an unowned agent is `promotable: false` with
      `promote_reason: "not_owned"`; the served row is `false` with `"served"` (AC3).
- [x] **T17 — implement**: the per-version promotable projection.
- [x] **T18 — test**: `GET /config` carries `agents.can_promote`, false by default (AC9).
- [x] **T19 — implement**: `allow_version_promote` in `settings.py`, the `/config` field,
      `BffConfig` in `frontend/src/config.ts`.

## Phase 4 — the write

- [x] **T20 — test**: with the flag off, the promote route answers `write_disabled` and calls
      nothing upstream.
- [x] **T21 — test**: with the flag **on**, promoting an unowned agent answers `not_owned` and calls
      nothing upstream (AC13).
- [x] **T22 — test (seam)**: `promote_version` constructs exactly one
      `FixedRatioVersionSelectionRule`, `traffic_percentage=100`, the requested version, and **no
      definition anywhere in the payload**; the route accepts no request body (AC14).
      Docstring states plainly that this proves the call we build, not that the service accepts it.
- [x] **T23 — implement**: `promote_version()` in `agents.py`; the route in
      `routers/agents.py`; wire `app.state.promote_version` in `main.py`.
- [x] **T24 — test**: upstream permission and unknown-version failures map to `forbidden` /
      `unknown_version` codes, never prose (§7).
- [x] **T25 — implement**: the error mapping.

## Phase 5 — the screen

- [x] **T26 — test**: with `can_promote` false, no control renders anywhere (AC9).
- [x] **T27 — test**: the control renders only on a version that is not served, is `promotable`, and
      when config allows (AC3).
- [x] **T28 — test**: the confirmation's body names "everyone" and "next turn", in `en` and `pt` (AC4).
- [x] **T29 — test**: cancelling issues no request at all (AC5).
- [x] **T30 — test**: a second click while in flight issues no second request (AC6).
- [x] **T31 — test**: on success the served version rendered comes from the re-read — the stub
      returns a different version than was requested and the screen shows the stub's (AC7).
- [x] **T32 — test**: a failed promotion renders the translated code and leaves the served version
      unchanged (AC8).
- [x] **T33 — implement**: `state/promote.ts` and the `AgentDetail.tsx` version list, marks,
      control and confirmation.
- [x] **T34 — implement**: the i18n keys from `plan.md` (AC10 is the existing `strings.test.ts`).

## Phase 6 — the record

- [x] **T35 — docs**: `docs/REFERENCES.md` — the `update_details` call shape, its source
      (`azure-ai-projects` 2.6.0 typespec), and the **open item**: not verified live, `az` broken.
- [x] **T36 — docs**: `SECURITY.md` — the write surface, the default-off flag, the role as a manual
      step (no Bicep to ship it in, §5), and that a shared BFF makes a promotion unattributable.
- [x] **T37 — docs**: `docs/architecture.md` + `.env.example`.
- [x] **T38 — sync**: `CLAUDE.md` ↔ `AGENTS.md` if any rule changed (§6).
- [x] **T39 — refactor**: clean up, keep tests green.
- [x] **T40 — spec**: flip `spec.md` status to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] `verify-gates` skill run and green
