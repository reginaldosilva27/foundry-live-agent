# Tasks: Demo mode — the whole app, with no Azure credential

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## Backend

- [x] **T1 — test first**: `test_demo.py` — the demo app builds and streams a whole turn to `done`
      with every `FOUNDRY_*` / `AZURE_*` / `VOICELIVE_*` variable stripped from the environment (AC1).
- [x] **T2 — implement**: `backend/app/demo.py` — `RECORDINGS`, the replay stream factory,
      `create_demo_app()`. Make T1 pass.
- [x] **T3 — test first**: the replayed sequence passes `check_stream`, carries exactly one `usage`
      and one terminal event, and the same question twice replays the same bytes (AC3, AC7).
- [x] **T4 — implement**: accumulate across legs by reusing the adapter — nothing new normalises.
- [x] **T5 — test first**: production `create_app` exposes no `/demo` route and its import graph
      never reaches `app.demo` (AC2).
- [x] **T6 — implement**: `backend/app/routers/demo.py`, mounted only by `create_demo_app`.
- [x] **T7 — test first**: `GET /demo` lists the catalogue; `POST /demo/recording` changes what the
      next turn replays; an unknown id is refused with a code (AC6).
- [x] **T8 — implement**: the two routes.
- [x] **T9 — test first**: every `RECORDINGS` entry names a file that exists in
      `ai/tests/fixtures/recorded/` **and** is documented in that directory's `README.md` (AC12).
- [x] **T10 — implement**: fix whatever that finds.
- [x] **T11 — test first**: the recorded listing carries a prompt agent, a hosted one and one with
      no harness, each with a **code** and no prose (AC8).
- [x] **T12 — implement**: `recorded_agents()`, including the `demo_not_recorded` code.
- [x] **T13 — test first**: `GET /trace/{id}` answers `ok` with more than one span (AC9); the
      playground is on and `search_web` answers `search_unavailable` (AC10); voice and speech report
      not configured (AC11).
- [x] **T14 — implement**: the recorded span query and the flags.
- [x] **T15 — test first**: `GET /config` carries `demo` in the demo app and **omits the key** in
      the production one (AC4).
- [x] **T16 — implement**: the `config.py` key, from `app.state.demo`.

## Frontend

- [x] **T17 — test first**: `About.coverage.test.ts` fails until `demo` is covered (AC4).
- [x] **T18 — implement**: `config.ts`, `aboutFields.ts`, `About.tsx`.
- [x] **T19 — test first**: `DemoBanner.test.tsx` — it renders the date, it renders the picker, it
      offers **no** control that dismisses it, in `en` and `pt` (AC5, AC14).
- [x] **T20 — implement**: `DemoBanner.tsx`, `state/demo.ts`, the strings.
- [x] **T21 — test first**: `App.shell.test.tsx` — the banner is on every screen when `config.demo`
      is present, and absent when it is not; no request is made in the second case (AC5).
- [x] **T22 — implement**: render it in `App.tsx`.
- [x] **T23 — test first**: `layout.test.ts` — the banner is **placed** in the shell grid and spans
      every column, rather than auto-flowing into an implicit row.
- [x] **T24 — implement**: `app.css`.
- [x] **T25 — test first**: `AgentsScreen.test.tsx` — `demo_not_recorded` renders its sentence
      rather than the unknown fallback.
- [x] **T26 — implement**: the reason map and the strings.

## Contract, docs, runner (§4, §6, §7)

- [x] **T27**: `justfile` — the `demo` recipe (AC13).
- [x] **T28**: `README.md` ↔ `README.pt-BR.md` — the "look at it first" step.
- [x] **T29**: `SECURITY.md` — the demo entrypoint enables the playground.
- [x] **T30**: `specs/README.md` index row; `CHANGELOG.md`.

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean (`ruff`, `oxlint`)
- [x] Tests green (backend · ai · frontend)
- [x] Build passes (`npm run build`)
- [x] Docs updated in the same change; `GET /config` mirror in sync (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status updated to `done`
